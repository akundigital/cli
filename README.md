# akundigital

A command-line interface for AkunDigital.

## Usage

Run the latest published version without installing it:

```sh
npx akundigital help
npx akundigital version
```

The initial release provides these commands:

- `help` — show available commands
- `version` — show the installed version

Unknown commands return a non-zero exit code and display the usage guide. Future commands can be registered in `src/commands.ts`.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
node dist/index.js help
```

## License

MIT
