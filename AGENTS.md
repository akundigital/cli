# Memory

## Project Overview
See @README.md for project overview and @package.json for available npm/pnpm commands for this project.

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

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
