# akundigital

A command-line interface for AkunDigital admin staff.

This CLI is intended for internal admin use only. Log in with an AkunDigital
account that belongs to the Cognito `admin` group — commands that call
admin-only backend endpoints (see below) will fail with a 403 for any account
that isn't a member of that group.

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
- `orders` — list your most recent orders (max 10, newest first)
- `subscriptions` — list subscriptions (admin only, max 10)

`subscriptions` requires the logged-in account to be a member of the Cognito
`admin` group; other accounts will get a 403 from the backend. `profile` and
`orders` work for any authenticated account, but since this CLI is for admin
staff, log in with your admin account for all commands.

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
