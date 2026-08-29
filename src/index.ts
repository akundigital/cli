#!/usr/bin/env node
import { createRequire } from "node:module";
import { runCommand } from "./commands.js";

const require = createRequire(import.meta.url);
const packageJson = require("../package.json") as { version: string };

const exitCode = runCommand(
  process.argv[2],
  process.argv.slice(3),
  packageJson.version,
  (message) => console.log(message),
  (message) => console.error(message),
);

if (exitCode !== 0) {
  process.exitCode = exitCode;
}
