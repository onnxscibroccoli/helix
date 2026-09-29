#!/usr/bin/env node
const url = process.env.OMNIKALI_PUBLIC_HEALTH_URL ?? "https://d22bad48irrbqe.cloudfront.net/health";

export async function checkHealth(fetchImpl = fetch, target = url) {
  try {
    const response = await fetchImpl(target, { method: "GET", redirect: "error" });
    const body = await response.json();
    if (response.status !== 200 || body?.ok !== true) {
      return { schema: "omnikali-health/v1", status: "FAIL", detail: `HTTP ${response.status}; expected ok=true` };
    }
    return { schema: "omnikali-health/v1", status: "PASS", detail: `HTTP 200; ok=true; ${target}` };
  } catch (error) {
    return { schema: "omnikali-health/v1", status: "FAIL", detail: error instanceof Error ? error.message : String(error) };
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.env.OMNIKALI_PUBLIC_HEALTH_ENABLED !== "1") {
    console.log(JSON.stringify({
      schema: "omnikali-health/v1",
      status: "NOT_PROVEN",
      detail: "read-only public probe disabled; set OMNIKALI_PUBLIC_HEALTH_ENABLED=1"
    }, null, 2));
    process.exit(0);
  }
  const result = await checkHealth();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.status === "PASS" ? 0 : 1;
}
