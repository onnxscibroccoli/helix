# Helix persistent EBS storage

The storage agent is a localhost-only control point for persistent workspace volumes.

Lifecycle:

1. Ensure one encrypted gp3 EBS volume exists for the workspace.
2. Attach it to the current hypervisor host in the same Availability Zone.
3. Discover the Nitro NVMe device by EBS volume identity.
4. Format a new volume with ext4 exactly once.
5. Mount it at /var/lib/helix/ebs/<workspace-id>.
6. The hypervisor stores the persistent qcow2 workspace disk in that mount.
7. Stopping a VM does not delete the volume.
8. Explicit workspace deletion detaches and deletes the volume.

The agent listens only on 127.0.0.1:8091 and requires a bearer token. The token belongs in /etc/helix/ebs-agent.env and must never be committed.

The EC2 instance profile needs only the EC2 actions required by this agent, scoped to Helix-tagged volumes and the host instance where supported. Do not grant broad administrator permissions.

A volume must be in the same Availability Zone as the instance before attachment.
