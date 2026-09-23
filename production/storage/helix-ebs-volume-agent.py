#!/usr/bin/env python3
"""Local EBS lifecycle agent for Helix persistent workspace storage."""

import json
import os
import re
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import boto3

REGION = os.environ["AWS_REGION"]
INSTANCE_ID = os.environ["HELIX_INSTANCE_ID"]
AZ = os.environ["HELIX_AVAILABILITY_ZONE"]
ROOT = os.environ.get("HELIX_MOUNT_ROOT", "/var/lib/helix/ebs")
TOKEN = os.environ["HELIX_STORAGE_AGENT_TOKEN"]
DEFAULT_SIZE = int(os.environ.get("HELIX_DEFAULT_VOLUME_GB", "20"))
MAX_SIZE = int(os.environ.get("HELIX_MAX_VOLUME_GB", "1000"))
ec2 = boto3.client("ec2", region_name=REGION)

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def tags(workspace_id):
    return [
        {"Key": "Project", "Value": "Helix"},
        {"Key": "ManagedBy", "Value": "helix-ebs-agent"},
        {"Key": "StorageRole", "Value": "persistent-workspace"},
        {"Key": "WorkspaceId", "Value": workspace_id},
    ]


def volume_for(workspace_id):
    response = ec2.describe_volumes(
        Filters=[
            {"Name": "tag:Project", "Values": ["Helix"]},
            {"Name": "tag:WorkspaceId", "Values": [workspace_id]},
            {"Name": "status", "Values": ["available", "in-use"]},
        ]
    )
    volumes = response.get("Volumes", [])
    if len(volumes) > 1:
        raise RuntimeError("workspace has multiple provider volumes")
    return volumes[0] if volumes else None


def wait_volume(volume_id, state):
    waiter = ec2.get_waiter(
        "volume_available" if state == "available" else "volume_in_use"
    )
    waiter.wait(VolumeIds=[volume_id], WaiterConfig={"Delay": 2, "MaxAttempts": 60})


def create_volume(workspace_id, size_gb):
    volume = volume_for(workspace_id)
    if volume:
        return volume

    response = ec2.create_volume(
        AvailabilityZone=AZ,
        VolumeType="gp3",
        Size=size_gb,
        Encrypted=True,
        TagSpecifications=[{"ResourceType": "volume", "Tags": tags(workspace_id)}],
        ClientToken=f"helix-{workspace_id}",
    )
    volume_id = response["VolumeId"]
    wait_volume(volume_id, "available")
    return ec2.describe_volumes(VolumeIds=[volume_id])["Volumes"][0]


def device_path(volume_id):
    candidates = [
        f"/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_{volume_id.replace('-', '')}",
        f"/dev/disk/by-id/nvme-Amazon_Elastic_Block_Store_{volume_id}",
    ]
    for path in candidates:
        if os.path.exists(path):
            return os.path.realpath(path)

    for _ in range(30):
        result = subprocess.run(
            ["lsblk", "-o", "PATH,SERIAL", "-nr"],
            check=True,
            capture_output=True,
            text=True,
        )
        needle = volume_id.replace("-", "")
        for line in result.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 2 and needle in parts[1]:
                return parts[0]
        time.sleep(1)

    raise RuntimeError("attached EBS volume device was not discovered")


def attachment_point():
    instance = ec2.describe_instances(InstanceIds=[INSTANCE_ID])["Reservations"][0]["Instances"][0]
    used = {m["DeviceName"] for m in instance.get("BlockDeviceMappings", [])}
    for letter in "ghijklmnop":
        candidate = f"/dev/sd{letter}"
        if candidate not in used:
            return candidate
    raise RuntimeError("no free EBS attachment point on host")

