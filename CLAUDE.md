# apollo-mcp (PUBLIC repo)

Local demo: Apollo MCP Server (`ghcr.io/apollographql/apollo-mcp-server:v2.1.0`) in front of a
4-book GraphQL API (`src/server.mjs`). Master rules: `~/.claude/CLAUDE.md`.

## Commands (all run 2026-11-18)
- Up: `docker compose up --build -d`; down: `docker compose down`
- Test (needs the stack up): `npm ci && npm test` -> 6 tests in `test/stack.test.mjs`
- CI (`.github/workflows/ci.yml`) runs the same: compose up, `npm test`, gitleaks.

## Rules for this repo
- Public: no local paths, usernames, emails or credentials in any file (README once had `C:\Users\...` links).
- Keep both published ports on `127.0.0.1`; there is no auth on either service. A test enforces this.
- The tool list is 4 (3 operations + built-in `introspect`), not 3. Change `mcp-config.yaml` and the test together.
- `graphql/api.graphql` is a hand-kept schema copy: edit it whenever `src/server.mjs` typeDefs change.
- No UI exists, so no Playwright; tests are protocol-level only.
