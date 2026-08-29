import test from "node:test";
import assert from "node:assert/strict";
import { getProfile, login } from "../dist/auth.js";

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
  });
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
