import json
import os
import time
import urllib.error
import urllib.request

import boto3
from botocore.exceptions import ClientError

INSTANCE_ID = os.environ["INSTANCE_ID"]
HEALTH_URL = os.environ["HEALTH_URL"]
TABLE_NAME = os.environ["TABLE_NAME"]
LEASE_SECONDS = int(os.environ.get("LEASE_SECONDS", "45"))
REBOOT_COOLDOWN_SECONDS = int(os.environ.get("REBOOT_COOLDOWN_SECONDS", "600"))
MEMORY_FLOOR_MB = int(os.environ.get("MEMORY_FLOOR_MB", "256"))

ec2 = boto3.client("ec2")
ssm = boto3.client("ssm")
table = boto3.resource("dynamodb").Table(TABLE_NAME)


def now():
    return int(time.time())


def acquire_lease(ts):
    try:
        table.put_item(
            Item={"pk": "lease", "expires_at": ts + LEASE_SECONDS},
            ConditionExpression="attribute_not_exists(pk) OR expires_at < :now",
            ExpressionAttributeValues={":now": ts},
        )
        return True
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            return False
        raise


def release_lease():
    table.delete_item(Key={"pk": "lease"})


def read_state():
    item = table.get_item(Key={"pk": "state"}).get("Item", {})
    return {
        "failure_count": int(item.get("failure_count", 0)),
        "last_action": item.get("last_action", "none"),
        "last_action_at": int(item.get("last_action_at", 0)),
        "last_reboot_at": int(item.get("last_reboot_at", 0)),
    }


def write_state(**values):
    table.put_item(Item={"pk": "state", **values})


def public_health():
    request = urllib.request.Request(
        HEALTH_URL,
        headers={"User-Agent": "HelixOriginRecovery/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, None
    except urllib.error.HTTPError as exc:
        return exc.code, f"http_{exc.code}"
    except Exception as exc:
        return 0, str(exc)[:180]


def instance_snapshot():
    item = ec2.describe_instances(InstanceIds=[INSTANCE_ID])["Reservations"][0]["Instances"][0]
    state = item["State"]["Name"]
    status = ec2.describe_instance_status(
        InstanceIds=[INSTANCE_ID], IncludeAllInstances=True
    )
    return state, status.get("InstanceStatuses", [{}])[0]


def ssm_online():
    info = ssm.describe_instance_information(
        Filters=[{"Key": "InstanceIds", "Values": [INSTANCE_ID]}]
    ).get("InstanceInformationList", [])
    return bool(info) and info[0].get("PingStatus") == "Online"


def send_host_guard():
    commands = [
        "set -eu",
        "local_code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1/ || true)",
        "mem_avail_kb=$(awk '/MemAvailable:/ {print $2}' /proc/meminfo)",
        "if [ "$local_code" != "200" ]; then systemctl restart nginx helix-gateway; fi",
        f"if [ "$mem_avail_kb" -lt {MEMORY_FLOOR_MB * 1024} ]; then systemctl restart paperclip.service || true; fi",
        "systemctl is-active --quiet nginx",
    ]
    return ssm.send_command(
        InstanceIds=[INSTANCE_ID],
        DocumentName="AWS-RunShellScript",
        Parameters={"commands": commands},
        TimeoutSeconds=30,
        Comment="Helix origin graduated recovery guard",
    )["Command"]["CommandId"]


def recover(ts, state):
    status, detail = public_health()
    if 200 <= status < 400:
        write_state(
            failure_count=0,
            last_action="healthy",
            last_action_at=ts,
            last_reboot_at=state["last_reboot_at"],
        )
        return {
            "healthy": True,
            "http_status": status,
            "action": "none",
            "detail": detail,
        }

    failure_count = state["failure_count"] + 1
    state["failure_count"] = failure_count
    state["last_action_at"] = ts

    instance_state, instance_status = instance_snapshot()

    if instance_state == "stopped":
        ec2.start_instances(InstanceIds=[INSTANCE_ID])
        action = "start_instance"
    elif instance_state in {"stopping", "pending"}:
        action = f"wait:{instance_state}"
    elif instance_state != "running":
        action = f"wait:{instance_state}"
    elif ssm_online():
        command_id = send_host_guard()
        action = f"ssm_guard:{command_id}"
    elif (
        failure_count >= 2
        and ts - state["last_reboot_at"] >= REBOOT_COOLDOWN_SECONDS
        and instance_status.get("InstanceStatus", {}).get("Status") == "ok"
        and instance_status.get("SystemStatus", {}).get("Status") == "ok"
    ):
        ec2.reboot_instances(InstanceIds=[INSTANCE_ID])
        state["last_reboot_at"] = ts
        action = "reboot_instance"
    else:
        action = "management_plane_unavailable"

    write_state(
        failure_count=failure_count,
        last_action=action,
        last_action_at=ts,
        last_reboot_at=state["last_reboot_at"],
    )
    return {
        "healthy": False,
        "http_status": status,
        "detail": detail,
        "failure_count": failure_count,
        "instance_state": instance_state,
        "action": action,
    }


def lambda_handler(event, context):
    ts = now()
    if not acquire_lease(ts):
        return {"ok": True, "skipped": "lease_held"}

    try:
        state = read_state()
        result = recover(ts, state)
        print(json.dumps({"ts": ts, "instance_id": INSTANCE_ID, **result}, sort_keys=True))
        return result
    finally:
        release_lease()
