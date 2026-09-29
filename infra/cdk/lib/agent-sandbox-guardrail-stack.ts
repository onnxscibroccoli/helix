import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface AgentSandboxGuardrailStackProps extends cdk.StackProps {
  productionAccountId: string;
}

export class AgentSandboxGuardrailStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AgentSandboxGuardrailStackProps) {
    super(scope, id, props);

    const accountId = cdk.Stack.of(this).account;
    if (!/^\\d{12}$/.test(props.productionAccountId)) {
      throw new Error("productionAccountId must be a 12-digit AWS account ID");
    }
    if (accountId === props.productionAccountId) {
      throw new Error("Agent sandbox guardrail cannot target production");
    }

    const boundaryArn = "arn:aws:iam::" + accountId + ":policy/OmniKaliAgentSandboxBoundary";
    const boundary = new iam.ManagedPolicy(this, "AgentPermissionsBoundary", {
      managedPolicyName: "OmniKaliAgentSandboxBoundary",
      description: "Maximum permissions for autonomous agents in the isolated sandbox account.",
      statements: [
        new iam.PolicyStatement({ effect: iam.Effect.ALLOW, actions: ["*"], resources: ["*"] }),
        new iam.PolicyStatement({
          sid: "DenyOrganizationControlPlane",
          effect: iam.Effect.DENY,
          actions: ["organizations:*", "account:*", "billing:*", "ce:*", "cur:*", "purchase-orders:*", "savingsplans:*", "support:*"],
          resources: ["*"],
        }),
        new iam.PolicyStatement({
          sid: "DenyCrossAccountRoleAssumption",
          effect: iam.Effect.DENY,
          actions: ["sts:AssumeRole"],
          resources: ["arn:aws:iam::*:role/*"],
          conditions: { StringNotEquals: { "aws:ResourceAccount": accountId } },
        }),
        new iam.PolicyStatement({
          sid: "RequireSandboxBoundary",
          effect: iam.Effect.DENY,
          actions: ["iam:CreateRole", "iam:CreateUser"],
          resources: ["*"],
          conditions: { StringNotEquals: { "iam:PermissionsBoundary": boundaryArn } },
        }),
        new iam.PolicyStatement({
          sid: "ProtectBoundary",
          effect: iam.Effect.DENY,
          actions: ["iam:DeletePolicy", "iam:CreatePolicyVersion", "iam:SetDefaultPolicyVersion", "iam:DeletePolicyVersion", "iam:DeleteRolePermissionsBoundary", "iam:DeleteUserPermissionsBoundary"],
          resources: [boundaryArn, "arn:aws:iam::" + accountId + ":role/*", "arn:aws:iam::" + accountId + ":user/*"],
        }),
        new iam.PolicyStatement({
          sid: "DenyProductionRoles",
          effect: iam.Effect.DENY,
          actions: ["sts:AssumeRole"],
          resources: ["arn:aws:iam::" + props.productionAccountId + ":role/*"],
        }),
      ],
    });

    const agentRole = new iam.Role(this, "AgentSandboxRole", {
      roleName: "OmniKaliAgentSandbox",
      path: "/agent-sandbox/",
      assumedBy: new iam.AccountPrincipal(accountId),
      permissionsBoundary: boundary,
      maxSessionDuration: cdk.Duration.hours(1),
      inlinePolicies: {
        SandboxAdministrator: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({ effect: iam.Effect.ALLOW, actions: ["*"], resources: ["*"] }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["sts:GetCallerIdentity", "sts:AssumeRole"],
              resources: ["arn:aws:iam::" + accountId + ":role/*"],
            }),
          ],
        }),
      },
    });

    new cdk.CfnOutput(this, "SandboxAgentRoleArn", { value: agentRole.roleArn });
    new cdk.CfnOutput(this, "SandboxAccountId", { value: accountId });
    new cdk.CfnOutput(this, "ProductionAccountIsolation", { value: props.productionAccountId });
  }
}
