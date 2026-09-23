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

After the instance becomes an SSM managed node, use Session Manager/Run Command to verify:

sudo ssm-cli get-diagnostics --output table
ls -l /dev/kvm
systemctl status libvirtd --no-pager
systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service --no-pager

Then complete the Helix gateway and RDC bootstrap from the production desktop scripts.

## Destruction

The root volume is disposable. The persistent EBS volume is intentionally separate so the desktop data lifecycle is independent of the compute lifecycle. Do not destroy that volume when replacing the hypervisor unless its data is explicitly no longer needed.
