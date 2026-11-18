// Staging test: runs against the live docker compose stack (`docker compose up --build -d`).
// Run: npm test   (override with API_URL / MCP_URL). No UI exists, so this is an API/protocol test.
import { test } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import os from "node:os";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

// Token comes from the environment, else from the git-ignored .env that compose also reads. Never hard-coded.
function loadToken() {
  if (process.env.MCP_AUTH_TOKEN) return process.env.MCP_AUTH_TOKEN;
  try {
    const m = fs.readFileSync(new URL("../.env", import.meta.url), "utf8").match(/^MCP_AUTH_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  } catch {}
  throw new Error("MCP_AUTH_TOKEN not set (export it or put it in .env); see README");
}
const TOKEN = loadToken();

const API = process.env.API_URL ?? "http://127.0.0.1:4001/";
const MCP = process.env.MCP_URL ?? "http://127.0.0.1:8000/mcp";

const raw = (headers = {}, body = { method: "tools/list" }) =>
  fetch(MCP, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body })
  });
const bearer = (t = TOKEN) => ({ authorization: `Bearer ${t}` });

async function rpc(body) {
  const res = await raw(bearer(), body);
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

test("MCP port is not reachable on a non-loopback interface (even with a valid token)", async (t) => {
  const lan = Object.values(os.networkInterfaces()).flat()
    .find((i) => i && i.family === "IPv4" && !i.internal);
  if (!lan) return t.skip("no non-loopback interface on this machine");
  const reachable = await new Promise((resolve) => {
    const s = net.connect({ host: lan.address, port: 8000, timeout: 2000 });
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => resolve(false));
    s.on("timeout", () => { s.destroy(); resolve(false); });
  });
  assert.equal(reachable, false, `MCP is exposed on ${lan.address}:8000 beyond loopback`);
});

test("no Authorization header -> 401 with a Bearer challenge", async () => {
  const r = await raw();
  assert.equal(r.status, 401);
  assert.match(r.headers.get("www-authenticate") ?? "", /^Bearer/);
});

test("wrong token -> 401 (same length, shorter, longer, wrong scheme)", async () => {
  for (const h of [
    bearer("x".repeat(TOKEN.length)),
    bearer(TOKEN.slice(0, -1)),
    bearer(TOKEN + "x"),
    bearer(""),
    { authorization: `Basic ${TOKEN}` },
    { authorization: TOKEN }
  ]) assert.equal((await raw(h)).status, 401, JSON.stringify(h).replace(TOKEN, "<tok>"));
});

test("valid token -> tools/list works (200)", async () => {
  const r = await raw(bearer());
  assert.equal(r.status, 200);
});

test("disallowed Origin is rejected 403, even with a valid token", async () => {
  const r = await raw({ ...bearer(), origin: "https://evil.example" });
  assert.equal(r.status, 403);
});

test("allow-listed Origin with a valid token is accepted", async () => {
  const r = await raw({ ...bearer(), origin: "http://localhost:6274" });
  assert.equal(r.status, 200);
});

test("allow-listed Origin without a token is still 401", async () => {
  assert.equal((await raw({ origin: "http://localhost:6274" })).status, 401);
});

test("paths other than /mcp are not proxied (404, auth or not)", async () => {
  const url = new URL(MCP); url.pathname = "/health";
  for (const h of [{}, bearer()]) assert.equal((await fetch(url, { headers: h })).status, 404);
});

test("upstream MCP container publishes no host port (only the proxy does)", () => {
  const out = execFileSync("docker", ["compose", "ps", "--format", "json"], { encoding: "utf8" });
  const rows = out.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const mcp = rows.find((r) => r.Service === "mcp");
  assert.ok(mcp, "mcp service not running");
  assert.deepEqual((mcp.Publishers ?? []).filter((p) => p.PublishedPort), []);
  const proxy = rows.find((r) => r.Service === "proxy");
  assert.ok(proxy, "proxy service not running");
  assert.ok((proxy.Publishers ?? []).some((p) => p.PublishedPort === 8000 && p.URL === "127.0.0.1"));
});

test("the token never appears in the upstream MCP container's logs", () => {
  const logs = execFileSync("docker", ["compose", "logs", "mcp"], { encoding: "utf8" });
  assert.ok(!logs.includes(TOKEN));
});
