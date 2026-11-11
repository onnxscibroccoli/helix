#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { AgentSandboxGuardrailStack } from "../lib/agent-sandbox-guardrail-stack.js";

const app = new cdk.App();
const account = process.env.CDK_DEFAULT_ACCOUNT;
const region = process.env.CDK_DEFAULT_REGION ?? "us-east-1";
const sandboxAccount = process.env.OMNIKALI_SANDBOX_ACCOUNT_ID;
const productionAccount = process.env.OMNIKALI_PRODUCTION_ACCOUNT_ID;

if (!account) throw new Error("CDK_DEFAULT_ACCOUNT is required");
if (!sandboxAccount) throw new Error("OMNIKALI_SANDBOX_ACCOUNT_ID is required");
if (!productionAccount) throw new Error("OMNIKALI_PRODUCTION_ACCOUNT_ID is required");
if (account !== sandboxAccount) throw new Error("Refusing sandbox stack: current account is not the sandbox account");
if (sandboxAccount === productionAccount) throw new Error("Sandbox and production accounts must differ");

new AgentSandboxGuardrailStack(app, "OmniKaliAgentSandboxGuardrail", {
  env: { account, region },
  productionAccountId: productionAccount,
});
