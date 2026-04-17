# Apollo MCP Demo

This folder sets up the same core architecture Apollo demonstrates for MCP:

1. a normal GraphQL API,
2. an Apollo MCP Server in front of it,
3. a small allowlist of GraphQL operations that become MCP tools.

This version uses the standalone Apollo MCP Server container instead of the `rover init --mcp` wizard because it is simpler to run locally without GraphOS credentials.

## What gets started

- `api`: a tiny Apollo Server on `http://localhost:4001/`
- `mcp`: Apollo MCP Server on `http://localhost:8000/mcp`

## Run it

```powershell
cd C:\Users\muham\Documents\apollo-mcp
npm install
docker compose up --build
```

In a second terminal, inspect the MCP server:

```powershell
npx @modelcontextprotocol/inspector
```

Then open the Inspector URL it prints, choose:

- Transport Type: `Streamable HTTP`
- URL: `http://127.0.0.1:8000/mcp`

Click `Connect`, then `List Tools`.

You should see MCP tools derived from:

- `GetBooks`
- `GetBookById`
- `GetBooksByGenre`

## Optional client config

For MCP clients that use `mcp-remote`, the local config shape is:

```json
{
  "mcpServers": {
    "apollo-demo": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://127.0.0.1:8000/mcp"
      ]
    }
  }
}
```

## What's actually happening

The GraphQL API is still the real data service. It knows the schema, resolves fields, and returns JSON for GraphQL queries.

Apollo MCP Server does not replace that API. It sits in front of it and translates approved GraphQL operations into MCP tools that an AI client can discover and call.

The important files are:

- [mcp-config.yaml](C:/Users/muham/Documents/apollo-mcp/mcp-config.yaml): tells Apollo MCP Server where the GraphQL endpoint lives, where the schema file is, where the allowed operations live, and how to expose MCP over HTTP.
- [graphql/api.graphql](C:/Users/muham/Documents/apollo-mcp/graphql/api.graphql): schema snapshot used by Apollo MCP Server so it can describe tools correctly.
- [graphql/operations/GetBooks.graphql](C:/Users/muham/Documents/apollo-mcp/graphql/operations/GetBooks.graphql): one approved query that becomes one MCP tool.
- [src/server.mjs](C:/Users/muham/Documents/apollo-mcp/src/server.mjs): the actual GraphQL API implementation.
- [docker-compose.yml](C:/Users/muham/Documents/apollo-mcp/docker-compose.yml): runs both services together on one local network.

The request flow is:

1. Your MCP client connects to `http://localhost:8000/mcp`.
2. Apollo MCP Server advertises tools based on the `.graphql` operation files.
3. The client calls one of those tools with arguments.
4. Apollo MCP Server converts that tool call back into the underlying GraphQL operation.
5. Apollo MCP Server sends that GraphQL request to `http://api:4001/`.
6. The GraphQL API executes the query and returns data.
7. Apollo MCP Server returns the result to the MCP client in MCP format.

## Why there is no router here

Apollo Router is useful when:

- you are serving a federated supergraph,
- you want Apollo's GraphOS-managed runtime,
- or you want GraphQL and MCP bundled in Apollo Runtime.

For a simple local demo with one existing GraphQL API, Apollo's own deployment docs support using the standalone Apollo MCP Server container directly against that endpoint. That is what this project uses.

## Sources

- Apollo MCP Server quickstart: https://www.apollographql.com/docs/apollo-mcp-server/quickstart
- Apollo MCP Server config reference: https://www.apollographql.com/docs/apollo-mcp-server/command-reference
- Apollo MCP Server deploy docs: https://www.apollographql.com/docs/apollo-mcp-server/deploy
- Apollo MCP Server debugging docs: https://www.apollographql.com/docs/apollo-mcp-server/debugging
