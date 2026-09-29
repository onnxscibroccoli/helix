import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";

export interface GithubOidcBootstrapStackProps extends cdk.StackProps {
  githubRepository: string;
  githubRef: string;
}

export class GithubOidcBootstrapStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: GithubOidcBootstrapStackProps) {
    super(scope, id, props);

    const provider = new iam.OidcProviderNative(this, "GithubActionsOidc", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const trustConditionKey = "token.actions.githubusercontent.com:sub";
    const subject = `repo:${props.githubRepository}:${props.githubRef.startsWith("refs/heads/") ? "ref:" + props.githubRef : "ref:" + props.githubRef}`;

    const deploymentRole = new iam.Role(this, "GithubActionsDeploymentRole", {
      roleName: "OmniKaliGithubActionsDeployment",
      description: "Short-lived GitHub Actions deployment role for OmniKali disposable/fresh accounts.",
      assumedBy: new iam.FederatedPrincipal(provider.openIdConnectProviderArn, {
        StringEquals: {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          [trustConditionKey]: subject,
        },
      }, "sts:AssumeRoleWithWebIdentity"),
      maxSessionDuration: cdk.Duration.hours(1),
      inlinePolicies: {
        BootstrapAndPlatformDeployment: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["cloudformation:*", "iam:GetRole", "iam:PassRole"],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              actions: ["sts:GetCallerIdentity"],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    deploymentRole.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    provider.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    new cdk.CfnOutput(this, "GithubDeploymentRoleArn", {
      value: deploymentRole.roleArn,
      description: "Use with GitHub Actions OIDC; do not store long-lived AWS credentials.",
    });
    new cdk.CfnOutput(this, "GithubRepositorySubject", {
      value: subject,
      description: "Exact GitHub Actions subject permitted to assume the role.",
    });
  }
}