def attach(volume_id):
    volume = ec2.describe_volumes(VolumeIds=[volume_id])["Volumes"][0]
    attachments = volume.get("Attachments", [])
    own = [a for a in attachments if a["InstanceId"] == INSTANCE_ID]
    if not own:
        if attachments:
            raise RuntimeError("provider volume is attached to another instance")
        ec2.attach_volume(
            VolumeId=volume_id,
            InstanceId=INSTANCE_ID,
            Device=attachment_point(),
        )
        wait_volume(volume_id, "in-use")
    return device_path(volume_id)


def ensure_mount(workspace_id, size_gb):
    if not ID_RE.fullmatch(workspace_id):
        raise ValueError("invalid workspace id")
    if not 4 <= size_gb <= MAX_SIZE:
        raise ValueError("invalid workspace size")

    volume = create_volume(workspace_id, size_gb)
    device = attach(volume["VolumeId"])
    mount = os.path.join(ROOT, workspace_id)
    os.makedirs(mount, exist_ok=True)

    probe = subprocess.run(["blkid", "-o", "value", "-s", "TYPE", device], capture_output=True, text=True)
    filesystem_device = device
    if not probe.stdout.strip() and os.path.exists(device + "p1"):
        partition_probe = subprocess.run(["blkid", "-o", "value", "-s", "TYPE", device + "p1"], capture_output=True, text=True)
        if partition_probe.stdout.strip():
            filesystem_device = device + "p1"
    if not probe.stdout.strip() and filesystem_device == device:
        subprocess.run(["mkfs.ext4", "-F", device], check=True)

    mounted = subprocess.run(
        ["mountpoint", "-q", mount],
    ).returncode == 0
    if not mounted:
        subprocess.run(["mount", filesystem_device, mount], check=True)

    return {
        "workspaceId": workspace_id,
        "volumeId": volume["VolumeId"],
        "device": device,
        "mountPath": mount,
        "sizeGb": volume["Size"],
        "encrypted": volume["Encrypted"],
    }


def detach(workspace_id):
    volume = volume_for(workspace_id)
    if not volume:
        return {"ok": True, "missing": True}

    mount = os.path.join(ROOT, workspace_id)
    if os.path.ismount(mount):
        subprocess.run(["umount", mount], check=True)

    volume_id = volume["VolumeId"]
    attachments = volume.get("Attachments", [])
    own = [a for a in attachments if a["InstanceId"] == INSTANCE_ID]
    if own:
        ec2.detach_volume(VolumeId=volume_id, InstanceId=INSTANCE_ID)
        wait_volume(volume_id, "available")
    return {"ok": True, "volumeId": volume_id}


def destroy(workspace_id):
    result = detach(workspace_id)
    if result.get("missing"):
        return result
    ec2.delete_volume(VolumeId=result["volumeId"])
    return {"ok": True, "deletedVolumeId": result["volumeId"]}


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, payload):
        data = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def authorized(self):
        return self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def do_GET(self):
        if self.path == "/health":
            return self.send_json(200, {"ok": True})
        if not self.authorized():
            return self.send_json(401, {"error": "unauthorized"})
        return self.send_json(404, {"error": "not found"})

    def do_POST(self):
        if not self.authorized():
            return self.send_json(401, {"error": "unauthorized"})
        if self.path != "/volumes/ensure":
            return self.send_json(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length) or b"{}")
        size = int(body.get("sizeGb", DEFAULT_SIZE))
        return self.send_json(200, ensure_mount(str(body["workspaceId"]), size))

    def do_DELETE(self):
        if not self.authorized():
            return self.send_json(401, {"error": "unauthorized"})
        match = re.fullmatch(r"/volumes/([A-Za-z0-9][A-Za-z0-9._-]{0,63})", self.path)
        if not match:
            return self.send_json(404, {"error": "not found"})
        return self.send_json(200, destroy(match.group(1)))

    def log_message(self, fmt, *args):
        return


if __name__ == "__main__":
    os.makedirs(ROOT, exist_ok=True)
    ThreadingHTTPServer(("127.0.0.1", 8091), Handler).serve_forever()
