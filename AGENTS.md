# Memory

## Project Overview
See @README.md for project overview and @package.json for available npm/pnpm commands for this project.

## Code Style Guidelines
- Use descriptive variable names
- Follow existing patterns in the codebase
- Extract complex conditions into meaningful boolean variables

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
