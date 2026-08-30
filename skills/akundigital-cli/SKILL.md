---
name: akundigital-cli
description: Drive the `akundigital` CLI to do admin work against the AkunDigital backend - logging in, checking a user profile, listing or filtering orders/subscriptions/payments/credentials, approving an order, and archiving expired subscriptions. Use this whenever the user asks to check, list, filter, approve, or archive anything related to AkunDigital orders, subscriptions, payments, or credentials, or mentions logging into AkunDigital, even if they don't name the CLI directly (e.g. "is order #1234 still pending", "archive the expired subs", "who are our flagged payments").
---

# akundigital CLI

`akundigital` is an internal command-line tool for AkunDigital admin staff. It
authenticates against Cognito and talks to the AkunDigital backend to read
and mutate orders, subscriptions, payments, and credentials. Use it instead
of guessing at API shapes or writing ad-hoc scripts - it already knows the
auth flow, the endpoints, and the status enums.

Run it with `npx akundigital <command> [arguments]`. If a local checkout of
this repo is open and built (`dist/index.js` exists), `node dist/index.js
<command>` also works and avoids an npx fetch.

## Commands

| Command | Who can run it | Purpose |
|---|---|---|
| `login <email> <password>` | anyone | Authenticate and save tokens to `~/.config/akundigital/tokens.json` |
| `login --device` | anyone | Browser-assisted login for headless/remote machines - prints a URL + code, waits for approval |
| `profile` | anyone | Print the current user's profile as JSON |
| `orders [--limit\|-l <n>] [--status <status>]` | anyone | List the caller's most recent orders (default and max 5) |
| `approve-order <order-id>` | admin | Mark an order `PAID` - only valid from `PENDING`/`AWAITING_VERIFICATION` |
| `subscriptions [--limit\|-l <n>] [--status <status>]` | admin | List subscriptions (default and max 5) |
| `archive-subscriptions [subscription-id ...]` | admin | With no args: archive every currently `EXPIRED` subscription. With explicit IDs: archive exactly those (each must already be `EXPIRED`) |
| `payments [--limit\|-l <n>] [--status <status>]` | admin | List payments (default and max 5) |
| `credentials [--limit\|-l <n>] [--status <status>]` | admin | List credentials (default and max 5) |

`help` and `version` are also available and self-explanatory.

## Before running an admin command

Commands marked "admin" call backend endpoints gated on Cognito group
membership - they 403 for any account that isn't in the `admin` group. If a
command fails with a 403 or an auth error, don't retry with different flags;
the fix is logging in with an admin account (`akundigital login <email>
<password>` or `login --device` on a headless box), not a CLI bug. Tokens
refresh automatically once logged in, so a fresh 403 almost always means
wrong account, not an expired token.

## Status filtering - the one sharp edge

`--status` is matched **case-sensitively against uppercase backend enums**
(`ACTIVE`, `EXPIRED`, `PAID`, etc.). Passing a lowercase value silently
returns zero results instead of erroring, which looks like "there's nothing
matching" when really the filter just didn't match anything. Always
uppercase the value you pass. For `payments`, `--status` filters on the
backend's `match_status` field specifically (`AUTO_PAID`, `FLAGGED`,
`UNMATCHED`, `AMBIGUOUS`) - not a generic payment state.

## Limits

`orders`, `subscriptions`, `payments`, and `credentials` all default to and
cap out at 5 results per call, newest first. There's no pagination flag -
`--limit`/`-l` only lowers the count, it can't raise it past 5. If the user
needs to see more than 5 matching records (e.g. "archive all expired
subscriptions"), don't try to page through the CLI: `archive-subscriptions`
with no arguments already looks up every `EXPIRED` subscription server-side
before archiving, so lean on that rather than listing-then-archiving by ID
when the intent is "all of them".

## Reading output

Every listing and mutation command prints JSON (via `JSON.stringify(...,
null, 2)`) on success, or a plain-text usage/error message on failure with a
non-zero exit code. When a listing comes back empty it prints a friendly
"No <resource> found." line instead of `[]` - treat that as "zero matches,"
not as a failure.

## Example workflows

**"Is order #ord_123 still pending?"**
```sh
npx akundigital orders --status PENDING
```
then check whether `ord_123` is in the results (remember: max 5, newest
first - if it's not there and might be older, say so rather than assuming
it doesn't exist).

**"Approve order ord_123"**
```sh
npx akundigital approve-order ord_123
```
This only succeeds if the order is currently `PENDING` or
`AWAITING_VERIFICATION`; report the exact error back if it fails rather than
retrying blindly.

**"Clean up expired subscriptions"**
```sh
npx akundigital archive-subscriptions
```
No arguments needed - it finds and archives every `EXPIRED` subscription in
one call.

**"Any flagged payments recently?"**
```sh
npx akundigital payments --status FLAGGED
```

**"Log in as an admin account, headless server"**
```sh
npx akundigital login --device
```
Relay the printed verification URL and code to the user so they can approve
in a browser.
