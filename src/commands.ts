export type CommandContext = {
  args: string[];
  output: (message: string) => void;
};

export type Command = {
  description: string;
  run: (context: CommandContext) => number;
};

export const createCommands = (version: string): Record<string, Command> => ({
  help: {
    description: "Show available commands",
    run: ({ output }) => {
      output([
        "Usage: akundigital <command> [arguments]",
        "",
        "Commands:",
        "  help       Show available commands",
        "  version    Show the installed version",
        "",
        "Run `akundigital <command> --help` for command-specific help.",
      ].join("\n"));
      return 0;
    },
  },
  version: {
    description: "Show the installed version",
    run: ({ output }) => {
      output(version);
      return 0;
    },
  },
});

export const runCommand = (
  commandName: string | undefined,
  args: string[],
  version: string,
  output: (message: string) => void,
  error: (message: string) => void,
): number => {
  const commands = createCommands(version);

  if (!commandName || commandName === "--help" || commandName === "-h") {
    return commands.help.run({ args, output });
  }

  if (commandName === "--version" || commandName === "-v") {
    return commands.version.run({ args, output });
  }

  const command = commands[commandName];
  if (!command) {
    error(`Unknown command: ${commandName}`);
    commands.help.run({ args: [], output });
    return 1;
  }

  return command.run({ args, output });
};
