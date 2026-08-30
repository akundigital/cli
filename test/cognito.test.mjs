import test from "node:test";
import assert from "node:assert/strict";
import { login, loginWithDevice } from "../dist/cognito.js";
import { response, memoryStore } from "./test-helpers.mjs";

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
