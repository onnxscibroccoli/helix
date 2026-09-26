# Helix AWS EC2 rebuild

This is the disposable EC2 substrate for the persistent browser desktop.

The instance uses an AWS-supported nested-virtualization EC2 family and explicitly enables nested virtualization. SSM is bootstrapped through an EC2 instance profile with AmazonSSMManagedInstanceCore. No SSH port is opened.

## Apply

Run from a trusted infrastructure workstation with AWS credentials:

terraform init
terraform validate
terraform plan
terraform apply

Do not put AWS credentials, Cognito secrets, or gateway signing material in this repository.

## Recovery

The AWS recovery controller is intentionally external to the Helix host so host memory pressure cannot disable its own recovery path.

It performs graduated recovery:

1. Probe the CloudFront public health URL.
2. If the EC2 origin is stopped, start it.
3. If the origin is running and SSM is online, run a host guard that checks localhost and memory pressure and restarts only affected services.
4. If the public door is still failing and SSM remains unavailable, reboot the instance only after a consecutive-failure check and a ten-minute reboot cooldown.
5. Persist a small idempotency/lease state in DynamoDB so overlapping scheduled and alarm-triggered invocations cannot race.

The controller is triggered once per minute by EventBridge and can also be invoked by the CloudFront 5xxErrorRate CloudWatch alarm.

Host rebuilds also install a 2 GiB swapfile and systemd memory ceilings for Paperclip and the Helix gateway. These guardrails preserve host capacity for SSM and the recovery path while the nested Kali guest is running.

The recovery controller is configured for the current production origin through recovery_instance_id, cloudfront_distribution_id, and recovery_health_url; it does not depend on the disposable aws_instance.hypervisor resource.

After the instance becomes an SSM managed node, use Session Manager/Run Command to verify:

sudo ssm-cli get-diagnostics --output table
ls -l /dev/kvm
systemctl status libvirtd --no-pager
systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service --no-pager

Then complete the Helix gateway and RDC bootstrap from the production desktop scripts.

## Destruction

The root volume is disposable. The persistent EBS volume is intentionally separate so the desktop data lifecycle is independent of the compute lifecycle. Do not destroy that volume when replacing the hypervisor unless its data is explicitly no longer needed.
