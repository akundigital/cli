import test from "node:test";
import assert from "node:assert/strict";
import { createCommands, runCommand } from "../dist/commands.js";
import { createTokenSet } from "../dist/token-store.js";

const execute = async (command, args = []) => {
  const output = [];
  const errors = [];
  const code = await runCommand(command, args, "0.1.0", (message) => output.push(message), (message) => errors.push(message));
  return { code, output, errors };
};

test("help displays usage and built-in commands", async () => {
  const result = await execute("help");
  assert.equal(result.code, 0);
  assert.match(result.output[0], /Usage: akundigital/);
  assert.match(result.output[0], /version/);
  assert.match(result.output[0], /login/);
  assert.match(result.output[0], /profile/);
});

test("help aliases work", async () => {
  assert.equal((await execute("--help")).code, 0);
  assert.equal((await execute("-h")).code, 0);
  assert.equal((await execute(undefined)).code, 0);
});

test("version displays the package version", async () => {
  assert.deepEqual(await execute("version"), { code: 0, output: ["0.1.0"], errors: [] });
  assert.deepEqual(await execute("--version"), { code: 0, output: ["0.1.0"], errors: [] });
  assert.deepEqual(await execute("-v"), { code: 0, output: ["0.1.0"], errors: [] });
});

test("unknown commands fail and display help", async () => {
  const result = await execute("deploy", ["production"]);
  assert.equal(result.code, 1);
  assert.deepEqual(result.errors, ["Unknown command: deploy"]);
  assert.match(result.output[0], /Usage: akundigital/);
});

test("command registry exposes built-in commands", () => {
  assert.deepEqual(Object.keys(createCommands("0.1.0")), ["help", "version", "login", "profile", "orders", "subscriptions"]);
});

test("orders rejects extra arguments", async () => {
  const result = await execute("orders", ["extra"]);
  assert.equal(result.code, 1);
  assert.deepEqual(result.errors, ["Usage: akundigital orders"]);
});

test("token set preserves refresh token and calculates expiry", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  assert.deepEqual(createTokenSet({ AccessToken: "access", IdToken: "id", ExpiresIn: 3600 }, "refresh", now), {
    accessToken: "access",
    idToken: "id",
    refreshToken: "refresh",
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-01T01:00:00.000Z",
    clientId: undefined,
  });
});
