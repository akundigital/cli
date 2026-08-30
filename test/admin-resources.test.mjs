import test from "node:test";
import assert from "node:assert/strict";
import { getCredentials, getOrders, getPayments, getProfile, getSubscriptions } from "../dist/admin-resources.js";
import { response, memoryStore } from "./test-helpers.mjs";

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

test("getOrders returns orders capped at 5 by default", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const orders = Array.from({ length: 15 }, (_, index) => ({ id: `od_${index}`, status: "PAID" }));
  const fetchImpl = async () => response({ success: true, data: { orders } });

  const result = await getOrders(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.equal(result.length, 5);
  assert.equal(result[0].id, "od_0");
});

test("getOrders respects a custom limit", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const orders = Array.from({ length: 15 }, (_, index) => ({ id: `od_${index}`, status: "PAID" }));
  const fetchImpl = async () => response({ success: true, data: { orders } });

  const result = await getOrders(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"), 3);
  assert.equal(result.length, 3);
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

test("getOrders throws when not logged in", async () => {
  const store = memoryStore(undefined);
  await assert.rejects(getOrders(store, async () => response({})), /Not logged in/);
});

test("getOrders appends a status query parameter when given", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return response({ success: true, data: { orders: [] } });
  };

  await getOrders(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"), 5, "PAID");
  assert.match(calls[0], /\?status=PAID$/);
});

test("getSubscriptions returns subscriptions capped at 5 by default", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const subscriptions = Array.from({ length: 15 }, (_, index) => ({ id: `sub_${index}`, status: "ACTIVE" }));
  const fetchImpl = async () => response({ success: true, data: { subscriptions } });

  const result = await getSubscriptions(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.equal(result.length, 5);
  assert.equal(result[0].id, "sub_0");
});

test("getSubscriptions respects a custom limit", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const subscriptions = Array.from({ length: 15 }, (_, index) => ({ id: `sub_${index}`, status: "ACTIVE" }));
  const fetchImpl = async () => response({ success: true, data: { subscriptions } });

  const result = await getSubscriptions(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"), 3);
  assert.equal(result.length, 3);
});

test("getSubscriptions appends a status query parameter when given", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return response({ success: true, data: { subscriptions: [] } });
  };

  await getSubscriptions(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"), 5, "ACTIVE");
  assert.match(calls[0], /\?status=ACTIVE$/);
});

test("getPayments returns payments capped at 5 by default", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const payments = Array.from({ length: 15 }, (_, index) => ({ id: `pay_${index}`, status: "PAID" }));
  const fetchImpl = async () => response({ success: true, data: { payments } });

  const result = await getPayments(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.equal(result.length, 5);
  assert.equal(result[0].id, "pay_0");
});

test("getPayments respects a custom limit", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const payments = Array.from({ length: 15 }, (_, index) => ({ id: `pay_${index}`, status: "PAID" }));
  const fetchImpl = async () => response({ success: true, data: { payments } });

  const result = await getPayments(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"), 3);
  assert.equal(result.length, 3);
});

test("getCredentials returns credentials capped at 5 by default", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const credentials = Array.from({ length: 15 }, (_, index) => ({ id: `cred_${index}`, status: "ACTIVE" }));
  const fetchImpl = async () => response({ success: true, data: { credentials } });

  const result = await getCredentials(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"));
  assert.equal(result.length, 5);
  assert.equal(result[0].id, "cred_0");
});

test("getCredentials appends a status query parameter when given", async () => {
  const store = memoryStore({
    accessToken: "access",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T02:00:00.000Z",
  });
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return response({ success: true, data: { credentials: [] } });
  };

  await getCredentials(store, fetchImpl, "client-id", Date.parse("2026-01-01T01:00:00.000Z"), 5, "ACTIVE");
  assert.match(calls[0], /\?status=ACTIVE$/);
});
