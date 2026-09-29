import { randomUUID } from 'node:crypto';
import { assertTaskTargetAllowed } from './task-policy.mjs';

export function createTaskDispatch({ store, runner, workspaceExists = async () => true, allowedTargets } = {}) {
  if (!store || !runner) throw new Error('store and runner are required');
  return async ({ taskId = randomUUID(), target, payload = {}, idempotencyKey, workspaceId = null }) => {
    assertTaskTargetAllowed(target, { allowed: allowedTargets });
    if (!idempotencyKey || typeof idempotencyKey !== 'string') throw Object.assign(new Error('idempotency_key is required'), { statusCode: 400 });
    if (workspaceId && !(await workspaceExists(workspaceId))) throw Object.assign(new Error('workspace not found'), { statusCode: 404 });
    return store.createTask({ taskId, target, payload, idempotencyKey, workspaceId });
  };
}
