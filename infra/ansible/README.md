# Helix host convergence

Ansible is the host-convergence layer after CDK provisioning.

Transport is amazon.aws.aws_ssm, not SSH. The EC2 host therefore does not need an exposed SSH management port.

Host convergence:
ansible-galaxy collection install -r infra/ansible/requirements.yml
export AWS_REGION=us-east-1
export OMNIKALI_SSM_BUCKET=<cdk-output-artifact-bucket>
ansible-inventory -i infra/ansible/inventory.aws_ec2.yml --graph
ansible-playbook -i infra/ansible/inventory.aws_ec2.yml infra/ansible/converge-all.yml

The agent convergence creates a dedicated helix-agent system user without sudo or Docker access, installs Claude Code and OpenHands CLI, and keeps agent workspaces under /var/lib/helix-agent/workspaces.

The containerized agent environment lives under infra/agents. It intentionally has no host Docker socket.

GitHub credentials:
- GitHub Actions uses GITHUB_TOKEN for same-repository operations.
- AWS uses GitHub OIDC.
- Server-side cross-repository automation should use a GitHub App installation token.
- Do not store long-lived AWS credentials or personal GitHub tokens in agent environments.

Production agents do not merge main. They create agent branches, run tests, and stop at the merge gate.
