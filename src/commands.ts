import { approveOrder, archiveSubscriptions, getCredentials, getOrders, getPayments, getProfile, getSubscriptions, maxCredentialsLimit, maxOrdersLimit, maxPaymentsLimit, maxSubscriptionsLimit } from "./admin-resources.js";
import { login, loginWithDevice } from "./cognito.js";
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

const parseLimit = (args: string[], defaultLimit: number): number | Error => {
  const index = args.findIndex((argument) => argument === "--limit" || argument === "-l");
  if (index === -1) return defaultLimit;
  const value = args[index + 1];
  const parsed = Number(value);
  if (!value || !Number.isInteger(parsed) || parsed <= 0) {
    return new Error("--limit must be a positive integer");
  }
  return parsed;
};

const parseOption = (args: string[], name: string): string | undefined => {
  const index = args.findIndex((argument) => argument === name);
  if (index === -1) return undefined;
  return args[index + 1];
};

const hasOnlyKnownFlags = (args: string[], knownFlags: Set<string>): boolean =>
  args.length % 2 === 0 && args.filter((_, index) => index % 2 === 0).every((flag) => knownFlags.has(flag));

export const createCommands = (version: string): Record<string, Command> => ({
  help: {
    description: "Show available commands",
    run: async ({ output }) => {
      output([
        "Usage: akundigital <command> [arguments]",
        "",
        "Commands:",
        "  help           Show available commands",
        "  version        Show the installed version",
        "  login          Log in with email and password, or `login --device` for browser-assisted login",
        "  profile        Show the current user profile",
        "  orders         List your most recent orders (default 5, --limit/-l <n>, --status <status>)",
        "  approve-order  Mark an order as paid (admin)",
        "  subscriptions  List subscriptions (admin, default 5, --limit/-l <n>, --status <status>)",
        "  archive-subscriptions  Archive expired subscriptions (admin)",
        "  payments       List payments (admin, default 5, --limit/-l <n>, --status <status>)",
        "  credentials    List credentials (admin, default 5, --limit/-l <n>, --status <status>)",
        "",
        "--status values are matched case-sensitively against uppercase status",
        "enums (e.g. ACTIVE, EXPIRED, PAID); lowercase values will not match.",
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
    description: "Log in with email and password, or `login --device` for browser-assisted login",
    run: async ({ args, output, error }) => {
      if (args.includes("--help")) {
        error("Usage: akundigital login <email> <password>\n   or: akundigital login --device");
        return 1;
      }
      if (args.includes("--device")) {
        try {
          await loginWithDevice(createTokenStore(), fetch, ({ verificationUri, userCode }) => {
            output(`Open ${verificationUri} in a browser and enter code: ${userCode}`);
          });
          output("Logged in successfully.");
          return 0;
        } catch (loginError) {
          error(loginError instanceof Error ? loginError.message : "Authentication failed");
          return 1;
        }
      }
      if (args.length !== 2) {
        error("Usage: akundigital login <email> <password>\n   or: akundigital login --device");
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
  orders: {
    description: "List your most recent orders (default 5, --limit/-l <n>, --status <status>)",
    run: async ({ args, output, error }) => {
      if (!hasOnlyKnownFlags(args, new Set(["--limit", "-l", "--status"]))) {
        error("Usage: akundigital orders [--limit|-l <n>] [--status <status>]");
        return 1;
      }
      const limit = parseLimit(args, maxOrdersLimit);
      if (limit instanceof Error) {
        error(limit.message);
        return 1;
      }
      const status = parseOption(args, "--status");
      try {
        const orders = await getOrders(createTokenStore(), fetch, undefined, undefined, limit, status);
        if (orders.length === 0) {
          output("No orders found.");
          return 0;
        }
        output(JSON.stringify(orders, null, 2));
        return 0;
      } catch (ordersError) {
        error(ordersError instanceof Error ? ordersError.message : "Failed to get orders");
        return 1;
      }
    },
  },
  "approve-order": {
    description: "Mark an order as paid (admin)",
    run: async ({ args, output, error }) => {
      if (args.length !== 1) {
        error("Usage: akundigital approve-order <order-id>");
        return 1;
      }
      try {
        const order = await approveOrder(createTokenStore(), args[0]);
        output(JSON.stringify(order, null, 2));
        return 0;
      } catch (approveError) {
        error(approveError instanceof Error ? approveError.message : "Failed to approve order");
        return 1;
      }
    },
  },
  subscriptions: {
    description: "List subscriptions (admin, default 5, --limit/-l <n>, --status <status>)",
    run: async ({ args, output, error }) => {
      if (!hasOnlyKnownFlags(args, new Set(["--limit", "-l", "--status"]))) {
        error("Usage: akundigital subscriptions [--limit|-l <n>] [--status <status>]");
        return 1;
      }
      const limit = parseLimit(args, maxSubscriptionsLimit);
      if (limit instanceof Error) {
        error(limit.message);
        return 1;
      }
      const status = parseOption(args, "--status");
      try {
        const subscriptions = await getSubscriptions(createTokenStore(), fetch, undefined, undefined, limit, status);
        if (subscriptions.length === 0) {
          output("No subscriptions found.");
          return 0;
        }
        output(JSON.stringify(subscriptions, null, 2));
        return 0;
      } catch (subscriptionsError) {
        error(subscriptionsError instanceof Error ? subscriptionsError.message : "Failed to get subscriptions");
        return 1;
      }
    },
  },
  "archive-subscriptions": {
    description: "Archive expired subscriptions (admin, optionally by ID)",
    run: async ({ args, output, error }) => {
      try {
        const store = createTokenStore();
        let subscriptionIds = args;
        if (subscriptionIds.length === 0) {
          const expired = await getSubscriptions(store, fetch, undefined, undefined, Number.POSITIVE_INFINITY, "EXPIRED");
          subscriptionIds = expired.map((subscription) => subscription.id);
          if (subscriptionIds.length === 0) {
            output("No expired subscriptions found.");
            return 0;
          }
        }
        const result = await archiveSubscriptions(store, subscriptionIds);
        output(`Archived ${result.archived_count} subscription(s).`);
        output(JSON.stringify(result.subscriptions, null, 2));
        return 0;
      } catch (archiveError) {
        error(archiveError instanceof Error ? archiveError.message : "Failed to archive subscriptions");
        return 1;
      }
    },
  },
  payments: {
    description: "List payments (admin, default 5, --limit/-l <n>, --status <status>)",
    run: async ({ args, output, error }) => {
      if (!hasOnlyKnownFlags(args, new Set(["--limit", "-l", "--status"]))) {
        error("Usage: akundigital payments [--limit|-l <n>] [--status <status>]");
        return 1;
      }
      const limit = parseLimit(args, maxPaymentsLimit);
      if (limit instanceof Error) {
        error(limit.message);
        return 1;
      }
      const status = parseOption(args, "--status");
      try {
        const payments = await getPayments(createTokenStore(), fetch, undefined, undefined, limit, status);
        if (payments.length === 0) {
          output("No payments found.");
          return 0;
        }
        output(JSON.stringify(payments, null, 2));
        return 0;
      } catch (paymentsError) {
        error(paymentsError instanceof Error ? paymentsError.message : "Failed to get payments");
        return 1;
      }
    },
  },
  credentials: {
    description: "List credentials (admin, default 5, --limit/-l <n>, --status <status>)",
    run: async ({ args, output, error }) => {
      if (!hasOnlyKnownFlags(args, new Set(["--limit", "-l", "--status"]))) {
        error("Usage: akundigital credentials [--limit|-l <n>] [--status <status>]");
        return 1;
      }
      const limit = parseLimit(args, maxCredentialsLimit);
      if (limit instanceof Error) {
        error(limit.message);
        return 1;
      }
      const status = parseOption(args, "--status");
      try {
        const credentials = await getCredentials(createTokenStore(), fetch, undefined, undefined, limit, status);
        if (credentials.length === 0) {
          output("No credentials found.");
          return 0;
        }
        output(JSON.stringify(credentials, null, 2));
        return 0;
      } catch (credentialsError) {
        error(credentialsError instanceof Error ? credentialsError.message : "Failed to get credentials");
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
