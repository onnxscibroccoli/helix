#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { GithubOidcBootstrapStack } from "../lib/github-oidc-bootstrap-stack.js";

const app = new cdk.App();

const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? "us-east-1";
const githubRepository = process.env.OMNIKALI_GITHUB_REPOSITORY;
const githubRef = process.env.OMNIKALI_GITHUB_REF ?? "refs/heads/main";

if (!account) throw new Error("CDK_DEFAULT_ACCOUNT is required");
if (!githubRepository) throw new Error("OMNIKALI_GITHUB_REPOSITORY is required");
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(githubRepository)) {
  throw new Error("OMNIKALI_GITHUB_REPOSITORY must be owner/repository");
}
if (!/^refs\/(heads|tags)\/[A-Za-z0-9_.\/-]+$/.test(githubRef)) {
  throw new Error("OMNIKALI_GITHUB_REF must be a GitHub ref such as refs/heads/main");
}

new GithubOidcBootstrapStack(app, "OmniKaliGithubOidcBootstrap", {
  env: { account, region },
  githubRepository,
  githubRef,
});
