import { getProfile, login } from "./auth.js";
import { createTokenStore } from "./token-store.js";

export type CommandContext = {
  args: string[];
  output: (message: string) => void;
  error: (message: string) => void;
};

export type Command = {
  description: string;
  run: (context: CommandContext) => Promise<number>;
};

export const createCommands = (version: string): Record<string, Command> => ({
  help: {
    description: "Show available commands",
    run: async ({ output }) => {
      output([
        "Usage: akundigital <command> [arguments]",
        "",
        "Commands:",
        "  help       Show available commands",
        "  version    Show the installed version",
        "  login      Log in with email and password",
        "  profile    Show the current user profile",
        "",
        "Run `akundigital <command> --help` for command-specific help.",
      ].join("\n"));
      return 0;
    },
  },
  version: {
    description: "Show the installed version",
    run: async ({ output }) => {
      output(version);
      return 0;
    },
  },
  login: {
    description: "Log in with email and password",
    run: async ({ args, output, error }) => {
      if (args.length !== 2 || args.includes("--help")) {
        error("Usage: akundigital login <email> <password>");
        return 1;
      }
      try {
        await login(args[0], args[1], createTokenStore());
        output("Logged in successfully.");
        return 0;
      } catch (loginError) {
        error(loginError instanceof Error ? loginError.message : "Authentication failed");
        return 1;
      }
    },
  },
  profile: {
    description: "Show the current user profile",
    run: async ({ args, output, error }) => {
      if (args.length !== 0) {
        error("Usage: akundigital profile");
        return 1;
      }
      try {
        const profile = await getProfile(createTokenStore());
        output(JSON.stringify(profile, null, 2));
        return 0;
      } catch (profileError) {
        error(profileError instanceof Error ? profileError.message : "Failed to get profile");
        return 1;
      }
    },
  },
});

export const runCommand = async (
  commandName: string | undefined,
  args: string[],
  version: string,
  output: (message: string) => void,
  error: (message: string) => void,
): Promise<number> => {
  const commands = createCommands(version);

  if (!commandName || commandName === "--help" || commandName === "-h") {
    return commands.help.run({ args, output, error });
  }

  if (commandName === "--version" || commandName === "-v") {
    return commands.version.run({ args, output, error });
  }

  const command = commands[commandName];
  if (!command) {
    error(`Unknown command: ${commandName}`);
    await commands.help.run({ args: [], output, error });
    return 1;
  }

  return command.run({ args, output, error });
};
