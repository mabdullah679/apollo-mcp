APOLLO MCP DEMO

What it is: a small local demo. It runs a tiny book-catalog GraphQL service and puts the Apollo MCP Server in front of it. An AI tool (like Cursor or the MCP Inspector) can then call three pre-approved book lookups as "tools". There are four hard-coded books. Nothing is stored anywhere.

What is not local: the AI tool you connect with, and the Apollo MCP Server container image, which downloads from GitHub's registry the first time. No Apollo account or password is needed.

What you need: Docker with Compose, and ports 4001 and 8000 free on your own machine. Node 22 is only needed to run the tests or the Inspector.

How to run it:
1. Run: docker compose up --build -d
2. Run: npm ci, then npm test. This checks the running stack.
3. To look at it, run: npx @modelcontextprotocol/inspector. Choose Streamable HTTP, enter http://127.0.0.1:8000/mcp, click Connect, then List Tools.
4. To stop: docker compose down.
If a port is taken, change the left-hand number in the ports lines of docker-compose.yml, and set MCP_URL and API_URL when running the tests.

What you will see: four tools. Three are the approved lookups (GetBooks, GetBookById, GetBooksByGenre). The fourth, introspect, is added automatically because introspection is switched on in mcp-config.yaml; it shows the data model. Asking for book 3 returns Kindred. If you type query-language syntax into an argument, it is treated as plain text and finds nothing. Asking for a tool that is not set up gives a "not found" error.

Security note: neither service has a login. Both ports are bound to your own machine only (127.0.0.1) so other computers on your network cannot reach them. Do not expose them to the internet.

Tests: six tests in test/stack.test.mjs. They need the stack running, so they need Docker. They check the data, the exact tool list, a correct lookup, that injected query text is harmless, that unconfigured tools are rejected, and that the MCP port is not reachable from the network. There is no web page here, so there are no browser tests. Login security is not tested because there is no login.

Choices worth knowing: the standalone MCP server is used instead of Apollo Router because there is only one simple API. The schema file is a hand-kept copy and must be updated if the API changes. The MCP image is pinned to version v2.1.0 so upstream changes cannot silently change the tools.
