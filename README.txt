APOLLO MCP DEMO

What it is: a small local demo. It runs a tiny book-catalog GraphQL service and puts the Apollo MCP Server in front of it. An AI tool (like Cursor or the MCP Inspector) can then call three pre-approved book lookups as "tools". There are four hard-coded books. Nothing is stored anywhere.

What is not local: the AI tool you connect with, and the Apollo MCP Server container image, which downloads from GitHub's registry the first time. No Apollo account or password is needed.

What you need: Docker with Compose, and ports 4001 and 8000 free on your own machine. Node 22 is only needed to run the tests or the Inspector.

How to run it:
1. Make a secret token. Copy .env.example to .env, then after MCP_AUTH_TOKEN= paste the output of: openssl rand -hex 32 (at least 32 characters). The .env file is ignored by git. Never commit or share it. Docker refuses to start without it.
2. Run: docker compose up --build -d
3. Run: npm ci, then npm test. This checks the running stack.
4. To look at it, run: npx @modelcontextprotocol/inspector. Choose Streamable HTTP, enter http://127.0.0.1:8000/mcp, add the header Authorization: Bearer followed by your token, click Connect, then List Tools.
5. To stop: docker compose down.
If a port is taken, change the left-hand number in the ports lines of docker-compose.yml, and set MCP_URL and API_URL when running the tests.

What you will see: four tools. Three are the approved lookups (GetBooks, GetBookById, GetBooksByGenre). The fourth, introspect, is added automatically because introspection is switched on in mcp-config.yaml; it shows the data model. Asking for book 3 returns Kindred. If you type query-language syntax into an argument, it is treated as plain text and finds nothing. Asking for a tool that is not set up gives a "not found" error.

Security note: the MCP address now needs the token. Without it, or with a wrong one, you get 401. A web page from a site that is not on the allowed list (ALLOWED_ORIGINS) gets 403. Any address other than /mcp gets 404. A small checking program (proxy/server.mjs) sits in front and is the only way in; the Apollo MCP container itself has no published port. The book API on port 4001 still has no login. Both published ports are bound to your own machine only (127.0.0.1). It is one shared secret with no per-user logins, and no encryption, so keep it on your own machine or put it behind HTTPS before hosting it.

Tests: fifteen tests in test/stack.test.mjs. They need the stack running, so they need Docker, and they need the token (from the environment or .env). They check the data, the exact tool list, a correct lookup, that injected query text is harmless, that unconfigured tools are rejected, that the MCP port is not reachable from the network, no token or a wrong token gets 401, a right token works, a bad Origin gets 403, other paths get 404, and the Apollo container publishes no port. There is no web page here, so there are no browser tests. Not covered: heavy load, encryption, changing the token, and the book API having no login.

Choices worth knowing: the standalone MCP server is used instead of Apollo Router because there is only one simple API. The schema file is a hand-kept copy and must be updated if the API changes. Why a small checking program instead of Apollo's built-in login: the built-in one needs a separate OAuth identity provider issuing signed tokens, which is too heavy for a one-person demo. Move to it if many users are ever supported. The program removes the token before passing requests on, so the Apollo container never sees it. The MCP image is pinned to version v2.1.0 so upstream changes cannot silently change the tools.
