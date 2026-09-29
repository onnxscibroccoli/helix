import * as cdk from "aws-cdk-lib";
import * as kms from "aws-cdk-lib/aws-kms";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export interface ConvergenceStackProps extends cdk.StackProps {
  name: string;
}

export class ConvergenceStack extends cdk.Stack {
  public readonly artifactBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: ConvergenceStackProps) {
    super(scope, id, props);

    const key = new kms.Key(this, "ConvergenceKey", {
      alias: `alias/${props.name}-convergence`,
      enableKeyRotation: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.artifactBucket = new s3.Bucket(this, "SsmArtifactBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key,
      enforceSSL: true,
      versioned: false,
      lifecycleRules: [{ expiration: cdk.Duration.days(1) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    new cdk.CfnOutput(this, "ArtifactBucketName", { value: this.artifactBucket.bucketName });
    new cdk.CfnOutput(this, "KmsKeyArn", { value: key.keyArn });
  }
}
