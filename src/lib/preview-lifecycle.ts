type RunPreviewJob = (id: string) => Promise<void>;

interface PreviewLifecycleOptions {
  debounceMs: number;
  run: RunPreviewJob;
}

/**
 * Debounced, per-canvas preview lifecycle queue with last-write-wins semantics.
 */
export class PreviewLifecycleQueue {
  private readonly debounceMs: number;
  private readonly run: RunPreviewJob;

  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private signatures = new Map<string, string>();
  private inFlight = new Set<string>();
  private pending = new Set<string>();

  constructor(options: PreviewLifecycleOptions) {
    this.debounceMs = options.debounceMs;
    this.run = options.run;
  }

  request(id: string, signature: string, force = false) {
    const previous = this.signatures.get(id);
    if (!force && previous === signature) {
      return;
    }

    this.signatures.set(id, signature);
    this.schedule(id, force ? 0 : this.debounceMs);
  }

  private schedule(id: string, delayMs = this.debounceMs) {
    const existing = this.timers.get(id);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.timers.delete(id);
      void this.kickoff(id);
    }, delayMs);

    this.timers.set(id, timer);
  }

  private async kickoff(id: string) {
    if (this.inFlight.has(id)) {
      this.pending.add(id);
      return;
    }

    this.inFlight.add(id);

    try {
      await this.run(id);
    } finally {
      this.inFlight.delete(id);

      if (this.pending.has(id)) {
        this.pending.delete(id);
        this.schedule(id);
      }
    }
  }

  dispose() {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.pending.clear();
    this.inFlight.clear();
    this.signatures.clear();
  }
}
