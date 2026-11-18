// Authenticating reverse proxy in front of Apollo MCP Server. No dependencies.
// Order of checks: path (404) -> Origin allow-list (403) -> bearer token (401) -> forward.
import http from "node:http";
import crypto from "node:crypto";

const TOKEN = process.env.MCP_AUTH_TOKEN ?? "";
if (TOKEN.length < 32) {
  console.error("MCP_AUTH_TOKEN must be set and at least 32 characters (see README)");
  process.exit(1);
}
const UPSTREAM = new URL(process.env.UPSTREAM_URL ?? "http://mcp:8000");
const PORT = Number(process.env.PORT ?? 8000);
const ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean)
);
const sha = (s) => crypto.createHash("sha256").update(s).digest();
const TOKEN_HASH = sha(TOKEN);

// Hash both sides so lengths are equal, then compare in constant time.
export function tokenOk(header) {
  const m = /^Bearer (\S+)$/.exec(header ?? "");
  return crypto.timingSafeEqual(sha(m ? m[1] : ""), TOKEN_HASH) && m !== null;
}

function reply(res, status, extra = {}) {
  res.writeHead(status, { "content-type": "application/json", ...extra });
  res.end(JSON.stringify({ error: http.STATUS_CODES[status] }));
}

http.createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://x");
  if (pathname !== "/mcp") return reply(res, 404);
  // Origin is absent for non-browser clients; when present it must be allow-listed (DNS-rebinding defence).
  if (req.headers.origin !== undefined && !ORIGINS.has(req.headers.origin)) return reply(res, 403);
  if (!tokenOk(req.headers.authorization)) return reply(res, 401, { "www-authenticate": 'Bearer realm="mcp"' });

  const headers = { ...req.headers, host: UPSTREAM.host };
  delete headers.authorization; // the credential stops here; upstream never sees it
  const up = http.request(
    { host: UPSTREAM.hostname, port: UPSTREAM.port, path: req.url, method: req.method, headers },
    (ur) => { res.writeHead(ur.statusCode, ur.headers); ur.pipe(res); }
  );
  up.on("error", () => { if (!res.headersSent) reply(res, 502); else res.destroy(); });
  req.pipe(up);
}).listen(PORT, "0.0.0.0", () => console.log(`mcp auth proxy on :${PORT}`));
