# Helix production PostgreSQL — AWS

This is the authoritative infrastructure definition for the Helix control-plane
PostgreSQL database. It deliberately consumes an **existing production VPC and
application security groups** instead of creating a second network or silently
moving the gateway.

The database is Amazon RDS for PostgreSQL, private to the VPC, Multi-AZ,
encrypted, protected from accidental deletion, and configured with automated
backups. RDS manages the master password in AWS Secrets Manager and IAM database
authentication is enabled.

## Inputs required from the existing production environment

- `vpc_id`: the VPC containing the Helix gateway/compute tier.
- `db_subnet_ids`: at least two private subnets in different Availability Zones.
- `allowed_security_group_ids`: the security group(s) belonging to the gateway
  or other server-side application clients.

Do not put a database password in `*.tfvars`. RDS owns the master secret.

## Important Vercel connectivity boundary

The RDS instance is private by default. A Vercel deployment that directly runs
server-side database queries needs an approved private-connectivity path (for
example Vercel Secure Compute) or a deliberate alternative architecture. Do not
make the RDS instance public merely to make a deployment work.

If Vercel is given AWS OIDC access, prefer short-lived IAM database
authentication over copying the RDS master password into a long-lived Vercel
secret. The application should still expose only its provider-neutral PostgreSQL
contract.

## Apply

Run Terraform from an AWS-authorized infrastructure environment after verifying
that the supplied VPC, subnets, and application security groups are the actual
production resources. This module is intentionally separate from the existing
Helix compute Terraform so importing/reconciling the database cannot silently
replace the current production network.
