import test from "node:test";
import assert from "node:assert/strict";
import { getOrders, getProfile, getSubscriptions, login, loginWithDevice } from "../dist/auth.js";

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const memoryStore = (tokens) => ({
  load: async () => tokens,
  save: async (nextTokens) => { tokens = nextTokens; },
  get tokens() { return tokens; },
});

test("login calls Cognito and stores tokens", async () => {
  const store = memoryStore();
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return response({ AuthenticationResult: {
      AccessToken: "access",
      IdToken: "id",
      RefreshToken: "refresh",
      ExpiresIn: 3600,
    } });
  };

  await login("person@example.com", "Password123", store, fetchImpl, "client-id");
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].options.body).AuthFlow, "USER_PASSWORD_AUTH");
  assert.deepEqual(store.tokens, {
    accessToken: "access",
    idToken: "id",
    refreshToken: "refresh",
    issuedAt: store.tokens.issuedAt,
    expiresAt: store.tokens.expiresAt,
    clientId: undefined,
  });
});

test("loginWithDevice polls until approved and stores mapped tokens", async () => {
  const store = memoryStore();
  const calls = [];
  const noopSleep = async () => {};
  let pollCount = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/v1/auth/cli/device")) {
      return response({ success: true, data: {
        device_code: "device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://app.example.com/cli-login",
        expires_in: 600,
        interval: 5,
      } });
    }
    pollCount += 1;
    if (pollCount === 1) {
      return response({ success: false, error: "Authorization is still pending", code: "AUTHORIZATION_PENDING" });
    }
    return response({ success: true, data: {
      access_token: "access",
      id_token: "id",
      refresh_token: "refresh",
      expires_in: 3600,
      token_type: "Bearer",
    } });
  };

  const prompts = [];
  const tokens = await loginWithDevice(store, fetchImpl, (prompt) => prompts.push(prompt), noopSleep);

  assert.deepEqual(prompts, [{ verificationUri: "https://app.example.com/cli-login", userCode: "ABCD-EFGH" }]);
  assert.equal(pollCount, 2);
  assert.deepEqual(tokens, {
    accessToken: "access",
    idToken: "id",
    refreshToken: "refresh",
    issuedAt: store.tokens.issuedAt,
    expiresAt: store.tokens.expiresAt,
    clientId: undefined,
  });
  assert.deepEqual(store.tokens, tokens);
});

test("loginWithDevice rejects on invalid device code", async () => {
  const store = memoryStore();
  const noopSleep = async () => {};
  const fetchImpl = async (url) => {
    if (url.endsWith("/v1/auth/cli/device")) {
      return response({ success: true, data: {
        device_code: "device-code",
        user_code: "ABCD-EFGH",
        verification_uri: "https://app.example.com/cli-login",
        expires_in: 600,
        interval: 5,
      } });
    }
    return response({ success: false, error: "Device code is invalid", code: "INVALID_DEVICE_CODE" });
  };

  await assert.rejects(
    loginWithDevice(store, fetchImpl, undefined, noopSleep),
    /Device code is invalid/,
  );
  assert.equal(store.tokens, undefined);
});

test("profile refreshes expired access token and retains refresh token", async () => {
  const store = memoryStore({
    accessToken: "expired",
    refreshToken: "old-refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:30:00.000Z",
  });
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("cognito-idp")) {
      return response({ AuthenticationResult: { AccessToken: "new-access", ExpiresIn: 3600 } });
    }
    return response({ success: true, data: { user_id: "user-1", email: "person@example.com" } });
  };

  const profile = await getProfile(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.deepEqual(profile, { user_id: "user-1", email: "person@example.com" });
  assert.equal(store.tokens.accessToken, "new-access");
  assert.equal(store.tokens.refreshToken, "old-refresh");
  assert.equal(calls[1].options.headers.Authorization, "Bearer new-access");
});

test("getOrders returns orders capped at 10", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const orders = Array.from({ length: 15 }, (_, index) => ({ id: `od_${index}`, status: "PAID" }));
  const fetchImpl = async () => response({ success: true, data: { orders } });

  const result = await getOrders(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.equal(result.length, 10);
  assert.equal(result[0].id, "od_0");
});

test("getOrders refreshes on 401 and retries", async () => {
  const store = memoryStore({
    accessToken: "expired",
    refreshToken: "old-refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("cognito-idp")) {
      return response({ AuthenticationResult: { AccessToken: "new-access", ExpiresIn: 3600 } });
    }
    if (calls.filter((call) => call.url.includes("/v1/orders")).length === 1) {
      return response({ success: false, error: "Unauthorized" }, 401);
    }
    return response({ success: true, data: { orders: [{ id: "od_1", status: "PAID" }] } });
  };

  const result = await getOrders(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.deepEqual(result, [{ id: "od_1", status: "PAID" }]);
  assert.equal(store.tokens.accessToken, "new-access");
});

test("profile refresh uses the client id the tokens were issued with, not the default", async () => {
  const store = memoryStore({
    accessToken: "expired",
    refreshToken: "old-refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T00:30:00.000Z",
    clientId: "device-flow-client",
  });
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("cognito-idp")) {
      return response({ AuthenticationResult: { AccessToken: "new-access", ExpiresIn: 3600 } });
    }
    return response({ success: true, data: { user_id: "user-1" } });
  };

  await getProfile(store, fetchImpl, "password-flow-client", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.equal(JSON.parse(calls[0].options.body).ClientId, "device-flow-client");
});

test("getOrders throws when not logged in", async () => {
  const store = memoryStore(undefined);
  await assert.rejects(getOrders(store, async () => response({})), /Not logged in/);
});

test("getSubscriptions returns subscriptions capped at 10", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const subscriptions = Array.from({ length: 15 }, (_, index) => ({ id: `sub_${index}`, status: "ACTIVE" }));
  const fetchImpl = async () => response({ success: true, data: { subscriptions } });

  const result = await getSubscriptions(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.equal(result.length, 10);
  assert.equal(result[0].id, "sub_0");
});
