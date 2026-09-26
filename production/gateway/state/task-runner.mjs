export class TaskRunner {
  constructor({ store, executors, workerId, heartbeatSeconds = 15, logger = console }) {
    if (!store) throw new Error('store is required');
    if (!executors || typeof executors !== 'object') throw new Error('executors are required');
    if (!workerId) throw new Error('workerId is required');
    this.store = store;
    this.executors = executors;
    this.workerId = workerId;
    this.heartbeatMs = Math.max(1000, Number(heartbeatSeconds) * 1000);
    this.logger = logger;
  }

  async runOnce({ target = null } = {}) {
    const task = await this.store.claimNext(this.workerId, { target });
    if (!task) return null;
    const executor = this.executors[task.target];
    if (typeof executor !== 'function') {
      await this.store.fail(task.task_id, this.workerId, { code: 'UNSUPPORTED_TARGET', message: `No executor for target: ${task.target}` });
      return { taskId: task.task_id, state: 'FAILED', reason: 'UNSUPPORTED_TARGET' };
    }
    let heartbeatError = null;
    const heartbeat = setInterval(async () => {
      try { await this.store.heartbeat(task.task_id, this.workerId); }
      catch (error) { heartbeatError = error; this.logger.error?.('[omnikali-runner] heartbeat failed', error); }
    }, this.heartbeatMs);
    heartbeat.unref?.();
    try {
      const result = await executor(task);
      if (heartbeatError) throw new Error(`heartbeat lost: ${heartbeatError.message}`);
      const completed = await this.store.complete(task.task_id, this.workerId, result);
      return { taskId: task.task_id, state: completed.state, result: completed.result ?? result };
    } catch (error) {
      const failure = { code: error?.code || 'EXECUTION_FAILED', message: error?.message || String(error) };
      try { await this.store.fail(task.task_id, this.workerId, failure); }
      catch (fenceError) { this.logger.error?.('[omnikali-runner] completion/failure fencing rejected', fenceError); }
      return { taskId: task.task_id, state: 'FAILED', error: failure };
    } finally { clearInterval(heartbeat); }
  }
}

export function createCommandExecutors({ execute }) {
  if (typeof execute !== 'function') throw new Error('execute is required');
  return { kali: task => execute(task.payload) };
}
