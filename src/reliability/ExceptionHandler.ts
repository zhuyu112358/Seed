// ExceptionHandler: installs process-wide handlers for uncaughtException /
// unhandledRejection, logs a fatal line and triggers an emergency snapshot so
// the world can be rolled back. The process does not exit by default so the
// world can degrade gracefully; call setExitOnFatal(true) for strict deployments.

import type { SnapshotManager } from './SnapshotManager.js';
import { Logger } from './Logger.js';

const log = Logger.for('exception');

export class ExceptionHandler {
  private installed = false;
  private exitOnFatal = false;

  constructor(
    private readonly snapshotter?: SnapshotManager,
    private readonly emergencySnapshot?: () => unknown,
  ) {}

  setExitOnFatal(v: boolean): void {
    this.exitOnFatal = v;
  }

  install(): void {
    if (this.installed) return;
    this.installed = true;

    process.on('uncaughtException', (err) => {
      log.fatal({ err: err.stack ?? String(err) }, 'uncaughtException');
      this.emergencySnapshot?.();
      if (this.exitOnFatal) process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      log.fatal({ reason: String(reason) }, 'unhandledRejection');
      this.emergencySnapshot?.();
      if (this.exitOnFatal) process.exit(1);
    });

    log.info('exception handler installed');
  }
}
