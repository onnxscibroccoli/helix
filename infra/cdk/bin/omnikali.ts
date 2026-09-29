#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PlatformNetworkStack } from "../lib/platform-network-stack.js";
import { PostgresStack } from "../lib/postgres-stack.js";
import { GithubOidcBootstrapStack } from "../lib/github-oidc-bootstrap-stack.js";

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? "us-east-1";
const githubRepository = process.env.OMNIKALI_GITHUB_REPOSITORY;
const githubRef = process.env.OMNIKALI_GITHUB_REF ?? "refs/heads/main";
const name = process.env.OMNIKALI_NAME ?? "helix";
const allowedGatewayCidr = process.env.OMNIKALI_ALLOWED_GATEWAY_CIDR;

if (!account) throw new Error("CDK_DEFAULT_ACCOUNT is required");
if (!githubRepository) throw new Error("OMNIKALI_GITHUB_REPOSITORY is required");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(githubRepository)) {
  throw new Error("OMNIKALI_GITHUB_REPOSITORY must be owner/repository");
}
if (!/^refs\/(heads|tags)\/[A-Za-z0-9_.\/-]+$/.test(githubRef)) {
  throw new Error("OMNIKALI_GITHUB_REF must be a GitHub ref such as refs/heads/main");
}
if (!name) throw new Error("OMNIKALI_NAME is required");
if (!allowedGatewayCidr) throw new Error("OMNIKALI_ALLOWED_GATEWAY_CIDR is required");

const network = new PlatformNetworkStack(app, "OmniKaliPlatformNetwork", {
  env: { account, region },
  name,
  allowedGatewayCidr,
});
new PostgresStack(app, "OmniKaliPostgres", {
  env: { account, region },
  name,
  network,
});

new GithubOidcBootstrapStack(app, "OmniKaliGithubOidcBootstrap", {
  env: { account, region },
  githubRepository,
  githubRef,
});
