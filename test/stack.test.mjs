// Staging test: runs against the live docker compose stack (`docker compose up --build -d`).
// Run: npm test   (override with API_URL / MCP_URL). No UI exists, so this is an API/protocol test.
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";

const API = process.env.API_URL ?? "http://127.0.0.1:4001/";
const MCP = process.env.MCP_URL ?? "http://127.0.0.1:8000/mcp";

async function rpc(body) {
  const res = await fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body })
  });
  const text = await res.text();
  const line = text.split("\n").find((l) => l.startsWith("data:"));
  return JSON.parse(line ? line.slice(5) : text);
}
const call = (name, args) => rpc({ method: "tools/call", params: { name, arguments: args } });
const payload = (r) => JSON.parse(r.result.content[0].text);

test("GraphQL API returns the 4 seeded books", async () => {
  const r = await fetch(API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: "{ books { id } }" })
  });
  assert.equal((await r.json()).data.books.length, 4);
});

test("MCP exposes exactly the 3 approved operations plus the built-in introspect tool", async () => {
  const names = (await rpc({ method: "tools/list" })).result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["GetBookById", "GetBooks", "GetBooksByGenre", "introspect"]);
});

test("tool call returns the right book", async () => {
  const d = payload(await call("GetBookById", { id: "3" }));
  assert.equal(d.data.bookById.title, "Kindred");
});

test("GraphQL break-out text in an argument is treated as data, not query", async () => {
  const d = payload(await call("GetBookById", { id: '1") { id } __schema { types { name } } #' }));
  assert.deepEqual(d, { data: { bookById: null } });
});

test("a tool that is not configured cannot be called", async () => {
  const r = await call("execute", { query: "{ books { id } }" });
  assert.match(r.error.message, /not found/i);
});

test("MCP port is not reachable on a non-loopback interface", async (t) => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .find((i) => i && i.family === "IPv4" && !i.internal);
  if (!lan) return t.skip("no non-loopback interface on this machine");
  const reachable = await new Promise((resolve) => {
    const s = net.connect({ host: lan.address, port: 8000, timeout: 2000 });
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
  assert.equal(reachable, false, `MCP is exposed on ${lan.address}:8000 with no authentication`);
});
