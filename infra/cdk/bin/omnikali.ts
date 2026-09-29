#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PlatformNetworkStack } from "../lib/platform-network-stack.js";
import { PostgresStack } from "../lib/postgres-stack.js";
import { ComputeStack } from "../lib/compute-stack.js";
import { GithubOidcBootstrapStack } from "../lib/github-oidc-bootstrap-stack.js";

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? "us-east-1";
const githubRepository = process.env.OMNIKALI_GITHUB_REPOSITORY;
const githubRef = process.env.OMNIKALI_GITHUB_REF ?? "refs/heads/main";
const name = process.env.OMNIKALI_NAME ?? "helix";
const allowedGatewayCidr = process.env.OMNIKALI_ALLOWED_GATEWAY_CIDR;
const helixSourceSha = process.env.OMNIKALI_HELIX_SOURCE_SHA;
const instanceType = process.env.OMNIKALI_INSTANCE_TYPE ?? "m8i.2xlarge";
const rootVolumeSize = Number(process.env.OMNIKALI_ROOT_VOLUME_SIZE ?? "80");
const persistentVolumeSize = Number(process.env.OMNIKALI_PERSISTENT_VOLUME_SIZE ?? "200");

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
if (!helixSourceSha || !/^[0-9a-f]{40}$/.test(helixSourceSha)) throw new Error("OMNIKALI_HELIX_SOURCE_SHA must be a 40-character Git commit SHA");
if (!Number.isInteger(rootVolumeSize) || rootVolumeSize < 30) throw new Error("OMNIKALI_ROOT_VOLUME_SIZE must be an integer >= 30");
if (!Number.isInteger(persistentVolumeSize) || persistentVolumeSize < 20) throw new Error("OMNIKALI_PERSISTENT_VOLUME_SIZE must be an integer >= 20");

const network = new PlatformNetworkStack(app, "OmniKaliPlatformNetwork", {
  env: { account, region },
  name,
  allowedGatewayCidr,
});
const postgres = new PostgresStack(app, "OmniKaliPostgres", {
  env: { account, region },
  name,
  network,
});
void postgres;

new ComputeStack(app, "OmniKaliCompute", {
  env: { account, region },
  name,
  network,
  helixRepoUrl: "https://github.com/onnxscibroccoli/helix.git",
  helixSourceSha,
  instanceType,
  rootVolumeSize,
  persistentVolumeSize,
});

new GithubOidcBootstrapStack(app, "OmniKaliGithubOidcBootstrap", {
  env: { account, region },
  githubRepository,
  githubRef,
});
