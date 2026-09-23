#!/usr/bin/env node
/**
 * Helix persistent workspace storage.
 *
 * Persistent workspaces are backed by one encrypted gp3 EBS volume per
 * workspace. The volume is attached to the EC2/libvirt host and presented to
 * the guest as a raw block device. The volume is never deleted by workspace
 * destroy; only the VM attachment is removed.
 */
import { EC2Client, DescribeInstancesCommand, DescribeVolumesCommand, CreateVolumeCommand, CreateTagsCommand, AttachVolumeCommand, DetachVolumeCommand } from "@aws-sdk/client-ec2";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdirSync, readlinkSync, existsSync } from "node:fs";

const exec = promisify(execFile);
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const client = new EC2Client({ region: REGION });
const HOST_INSTANCE_ID = process.env.HELIX_EC2_INSTANCE_ID;
const VOLUME_SIZE_GB = Number(process.env.HELIX_PERSISTENT_VOLUME_GB || 20);
const KMS_KEY_ID = process.env.HELIX_EBS_KMS_KEY_ID || undefined;
const DEVICE_REQUEST = process.env.HELIX_EBS_DEVICE || "/dev/sdf";

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function imds(path) {
  const token = await (await fetch("http://169.254.169.254/latest/api/token", {
    method: "PUT", headers: { "X-aws-ec2-metadata-token-ttl-seconds": "21600" }
  })).text();
  const r = await fetch(`http://169.254.169.254/latest/meta-data/${path}`, {
    headers: { "X-aws-ec2-metadata-token": token }
  });
  if (!r.ok) throw new Error(`IMDS ${path}: ${r.status}`);
  return r.text();
}

async function host() {
  const instanceId = HOST_INSTANCE_ID || await imds("instance-id");
  const az = await imds("placement/availability-zone");
  return { instanceId, az };
}

function tagMap(tags = []) { return Object.fromEntries(tags.map(t => [t.Key, t.Value])); }

async function findVolume(workspaceId) {
  const r = await client.send(new DescribeVolumesCommand({
    Filters: [
      { Name: "tag:Project", Values: ["Helix"] },
      { Name: "tag:WorkspaceId", Values: [workspaceId] },
      { Name: "tag:StorageRole", Values: ["persistent-workspace"] },
    ],
  }));
  return (r.Volumes || []).sort((a,b) => (a.CreateTime?.getTime?.() || 0) - (b.CreateTime?.getTime?.() || 0))[0] || null;
}

async function waitVolume(volumeId, wanted) {
  for (let i=0; i<60; i++) {
    const r = await client.send(new DescribeVolumesCommand({ VolumeIds: [volumeId] }));
    const v = r.Volumes?.[0];
    if (!v) throw new Error(`volume ${volumeId} disappeared`);
    if (v.State === wanted) return v;
    if (["error","deleted"].includes(v.State)) throw new Error(`volume ${volumeId} entered ${v.State}`);
    await sleep(2000);
  }
  throw new Error(`timed out waiting for volume ${volumeId} -> ${wanted}`);
}

async function ensureVolume(workspaceId) {
  const h = await host();
  let v = await findVolume(workspaceId);
  let created = false;
  if (!v) {
    const r = await client.send(new CreateVolumeCommand({
      AvailabilityZone: h.az,
      VolumeType: "gp3",
      Size: VOLUME_SIZE_GB,
      Encrypted: true,
      ...(KMS_KEY_ID ? { KmsKeyId: KMS_KEY_ID } : {}),
      TagSpecifications: [{
        ResourceType: "volume",
        Tags: [
          { Key: "Project", Value: "Helix" },
          { Key: "Name", Value: `helix-workspace-${workspaceId}` },
          { Key: "WorkspaceId", Value: workspaceId },
          { Key: "StorageRole", Value: "persistent-workspace" },
          { Key: "StorageInitialized", Value: "false" },
          { Key: "ManagedBy", Value: "helix-hypervisor" },
        ],
      }],
    }));
    v = r.Volume;
    created = true;
  }
  if (!v?.VolumeId) throw new Error("EC2 did not return a volume id");
  if (v.AvailabilityZone !== h.az) throw new Error(`workspace volume ${v.VolumeId} is in ${v.AvailabilityZone}, host is in ${h.az}`);

  const attached = v.Attachments?.[0];
  if (attached?.InstanceId && attached.InstanceId !== h.instanceId) {
    throw new Error(`workspace volume ${v.VolumeId} is attached to another instance ${attached.InstanceId}`);
  }
  if (v.State === "creating") v = await waitVolume(v.VolumeId, "available");
  if (v.State === "available") {
    await client.send(new AttachVolumeCommand({ VolumeId: v.VolumeId, InstanceId: h.instanceId, Device: DEVICE_REQUEST }));
    v = await waitVolume(v.VolumeId, "in-use");
  } else if (v.State !== "in-use") {
    throw new Error(`workspace volume ${v.VolumeId} is ${v.State}`);
  }

  const initialized = tagMap(v.Tags).StorageInitialized === "true";
  const device = await findLinuxDevice(v.VolumeId);
  return { volumeId: v.VolumeId, device, initialized, created, instanceId: h.instanceId, az: h.az };
}

async function findLinuxDevice(volumeId) {
  const needle = volumeId.replace(/-/g, "").toLowerCase();
  for (let i=0; i<30; i++) {
    const dir = "/dev/disk/by-id";
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) {
        if (!name.toLowerCase().includes(needle)) continue;
        const path = `${dir}/${name}`;
        try { return await realpath(path); } catch {}
      }
    }
    await sleep(1000);
  }
  throw new Error(`could not locate Linux block device for ${volumeId}`);
}

async function realpath(path) {
  try {
    const { stdout } = await exec("readlink", ["-f", path]);
    return stdout.trim();
  } catch {
    return readlinkSync(path);
  }
}

export async function attachPersistentWorkspace(workspaceId, baseImage, qemuImg) {
  const v = await ensureVolume(workspaceId);
  if (!v.initialized) {
    await exec(qemuImg, ["convert", "-p", "-O", "raw", baseImage, v.device], { timeout: 15 * 60 * 1000 });
    await client.send(new CreateTagsCommand({
      Resources: [v.volumeId],
      Tags: [{ Key: "StorageInitialized", Value: "true" }],
    }));
    v.initialized = true;
  }
  return v;
}

export async function detachPersistentWorkspace(workspaceId) {
  const v = await findVolume(workspaceId);
  if (!v) return { ok: true, missing: true };
  const h = await host();
  const attached = v.Attachments?.find(a => a.InstanceId === h.instanceId);
  if (!attached) return { ok: true, volumeId: v.VolumeId, state: v.State };
  await client.send(new DetachVolumeCommand({ VolumeId: v.VolumeId, InstanceId: h.instanceId, Force: false }));
  await waitVolume(v.VolumeId, "available");
  return { ok: true, volumeId: v.VolumeId, state: "available" };
}

export async function describePersistentWorkspace(workspaceId) {
  const v = await findVolume(workspaceId);
  if (!v) return null;
  return { volumeId: v.VolumeId, state: v.State, sizeGb: v.Size, az: v.AvailabilityZone, tags: tagMap(v.Tags) };
}
