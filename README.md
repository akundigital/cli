# akundigital

A command-line interface for AkunDigital.

## Usage

Run the latest published version without installing it:

```sh
npx akundigital help
npx akundigital version
```

The CLI provides these commands:

- `help` — show available commands
- `version` — show the installed version
- `login <email> <password>` — authenticate with AkunDigital and save tokens locally
- `login --device` — browser-assisted login: prints a verification URL and code, then waits for approval in a browser (useful on headless/remote machines)
- `profile` — fetch and print the current user profile

Authentication tokens are stored in `~/.config/akundigital/tokens.json`. Expired access tokens are refreshed automatically with the saved refresh token.

Unknown commands return a non-zero exit code and display the usage guide. Future commands can be registered in `src/commands.ts`.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
node dist/index.js help
```

## Publishing

Publishing runs from GitHub Actions when a semantic version tag is pushed. Add a repository secret named `NPM_TOKEN` containing an npm granular access token with package publish access and 2FA bypass enabled, then release with:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Do not put the token in the repository or local `.npmrc`.

## License

MIT
