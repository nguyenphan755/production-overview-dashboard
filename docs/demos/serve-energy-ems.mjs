#!/usr/bin/env node
/**
 * Local static + CORS proxy for Energy EMS V2 + Machines V2 demos.
 *
 *   node docs/demos/serve-energy-ems.mjs
 *   → http://127.0.0.1:5500/mes-control-tower-100-v2.html
 *   → http://127.0.0.1:5500/mes-overview-100-v2.html
 *
 * Proxies:
 *   GET /proxy/energy    →  http://100.102.253.113:1880/api/energy
 *   GET /proxy/machines  →  http://100.102.253.113:1880/api/machines
 *
 * Why: Node-RED :1880 does not send Access-Control-Allow-Origin,
 * so browser Live fetch from file:// or another origin fails → mock.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5500;
const ENERGY_UPSTREAM = (process.env.ENERGY_UPSTREAM || "http://100.102.253.113:1880/api/energy").replace(/\/$/, "");
const MACHINES_UPSTREAM = (process.env.MACHINES_UPSTREAM || "http://100.102.253.113:1880/api/machines").replace(/\/$/, "");
const ROOT = __dirname;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  "": "application/octet-stream",
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Accept,Content-Type",
    ...headers,
  });
  res.end(body);
}

async function proxyUpstream(upstream, req, res, label) {
  if (req.method === "OPTIONS") {
    send(res, 204, "");
    return;
  }
  try {
    const upstreamRes = await fetch(upstream, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const text = await upstreamRes.text();
    send(res, upstreamRes.status, text, {
      "Content-Type": upstreamRes.headers.get("content-type") || "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
  } catch (err) {
    send(res, 502, JSON.stringify({
      success: false,
      error: { message: "Upstream " + label + " unreachable: " + (err.message || err), upstream },
    }), { "Content-Type": "application/json; charset=utf-8" });
  }
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const rel = decoded === "/" ? "/mes-control-tower-100-v2.html" : decoded;
  const full = path.normalize(path.join(root, rel));
  if (!full.startsWith(root)) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  const url = req.url || "/";
  if (url === "/proxy/energy" || url.startsWith("/proxy/energy?") || url === "/api/energy" || url.startsWith("/api/energy?")) {
    await proxyUpstream(ENERGY_UPSTREAM, req, res, "energy");
    return;
  }
  if (url === "/proxy/machines" || url.startsWith("/proxy/machines?") || url === "/api/machines" || url.startsWith("/api/machines?")) {
    await proxyUpstream(MACHINES_UPSTREAM, req, res, "machines");
    return;
  }

  const filePath = safeJoin(ROOT, url);
  if (!filePath) {
    send(res, 403, "Forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found: " + path.basename(filePath));
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, { "Content-Type": MIME[ext] || MIME[""] });
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("EMS / Machines demo server");
  console.log("  Energy UI:   http://127.0.0.1:" + PORT + "/mes-control-tower-100-v2.html");
  console.log("  Overview V2: http://127.0.0.1:" + PORT + "/mes-overview-100-v2.html");
  console.log("  Detail V2:   http://127.0.0.1:" + PORT + "/mes-equipment-detail-100-v2.html");
  console.log("  Speed Lab:   http://127.0.0.1:" + PORT + "/mes-speed-lab-100-v2.html");
  console.log("  Proxy energy:   /proxy/energy   → " + ENERGY_UPSTREAM);
  console.log("  Proxy machines: /proxy/machines → " + MACHINES_UPSTREAM);
  console.log("");
});
