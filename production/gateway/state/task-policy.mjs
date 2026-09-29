const DEFAULT_ALLOWED_TARGETS = Object.freeze(["kali"]);

function parseTargets(value) {
  const raw = String(value || "").split(",").map(x => x.trim()).filter(Boolean);
  return [...new Set(raw)];
}

export function allowedTaskTargets(value = process.env.HELIX_ALLOWED_TASK_TARGETS) {
  const targets = parseTargets(value);
  return new Set(targets.length ? targets : DEFAULT_ALLOWED_TARGETS);
}

export function assertTaskTargetAllowed(target, { allowed = allowedTaskTargets() } = {}) {
  if (typeof target !== "string" || !target.trim()) {
    throw Object.assign(new Error("target is required"), { statusCode: 400, code: "TARGET_REQUIRED" });
  }
  if (!/^[a-z][a-z0-9-]{0,63}$/.test(target)) {
    throw Object.assign(new Error("invalid task target"), { statusCode: 400, code: "TARGET_INVALID" });
  }
  if (!allowed.has(target)) {
    throw Object.assign(new Error("task target is not enabled"), { statusCode: 403, code: "TARGET_NOT_ALLOWED" });
  }
  return target;
}
