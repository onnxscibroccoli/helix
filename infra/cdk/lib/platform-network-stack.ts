import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export interface PlatformNetworkStackProps extends cdk.StackProps {
  name: string;
  allowedGatewayCidr: string;
}

export class PlatformNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly gatewaySecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: PlatformNetworkStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: `${props.name}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr("10.42.0.0/16"),
      availabilityZones: ["us-east-1a", "us-east-1b"],
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "database", subnetType: ec2.SubnetType.PRIVATE_ISOLATED, cidrMask: 24 },
      ],
      enableDnsHostnames: true,
      enableDnsSupport: true,
    });

    this.gatewaySecurityGroup = new ec2.SecurityGroup(this, "GatewaySecurityGroup", {
      vpc: this.vpc,
      description: "Helix authenticated gateway ingress",
      allowAllOutbound: true,
    });
    this.gatewaySecurityGroup.addIngressRule(
      ec2.Peer.ipv4(props.allowedGatewayCidr),
      ec2.Port.tcp(443),
      "Explicit HTTPS gateway CIDR",
    );

    this.databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc: this.vpc,
      description: "Private PostgreSQL ingress from Helix gateway only",
      allowAllOutbound: true,
    });
    this.databaseSecurityGroup.addIngressRule(
      this.gatewaySecurityGroup,
      ec2.Port.tcp(5432),
      "PostgreSQL from Helix gateway",
    );

    new cdk.CfnOutput(this, "VpcId", { value: this.vpc.vpcId });
    new cdk.CfnOutput(this, "GatewaySecurityGroupId", { value: this.gatewaySecurityGroup.securityGroupId });
    new cdk.CfnOutput(this, "DatabaseSecurityGroupId", { value: this.databaseSecurityGroup.securityGroupId });
  }
}
