import test from "node:test";
import assert from "node:assert/strict";
import { createCommands, runCommand } from "../dist/commands.js";

const execute = (command, args = []) => {
  const output = [];
  const errors = [];
  const code = runCommand(command, args, "0.1.0", (message) => output.push(message), (message) => errors.push(message));
  return { code, output, errors };
};

test("help displays usage and built-in commands", () => {
  const result = execute("help");
  assert.equal(result.code, 0);
  assert.match(result.output[0], /Usage: akundigital/);
  assert.match(result.output[0], /version/);
});

test("help aliases work", () => {
  assert.equal(execute("--help").code, 0);
  assert.equal(execute("-h").code, 0);
  assert.equal(execute(undefined).code, 0);
});

test("version displays the package version", () => {
  assert.deepEqual(execute("version"), { code: 0, output: ["0.1.0"], errors: [] });
  assert.deepEqual(execute("--version"), { code: 0, output: ["0.1.0"], errors: [] });
  assert.deepEqual(execute("-v"), { code: 0, output: ["0.1.0"], errors: [] });
});

test("unknown commands fail and display help", () => {
  const result = execute("deploy", ["production"]);
  assert.equal(result.code, 1);
  assert.deepEqual(result.errors, ["Unknown command: deploy"]);
  assert.match(result.output[0], /Usage: akundigital/);
});

test("command registry exposes built-in commands", () => {
  assert.deepEqual(Object.keys(createCommands("0.1.0")), ["help", "version"]);
});
