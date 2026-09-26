export class TaskWorker {
  constructor({ runner, intervalMs = 1000, logger = console }) {
    this.runner = runner;
    this.intervalMs = intervalMs;
    this.logger = logger;
    this.timer = null;
    this.running = false;
  }
  async tick() {
    if (this.running) return null;
    this.running = true;
    try { return await this.runner.runOnce(); }
    finally { this.running = false; }
  }
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick().catch(error => this.logger.error?.('[omnikali-worker] tick failed', error)), this.intervalMs);
    this.timer.unref?.();
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
