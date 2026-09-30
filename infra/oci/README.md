# OCI sandbox validation contract

This directory is the provider-specific OCI adapter boundary for the provider-neutral agent sandbox contract.

Source contract:
- Helix: bb86b055ac842b9ce6ca88880787f90bf5f300a6
- Grasshopper provider-neutral contract: 8bfc32f8b9e628e8dabcf17886503a9dff317c2d4
- Grasshopper CDK/Ansible strategy: 66af142b68095df4d02d0f01e2a4c449489cc1d4

OCI tenancy discovered 2026-09-30:
- region: us-ashburn-1
- child compartments: 0
- VCNs: 0
- dynamic groups: 0
- existing policies: BootstrapProvisioning and Tenant Admin Policy
- pinned ARM image:
  ocid1.image.oc1.iad.aaaaaaaa3po2lxwpxplrwyfs52s3cenwxvsc5khcvywugui5k4dumx44xk5a
- image: Oracle-Linux-8.10-aarch64-2026.09.18-0
- candidate shape: VM.Standard.A1.Flex
- initial target: 1 OCPU / 6 GB
- public IP: disabled
- NAT: disabled

No OCI resource mutation is authorized by this repository change.

## Required implementation gates

The OCI adapter must prove:

1. identity isolation
2. sandbox compartment isolation
3. workload create/destroy
4. production credential denial
5. owner/expiry-bounded cleanup
6. immutable source convergence
7. no public management listeners
8. evidence without secrets

## Authentication

Preferred GitHub Actions authentication is OCI JWT-to-RPST Workload Identity Federation using GitHub OIDC. Long-lived OCI API keys are not the target architecture.

## Ownership

OCI Terraform/OpenTofu owns OCI infrastructure.
Ansible owns guest/host configuration.
Helix owns workspace lifecycle.
Kubernetes remains a separate prototype.

No controller may own another controller's resources.
