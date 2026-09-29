import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const app = await readFile(new URL("../bin/omnikali.ts", import.meta.url), "utf8");
const stack = await readFile(new URL("../lib/github-oidc-bootstrap-stack.ts", import.meta.url), "utf8");

for (const needle of [
  "OMNIKALI_GITHUB_REPOSITORY",
  "OMNIKALI_GITHUB_REF",
  "token.actions.githubusercontent.com",
  "sts.amazonaws.com",
  "GithubActionsDeploymentRole",
  "RETAIN",
]) assert.ok(app.includes(needle) || stack.includes(needle), `missing CDK bootstrap contract: ${needle}`);

assert.ok(stack.includes("token.actions.githubusercontent.com:sub"));
assert.ok(stack.includes("repo:${props.githubRepository}"));
console.log("cdk bootstrap synthesis contract: PASS");
