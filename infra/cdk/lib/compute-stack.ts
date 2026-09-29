import * as fs from "node:fs";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
import { PlatformNetworkStack } from "./platform-network-stack.js";

export interface ComputeStackProps extends cdk.StackProps {
  network: PlatformNetworkStack;
  name: string;
  helixRepoUrl: string;
  helixSourceSha: string;
  instanceType: string;
  rootVolumeSize: number;
  persistentVolumeSize: number;
}

export class ComputeStack extends cdk.Stack {
  public readonly instance: ec2.CfnInstance;

  constructor(scope: Construct, id: string, props: ComputeStackProps) {
    super(scope, id, props);

    const role = new iam.Role(this, "HelixHostRole", {
      roleName: `${props.name}-ssm-role`,
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
      ],
    });

    const userData = fs.readFileSync(
      new URL("../../aws/user-data.sh", import.meta.url),
      "utf8",
    )
      .replaceAll("__HELIX_REPO_URL__", props.helixRepoUrl)
      .replaceAll("__HELIX_SOURCE_REF__", props.helixSourceSha);

    const launchTemplate = new ec2.LaunchTemplate(this, "LaunchTemplate", {
      launchTemplateName: `${props.name}-kvm`,
      instanceType: new ec2.InstanceType(props.instanceType),
      machineImage: ec2.MachineImage.fromSsmParameter(
        "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id",
      ),
      role,
      securityGroup: props.network.gatewaySecurityGroup,
      associatePublicIpAddress: true,
      requireImdsv2: true,
      cpuOptions: { nestedVirtualization: true },
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(props.rootVolumeSize, {
            encrypted: true,
            volumeType: ec2.EbsDeviceVolumeType.GP3,
            deleteOnTermination: true,
          }),
        },
      ],
      userData: ec2.UserData.custom(userData),
      versionDescription: props.helixSourceSha,
    });

    const subnet = props.network.vpc.publicSubnets[0];
    this.instance = new ec2.CfnInstance(this, "Hypervisor", {
      instanceType: props.instanceType,
      subnetId: subnet.subnetId,
      securityGroupIds: [props.network.gatewaySecurityGroup.securityGroupId],
      launchTemplate: {
        launchTemplateId: launchTemplate.ref,
        version: launchTemplate.attrLatestVersionNumber,
      },
      tags: [
        { key: "Name", value: `${props.name}-hypervisor` },
        { key: "HelixRole", value: "persistent-cloud-desktop" },
      ],
      metadataOptions: {
        httpTokens: "required",
        httpEndpoint: "enabled",
        httpPutResponseHopLimit: 1,
      },
    });

    const persistent = new ec2.CfnVolume(this, "PersistentVolume", {
      availabilityZone: subnet.availabilityZone,
      encrypted: true,
      size: props.persistentVolumeSize,
      volumeType: "gp3",
      tags: [{ key: "Name", value: `${props.name}-persistent` }],
    });

    new ec2.CfnVolumeAttachment(this, "PersistentAttachment", {
      device: "/dev/sdf",
      instanceId: this.instance.ref,
      volumeId: persistent.ref,
    });

    new cdk.CfnOutput(this, "InstanceId", { value: this.instance.ref });
    new cdk.CfnOutput(this, "PrivateIp", { value: this.instance.attrPrivateIp });
    new cdk.CfnOutput(this, "PersistentVolumeId", { value: persistent.ref });
    new cdk.CfnOutput(this, "HostRoleArn", { value: role.roleArn });
  }
}
