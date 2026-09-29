import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAIN = path.join(ROOT, "infra/aws/main.tf");
const USERDATA = path.join(ROOT, "infra/aws/user-data.sh");
const README = path.join(ROOT, "infra/aws/README.md");

test("Helix AWS rebuild uses immutable user_data, not SSM Association", () => {
  const tf = fs.readFileSync(MAIN, "utf8");
  assert.match(tf, /user_data\s*=\s*replace\s*\(\s*replace\s*\(file\("\$\{path\.module\}\/user-data\.sh"\)/s);
  assert.match(tf, /"__HELIX_REPO_URL__"/);
  assert.match(tf, /"__HELIX_SOURCE_REF__"/);
  assert.match(tf, /user_data_replace_on_change\s*=\s*true/);
  assert.doesNotMatch(tf, /AWS::SSM::Association/);
  assert.doesNotMatch(tf, /aws_ssm_association/);
  assert.match(tf, /AmazonSSMManagedInstanceCore/);
  assert.match(tf, /from_port\s*=\s*443/);
  assert.doesNotMatch(tf, /from_port\s*=\s*22/);
});

test("user-data bootstrap is deterministic and treats SSM as operational access", () => {
  const script = fs.readFileSync(USERDATA, "utf8");
  assert.match(script, /amazon-ssm-agent/);
  assert.match(script, /libvirtd/);
  assert.match(script, /helix-kvm-bootstrap\.sh/);
  assert.match(script, /operational access channel/);
  assert.doesNotMatch(script, /AWS::SSM::Association/);
});

test("AWS rebuild README forbids SSH and keeps SSM as Session Manager", () => {
  const text = fs.readFileSync(README, "utf8");
  assert.match(text, /No SSH port is opened/);
  assert.match(text, /Session Manager/);
});
