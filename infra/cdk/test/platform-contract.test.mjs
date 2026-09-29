import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const network = await readFile(new URL("../lib/platform-network-stack.ts", import.meta.url), "utf8");
const postgres = await readFile(new URL("../lib/postgres-stack.ts", import.meta.url), "utf8");
const bin = await readFile(new URL("../bin/omnikali.ts", import.meta.url), "utf8");

for (const needle of [
  "10.42.0.0/16",
  "PRIVATE_ISOLATED",
  "allowedGatewayCidr",
  "5432",
  "fromGeneratedSecret",
  "multiAz: true",
  "storageEncrypted: true",
  "backupRetention: cdk.Duration.days(14)",
  "publiclyAccessible: false",
  "iamAuthentication: true",
]) assert.ok(network.includes(needle) || postgres.includes(needle), `missing platform contract: ${needle}`);

assert.ok(bin.includes("PlatformNetworkStack"));
assert.ok(bin.includes("PostgresStack"));
console.log("cdk platform contract: PASS");
