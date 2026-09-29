# OmniKali CDK

This directory is the executable start of the canonical AWS CDK ownership boundary.

## Current scope

Stage 0 only:

- GitHub Actions OIDC provider
- repository/ref-scoped deployment role
- retained trust resources
- no production resource imports
- no production mutation

The stack is intentionally not the application platform yet. Network, RDS, Secrets Manager, CloudFront/ACM/DNS, EC2/KVM, SSM and observability stacks are added only after this trust boundary synthesizes deterministically and passes disposable-account acceptance.

## Required environment

- `AWS_PROFILE` or ambient AWS credentials for synthesis/deployment
- `OMNIKALI_GITHUB_REPOSITORY=onnxscibroccoli/helix`
- `OMNIKALI_GITHUB_REF=refs/heads/main`

For synthesis, no AWS mutation occurs.

## Ownership

CDK becomes the future owner of resources created by these stacks. Existing production Terraform remains authoritative until an explicit migration with inventory, import/no-op proof, acceptance, and rollback evidence.
