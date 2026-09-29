import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const convergence = await readFile(new URL("../lib/convergence-stack.ts", import.meta.url), "utf8");
const ansible = await readFile(new URL("../../ansible/converge-hypervisor.yml", import.meta.url), "utf8");
const inventory = await readFile(new URL("../../ansible/inventory.aws_ec2.yml", import.meta.url), "utf8");
const requirements = await readFile(new URL("../../ansible/requirements.yml", import.meta.url), "utf8");

for (const needle of [
  "BucketEncryption.KMS",
  "BLOCK_ALL",
  "enforceSSL: true",
  "enableKeyRotation: true",
  "expiration: cdk.Duration.days(1)",
]) assert.ok(convergence.includes(needle), `missing convergence CDK contract: ${needle}`);

for (const needle of [
  "amazon.aws.aws_ssm",
  "ansible_aws_ssm_bucket_name",
  "persistent-cloud-desktop",
]) assert.ok(inventory.includes(needle), `missing SSM inventory contract: ${needle}`);

assert.ok(requirements.includes('amazon.aws'));
assert.ok(ansible.includes("qemu-agent-command"));
console.log("cdk/ansible convergence contract: PASS");
