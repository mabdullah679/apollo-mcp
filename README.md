# Apollo MCP Demo

A local demo that puts the standalone Apollo MCP Server in front of a small GraphQL API, so an AI client can call three approved GraphQL operations as MCP tools.

Spec/requirements doc: none in this repo. Upstream docs: [Apollo MCP Server](https://www.apollographql.com/docs/apollo-mcp-server/quickstart).

```text
MCP client --MCP/HTTP--> mcp (Apollo MCP Server :8000/mcp) --GraphQL--> api (Apollo Server :4001)
                              ^ tools built from graphql/operations/*.graphql + graphql/api.graphql
```

Not local or contained: the MCP client (Inspector, Cursor, etc.) you bring, and the `ghcr.io/apollographql/apollo-mcp-server` image, pulled from GitHub's registry on first run. No GraphOS account or credentials are needed.

## Prerequisites
- Docker with Compose v2, ports 4001 and 8000 free on 127.0.0.1.
- Node 22 only for `npm test` and the optional Inspector. Not needed to run the stack.

## Run it
1. `docker compose up --build -d`
2. `npm ci && npm test` (checks the live stack, see Tests).
3. Inspect: `npx @modelcontextprotocol/inspector`, transport `Streamable HTTP`, URL `http://127.0.0.1:8000/mcp`, Connect, List Tools.
4. Stop: `docker compose down`.

Ports taken: edit the left side of the `ports:` entries in [docker-compose.yml](docker-compose.yml) and set `MCP_URL` / `API_URL` when running `npm test`.

Optional client config for `mcp-remote` clients:

```json
{ "mcpServers": { "apollo-demo": { "command": "npx", "args": ["mcp-remote", "http://127.0.0.1:8000/mcp"] } } }
```

## What it does
| Action | Result |
|---|---|
| List tools | `GetBooks`, `GetBookById`, `GetBooksByGenre`, plus `introspect` (see decisions) |
| Call `GetBookById` with `id: "3"` | Returns "Kindred" from the 4-book in-memory catalog |
| Call a tool with GraphQL syntax in an argument | Treated as a plain value; returns no match |
| Call a tool that is not configured (e.g. `execute`) | JSON-RPC "Tool not found" |

## Interface
| Endpoint | Method | Auth |
|---|---|---|
| `http://127.0.0.1:8000/mcp` | MCP Streamable HTTP (POST) | none |
| `http://127.0.0.1:4001/` | GraphQL (POST), read-only `Query` type | none |

Both are bound to loopback only in [docker-compose.yml](docker-compose.yml). There is no authentication: do not expose these ports beyond the local machine.

## Tests
`npm test` runs [test/stack.test.mjs](test/stack.test.mjs) (6 tests, Node's built-in runner) against the already-running compose stack, so it needs Docker and the image pull. It covers: API data, the exact tool list, a correct tool call, argument injection treated as data, an unconfigured tool being rejected, and the MCP port not being reachable on a LAN interface. There is no UI, so no browser tests exist. It does not cover MCP authentication (none exists) or load.

## Layout
| Path | Role |
|---|---|
| [src/server.mjs](src/server.mjs) | The GraphQL API (4 hard-coded books) |
| [graphql/operations](graphql/operations) | The approved operations that become MCP tools |
| [graphql/api.graphql](graphql/api.graphql) | Schema snapshot the MCP server reads |
| [mcp-config.yaml](mcp-config.yaml) | MCP server config: endpoint, schema, operations, transport |
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
