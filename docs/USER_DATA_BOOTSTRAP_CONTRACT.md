# Helix user-data bootstrap contract

Non-production documentation. This does not change the live CloudFront edge.

The checked-in rebuild module is:

```text
Terraform infra/aws
  -> aws_instance.hypervisor
  -> user_data = file(user-data.sh)
  -> instance profile AmazonSSMManagedInstanceCore
```

`AWS::SSM::Association` is forbidden as a bootstrap orchestrator.
SSM Agent is an operational Session Manager channel only.
Do not open SSH.
Do not bind a prototype to host ports 80/443 on the live Helix origin.
