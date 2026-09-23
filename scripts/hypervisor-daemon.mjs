#!/usr/bin/env node
/**
 * Helix native Amazon DCV launch broker.
 *
 * Local API: 127.0.0.1:3000
 * Token verifier: 127.0.0.1:8080
 * Display: Amazon DCV HTTPS :8443
 *
 * This daemon intentionally exposes no public listener. The authenticated Helix
 * gateway/control plane must invoke it through a private host-side channel.
 */
import { createServer } from "node:http";
import { URL, URLSearchParams } from "node:url";

const HOST = "127.0.0.1";
const PORT = Number(process.env.DAEMON_PORT || 3000);
const DCV_VERIFIER_URL =
  process.env.DCV_VERIFIER_URL || "http://127.0.0.1:8080/create-token";
const DCV_SESSION = process.env.DCV_SESSION || "helix-workspace";
const DCV_USER = process.env.DCV_USER || "helix";
const TOKEN_TTL_SECONDS = Math.max(
  15,
  Math.min(Number(process.env.DCV_TOKEN_TTL_SECONDS || 60), 300),
);
const FALLBACK_PUBLIC_IP = process.env.FALLBACK_PUBLIC_IP || "";
const BROKER_SECRET = process.env.HELIX_SHARED_SECRET || "";

function json(res, code, value) {
  const data = JSON.stringify(value);
  res.writeHead(code, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(data),
    "cache-control": "no-store",
  });
  res.end(data);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getPublicIP() {
  try {
    const tokenRes = await fetchWithTimeout(
      "http://169.254.169.254/latest/api/token",
      {
        method: "PUT",
        headers: { "X-aws-ec2-metadata-token-ttl-seconds": "60" },
      },
    );
    if (!tokenRes.ok) throw new Error(`IMDSv2 token status ${tokenRes.status}`);
    const token = (await tokenRes.text()).trim();

    const ipRes = await fetchWithTimeout(
      "http://169.254.169.254/latest/meta-data/public-ipv4",
      { headers: { "X-aws-ec2-metadata-token": token } },
    );
    if (!ipRes.ok) throw new Error(`IMDSv2 IP status ${ipRes.status}`);
    return (await ipRes.text()).trim();
  } catch (error) {
    if (FALLBACK_PUBLIC_IP) return FALLBACK_PUBLIC_IP;
    throw new Error(`public IP discovery failed: ${error.message}`);
  }
}

function sslipHost(ip) {
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip)) throw new Error("invalid public IPv4");
  return `${ip.replaceAll(".", "-")}.sslip.io`;
}

function authorized(req) {
  // Loopback binding is the primary boundary. If a shared secret is configured,
  // require it as an additional defense in depth.
  if (!BROKER_SECRET) return true;
  return req.headers.authorization === `Bearer ${BROKER_SECRET}`;
}

async function issueLaunch() {
  const params = new URLSearchParams({
    user: DCV_USER,
    session: DCV_SESSION,
    ttl: String(TOKEN_TTL_SECONDS),
  });
  const verifierRes = await fetchWithTimeout(DCV_VERIFIER_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!verifierRes.ok) throw new Error(`dcv-verifier status ${verifierRes.status}`);

  const token = await verifierRes.json();
  if (!token.authToken || token.sessionId !== DCV_SESSION) {
    throw new Error("invalid dcv-verifier response");
  }

  const host = sslipHost(await getPublicIP());
  const launchUrl =
    `https://${host}:8443/?authToken=${encodeURIComponent(token.authToken)}#` +
    encodeURIComponent(DCV_SESSION);

  return {
    status: "ok",
    launchUrl,
    expiresIn: token.expiresIn || TOKEN_TTL_SECONDS,
    host,
    sessionId: DCV_SESSION,
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return json(res, 200, { ok: true, transport: "dcv", sessionId: DCV_SESSION });
  }

  if (req.method === "POST" && url.pathname === "/api/v1/session/launch") {
    if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
    try {
      const launch = await issueLaunch();
      console.log(`[dcv-launch] issued single-use launch for ${DCV_USER}`);
      return json(res, 200, launch);
    } catch (error) {
      console.error("[dcv-launch]", error);
      return json(res, 502, { error: "failed to issue DCV launch" });
    }
  }

  return json(res, 404, { error: "not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`[helix-dcv-broker] http://${HOST}:${PORT} -> ${DCV_VERIFIER_URL}`);
});
