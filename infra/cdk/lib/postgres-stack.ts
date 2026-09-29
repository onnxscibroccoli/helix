import * as cdk from "aws-cdk-lib";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { PlatformNetworkStack } from "./platform-network-stack.js";

export interface PostgresStackProps extends cdk.StackProps {
  network: PlatformNetworkStack;
  name: string;
}

export class PostgresStack extends cdk.Stack {
  public readonly instance: rds.DatabaseInstance;

  constructor(scope: Construct, id: string, props: PostgresStackProps) {
    super(scope, id, props);

    this.instance = new rds.DatabaseInstance(this, "Postgres", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_17_9,
      }),
      vpc: props.network.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      securityGroups: [props.network.databaseSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret("helixadmin"),
      databaseName: "helix",
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      multiAz: true,
      allocatedStorage: 100,
      maxAllocatedStorage: 500,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      backupRetention: cdk.Duration.days(14),
      deletionProtection: true,
      deleteAutomatedBackups: false,
      publiclyAccessible: false,
      iamAuthentication: true,
      cloudwatchLogsExports: ["postgresql"],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "Endpoint", { value: this.instance.dbInstanceEndpointAddress });
    new cdk.CfnOutput(this, "Port", { value: this.instance.dbInstanceEndpointPort });
    new cdk.CfnOutput(this, "SecretArn", { value: this.instance.secret!.secretArn });
  }
}
