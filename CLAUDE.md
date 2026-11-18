# apollo-mcp (PUBLIC repo)

Local demo: Apollo MCP Server (`ghcr.io/apollographql/apollo-mcp-server:v2.1.0`) in front of a
4-book GraphQL API (`src/server.mjs`). Master rules: `~/.claude/CLAUDE.md`.

## Commands (all run 2026-11-18)
- Up: `docker compose up --build -d`; down: `docker compose down`
- Test (needs the stack up): `npm ci && npm test` -> 15 tests in `test/stack.test.mjs`; needs `MCP_AUTH_TOKEN` (env or git-ignored `.env`, see `.env.example`; compose refuses to start without it)
- CI (`.github/workflows/ci.yml`) runs the same with a random per-run token (masked): compose up, `npm test`, gitleaks.

## Rules for this repo
- Public: no local paths, usernames, emails or credentials in any file (README once had `C:\Users\...` links).
- Keep both published ports on `127.0.0.1`. `:8000/mcp` is the auth proxy (`proxy/server.mjs`: bearer token, constant-time compare, Origin allow-list); the `mcp` service must publish NO port (a test checks `docker compose ps`). The GraphQL API on :4001 has no auth (loopback only).
- Never commit or print a real token: `.env` is git-ignored, `.env.example` is placeholder-only.
- Why a proxy, not native auth: Apollo MCP Server's `transport.auth` needs an external OAuth2 server and JWTs; too heavy for a demo. Revisit before multi-user hosting.
- The tool list is 4 (3 operations + built-in `introspect`), not 3. Change `mcp-config.yaml` and the test together.
- `graphql/api.graphql` is a hand-kept schema copy: edit it whenever `src/server.mjs` typeDefs change.
- No UI exists, so no Playwright; tests are protocol-level only.
