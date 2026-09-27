import { loadAgentBridgeToken } from "./agent-secret.mjs";

export function createAgentExecutor({
  baseUrl = process.env.HELIX_AGENT_BRIDGE_URL || "http://127.0.0.1:8093",
  token,
  fetchImpl = fetch,
  loadToken = loadAgentBridgeToken
} = {}) {
  const tokenPromise = token ? Promise.resolve(token) : loadToken();
  const execute = async task => {
    const payload = task?.payload && typeof task.payload === "object" ? task.payload : {};
    const resolvedToken = await tokenPromise;
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/execute`, {
      method: "POST",
      headers: { authorization: `Bearer ${resolvedToken}`, "content-type": "application/json" },
      body: JSON.stringify({ operation_key: String(task?.idempotency_key || task?.task_id || ""), command: String(payload.command || ""), cwd: String(payload.cwd || "/root"), timeout: payload.timeout }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || `agent returned HTTP ${response.status}`), { code: `AGENT_HTTP_${response.status}` });
    return body;
  };
  execute.cancelOperation = async operationKey => {
    const resolvedToken = await tokenPromise;
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/cancel`, {
      method: "POST",
      headers: { authorization: `Bearer ${resolvedToken}`, "content-type": "application/json" },
      body: JSON.stringify({ operation_key: String(operationKey || "") }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || `agent cancel returned HTTP ${response.status}`), { code: `AGENT_CANCEL_HTTP_${response.status}` });
    return body;
  };
  return execute;
}
