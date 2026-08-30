# Memory

## Project Overview
See @README.md for project overview and @package.json for available npm/pnpm commands for this project.

This CLI is for AkunDigital admin staff only. Commands that call `/v1/admin/*`
backend endpoints (e.g. `subscriptions`) require the logged-in account to be
in the Cognito `admin` group; the backend's custom authorizer rejects
non-admin callers with a 403 before the request reaches the handler (see
`akundigital/services` `docs/api/admin/README.md`). Do not add client-side
admin-role checks in this CLI — there is no role field in the profile
response to check, and the backend already enforces this per admin endpoint.

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

## Design Principles
- **KISS** — prefer the straightforward implementation over a clever one. Don't add
  configuration, indirection, or generalized abstractions that nothing in this CLI needs yet.
- **YAGNI** — build only what the current command/feature requires. Don't add parameters,
  options, or hooks speculatively for a future use case.
- **SRP** — each module should own one concern. This codebase splits the admin-API surface
  this way; follow the same split when adding new endpoints or auth flows:
  - `src/http.ts` — shared HTTP constants/types (`apiBaseUrl`, `FetchLike`, `ApiEnvelope`, `withStatus`).
  - `src/cognito.ts` — Cognito auth flows only (`login`, `loginWithDevice`, `refresh`).
  - `src/api-client.ts` — the generic authenticated-fetch-with-refresh-and-401-retry helper
    (`fetchAuthorized`). No endpoint-specific knowledge lives here.
  - `src/admin-resources.ts` — one function + type per `/v1/*` resource (orders, subscriptions,
    payments, credentials, profile), each built on `fetchAuthorized`. Add new resources here.
  - `src/commands.ts` — CLI arg parsing/wiring only; it should not know about HTTP or Cognito
    details beyond calling the functions above.
- **Keep files under ~300 lines.** When a file grows past that, it's usually a sign it holds
  more than one responsibility — split along the same lines as above rather than trimming
  comments/whitespace to fit.

## Testability
- Every function that makes a network call must accept `fetchImpl`/`tokenStore` as injectable
  parameters (see existing signatures) so tests can pass fakes instead of hitting the network.
- Keep pure logic (arg parsing, URL building like `withStatus`, limit capping) in small
  standalone functions so it's testable without mocking HTTP at all.
- Centralizing shared behavior (e.g. `fetchAuthorized`'s token-refresh/401-retry logic) means
  it only needs to be verified once per behavior (e.g. via `getOrders`'s 401-retry test) — new
  resource functions built on it don't need to re-test that plumbing. See Testing Guidelines below.

## Testing Guidelines
- Only write unit tests for complex/business logic (e.g. the max-10 cap on list endpoints).
- Do not write unit tests for infrastructure plumbing (token refresh/retry flow, auth-check
  guards, CLI arg-count validation) when that plumbing is generic and already covered by
  another function's tests following the same pattern (e.g. `getOrders`, `login`).

## Architecture Notes
Add important architectural decisions and patterns here.

## Backend API Contracts
This CLI talks to the `akundigital/services` backend. Its API contracts (request/response
shapes, endpoints, error codes) are documented in that repo under `docs/api/`, not in this repo.

Look them up with `gh`, e.g.:
```sh
gh api repos/akundigital/services/contents/docs/api --jq '.[].name'
gh api repos/akundigital/services/contents/docs/api/orders-list.md --jq '.content' | base64 -d
```

Check the relevant doc there before adding or changing any command that calls the API.

## Common Workflows
Document frequently used workflows and commands here.
