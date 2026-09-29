# Helix host convergence

Ansible is the host-convergence layer after CDK provisioning.

Transport is the current amazon.aws.aws_ssm connection plugin, not SSH. The EC2 host therefore does not need an exposed SSH management port.

Controller prerequisites:

- ansible-core >= 2.17
- amazon.aws collection 11.4.0
- AWS Session Manager plugin
- AWS credentials permitted to discover the tagged EC2 instance and use SSM
- OMNIKALI_SSM_BUCKET set to the CDK convergence artifact bucket

The amazon.aws.aws_ssm connection plugin uses S3 for module/file transfer. The CDK convergence stack creates a private, TLS-enforced, KMS-encrypted bucket with a one-day lifecycle.

Run:

ansible-galaxy collection install -r infra/ansible/requirements.yml
export AWS_REGION=us-east-1
export OMNIKALI_SSM_BUCKET=<cdk-output-artifact-bucket>
ansible-inventory -i infra/ansible/inventory.aws_ec2.yml --graph
ansible-playbook -i infra/ansible/inventory.aws_ec2.yml infra/ansible/converge-hypervisor.yml

Do not put AWS credentials, database passwords, or session tokens in inventory or playbooks.
