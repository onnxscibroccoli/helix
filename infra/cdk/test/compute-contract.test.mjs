import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const compute = await readFile(new URL("../lib/compute-stack.ts", import.meta.url), "utf8");
const bin = await readFile(new URL("../bin/omnikali.ts", import.meta.url), "utf8");

for (const needle of [
  "nestedVirtualization: true",
  "requireImdsv2: true",
  "AmazonSSMManagedInstanceCore",
  "__HELIX_REPO_URL__",
  "__HELIX_SOURCE_REF__",
  "persistentVolumeSize",
  "encrypted: true",
]) assert.ok(compute.includes(needle), `missing compute contract: ${needle}`);

assert.ok(bin.includes("ComputeStack"));
assert.ok(bin.includes("OMNIKALI_HELIX_SOURCE_SHA"));
console.log("cdk compute contract: PASS");
