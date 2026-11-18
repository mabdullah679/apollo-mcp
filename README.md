# Apollo MCP Demo

A local demo that puts the standalone Apollo MCP Server in front of a small GraphQL API, so an AI client can call three approved GraphQL operations as MCP tools.

Spec/requirements doc: none in this repo. Upstream docs: [Apollo MCP Server](https://www.apollographql.com/docs/apollo-mcp-server/quickstart).

```text
MCP client --MCP/HTTP + Bearer--> proxy (:8000/mcp) --> mcp (Apollo MCP Server, internal) --GraphQL--> api (Apollo Server :4001)
                                                          ^ tools built from graphql/operations/*.graphql + graphql/api.graphql
```

Not local or contained: the MCP client (Inspector, Cursor, etc.) you bring, and the `ghcr.io/apollographql/apollo-mcp-server` image, pulled from GitHub's registry on first run. No GraphOS account or credentials are needed.

## Prerequisites
- Docker with Compose v2, ports 4001 and 8000 free on 127.0.0.1.
- Node 22 only for `npm test` and the optional Inspector. Not needed to run the stack.

## Run it
1. Create the token (git-ignored `.env`; compose refuses to start without it):
   `cp .env.example .env`, then put the output of `openssl rand -hex 32` after `MCP_AUTH_TOKEN=` (min 32 characters). Never commit it.
2. `docker compose up --build -d`
3. `npm ci && npm test` (checks the live stack, see Tests).
4. Inspect: `npx @modelcontextprotocol/inspector`, transport `Streamable HTTP`, URL `http://127.0.0.1:8000/mcp`, add header `Authorization: Bearer <your token>`, Connect, List Tools.
5. Stop: `docker compose down`.

Ports taken: edit the left side of the `ports:` entries in [docker-compose.yml](docker-compose.yml) and set `MCP_URL` / `API_URL` when running `npm test`.

Optional client config for `mcp-remote` clients:

```json
{ "mcpServers": { "apollo-demo": { "command": "npx", "args": ["mcp-remote", "http://127.0.0.1:8000/mcp", "--header", "Authorization:Bearer ${MCP_AUTH_TOKEN}"], "env": { "MCP_AUTH_TOKEN": "<your token>" } } } }
```

## What it does
| Action | Result |
|---|---|
| List tools | `GetBooks`, `GetBookById`, `GetBooksByGenre`, plus `introspect` (see decisions) |
| Call `GetBookById` with `id: "3"` | Returns "Kindred" from the 4-book in-memory catalog |
| Call a tool with GraphQL syntax in an argument | Treated as a plain value; returns no match |
| Call a tool that is not configured (e.g. `execute`) | JSON-RPC "Tool not found" |
| Call `/mcp` with no or a wrong token | HTTP 401 with `WWW-Authenticate: Bearer` |
| Call `/mcp` with a browser `Origin` not in `ALLOWED_ORIGINS` | HTTP 403 (checked before the token) |
| Call any path other than `/mcp` | HTTP 404 |

## Interface
| Endpoint | Method | Auth |
|---|---|---|
| `http://127.0.0.1:8000/mcp` | MCP Streamable HTTP (POST) | `Authorization: Bearer <MCP_AUTH_TOKEN>` |
| `http://127.0.0.1:4001/` | GraphQL (POST), read-only `Query` type | none |

Both published ports are bound to loopback in [docker-compose.yml](docker-compose.yml). The upstream `mcp` container publishes no port at all; it is only reachable through the proxy. The GraphQL API on :4001 has no authentication: do not expose it beyond the local machine. `ALLOWED_ORIGINS` (comma-separated, default is MCP Inspector on port 6274) is set in `.env`.

## Tests
`npm test` (needs `MCP_AUTH_TOKEN` in the environment or `.env`) runs [test/stack.test.mjs](test/stack.test.mjs) (15 tests, Node's built-in runner) against the already-running compose stack, so it needs Docker and the image pull. It covers: API data, the exact tool list, a correct tool call, argument injection treated as data, an unconfigured tool being rejected, the MCP port not being reachable on a LAN interface, and authentication: no token and wrong tokens (401), a valid token (200), a bad Origin (403), non-`/mcp` paths (404), and the upstream container publishing no port. There is no UI, so no browser tests exist. It does not cover load, TLS (none; loopback only), token rotation, or the GraphQL API's lack of auth.

## Layout
| Path | Role |
|---|---|
| [src/server.mjs](src/server.mjs) | The GraphQL API (4 hard-coded books) |
| [graphql/operations](graphql/operations) | The approved operations that become MCP tools |
| [graphql/api.graphql](graphql/api.graphql) | Schema snapshot the MCP server reads |
| [proxy/server.mjs](proxy/server.mjs) | Auth proxy: Origin allow-list, bearer token (constant-time), forwards `/mcp` only |
| [Dockerfile.proxy](Dockerfile.proxy) | Proxy image (non-root, no dependencies) |
| [.env.example](.env.example) | Placeholder-only env template (real `.env` is git-ignored) |
| [mcp-config.yaml](mcp-config.yaml) | MCP server config: endpoint, schema, operations, transport, Host allow-list |
| [docker-compose.yml](docker-compose.yml) | Runs `api` and `mcp` together |
| [Dockerfile.api](Dockerfile.api) | API image (runs as non-root `node`) |
| [diagrams](diagrams) | Mermaid sources: [architecture](diagrams/architecture.mmd), [request flow](diagrams/request-flow.mmd) |
| [test/stack.test.mjs](test/stack.test.mjs) | Stack tests |
| [CLAUDE.md](CLAUDE.md) | Notes for AI sessions |

## Design decisions
- Standalone MCP server, not Apollo Router: the demo has one plain GraphQL API and no supergraph, so the router would add GraphOS setup for nothing.
- `introspection.introspect.enabled: true` in [mcp-config.yaml](mcp-config.yaml) adds a fourth `introspect` tool that returns schema text. That is why the tool list is 4, not 3. Turn it off there if you want strictly the allowlist.
- The schema is a file copy ([graphql/api.graphql](graphql/api.graphql)), not introspected live; it must be edited by hand when [src/server.mjs](src/server.mjs) changes.
- MCP image pinned to `v2.1.0`, not `latest`, so an upstream change cannot silently alter the tools.
- Auth proxy instead of Apollo MCP Server's native `transport.auth`: the native option validates OAuth2 JWTs from an external authorization server (JWKS discovery, `kid`/`exp`/`sub` claims) and passes them to the GraphQL API; a demo with one user would need an identity provider just to run. A shared bearer token behind a ~50-line dependency-free proxy is the smallest thing that is genuinely secure on loopback or behind TLS. It is a single shared secret: no per-user identity, scopes or revocation; move to native OAuth2 for multi-user hosting. The upstream also has its own Host check (`allowed_hosts: mcp:8000`) and the proxy does the Origin check.
- The proxy strips the `Authorization` header before forwarding, so the token never reaches the upstream.
