import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const config = fs.readFileSync(
  new URL("../production/gateway/helix-gateway.nginx.conf", import.meta.url),
  "utf8"
);

test("edge nginx exposes the authenticated MCP bridge", () => {
  assert.match(config, /location\s+\/mcp\s*\{/);
  assert.match(config, /proxy_pass\s+http:\/\/127\.0\.0\.1:8094\/mcp\s*;/);
  assert.match(config, /proxy_set_header\s+Upgrade\s+\$http_upgrade\s*;/);
  assert.match(config, /proxy_set_header\s+Connection\s+"upgrade"\s*;/);
  assert.match(config, /proxy_buffering\s+off\s*;/);
  assert.match(config, /proxy_read_timeout\s+3600s\s*;/);
});
