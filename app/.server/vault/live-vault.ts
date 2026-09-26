import { watch, type FSWatcher } from "chokidar";
import { Vault } from "./vault";

/**
 * Keeps an up-to-date Vault while the app runs: edits made in Obsidian show up on the next page
 * load. Rebuilds are debounced, and the previous snapshot keeps serving until the new one is
 * ready, so a half-saved file never produces a half-built vault.
 */
export class LiveVault {
  private watcher?: FSWatcher;
  private timer?: ReturnType<typeof setTimeout>;

  private constructor(
    private readonly root: string,
    private snapshot: Vault,
  ) {}

  static async open(root: string, { watchForChanges = true } = {}): Promise<LiveVault> {
    const live = new LiveVault(root, await Vault.load(root));
    if (watchForChanges) await live.startWatching();
    return live;
  }

  get current(): Vault {
    return this.snapshot;
  }

  async reload(): Promise<void> {
    try {
      this.snapshot = await Vault.load(this.root);
    } catch (error) {
      console.error("[vault] Reload failed; still serving the previous snapshot.", error);
    }
  }

  async close(): Promise<void> {
    clearTimeout(this.timer);
    await this.watcher?.close();
  }

  /** Resolves once the watcher is ready; changes before then would go unnoticed. */
  private startWatching(): Promise<void> {
    this.watcher = watch(this.root, {
      ignoreInitial: true,
      // Obsidian's config folder changes constantly (workspace layout) and isn't content.
      ignored: (path) => /[\\/]\.(obsidian|trash|git)([\\/]|$)/.test(path),
    });
    this.watcher.on("all", () => {
      clearTimeout(this.timer);
      this.timer = setTimeout(() => void this.reload(), 200);
    });
    const watcher = this.watcher;
    return new Promise((resolve) => watcher.once("ready", resolve));
  }
}
