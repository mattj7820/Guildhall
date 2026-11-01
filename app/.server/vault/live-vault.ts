import { watch, type FSWatcher } from "chokidar";
import { Vault } from "./vault";

/** Wait this long after the last change before rebuilding, so a burst of saves is read once. */
const QUIET_MS = 200;
/** But never wait longer than this, so a long sync (rclone copying many files) still shows up. */
const MAX_WAIT_MS = 2000;

/**
 * Keeps an up-to-date Vault while the app runs: edits made in Obsidian (or synced from Google
 * Drive) show up on the next page load. Rebuilds are debounced, and the previous snapshot keeps
 * serving until the new one is ready, so a half-saved file never produces a half-built vault.
 * Only one rebuild runs at a time; changes during it cause one more, so an older rebuild can
 * never replace a newer one.
 */
export class LiveVault {
  private watcher?: FSWatcher;
  private timer?: ReturnType<typeof setTimeout>;
  private firstChangeAt?: number;
  private reloading?: Promise<void>;
  private changedWhileReloading = false;
  private readonly listeners = new Set<() => void>();

  private constructor(
    private readonly root: string,
    /** The campaign's folder, when the app is scoped to one: nothing outside it is read. */
    readonly folder: string | undefined,
    private snapshot: Vault,
    private readonly load: (root: string, folder?: string) => Promise<Vault>,
  ) {}

  static async open(
    root: string,
    {
      folder,
      watchForChanges = true,
      load = Vault.load,
    }: {
      folder?: string;
      watchForChanges?: boolean;
      load?: (root: string, folder?: string) => Promise<Vault>;
    } = {},
  ): Promise<LiveVault> {
    const live = new LiveVault(root, folder, await load(root, folder), load);
    if (watchForChanges) await live.startWatching();
    return live;
  }

  get current(): Vault {
    return this.snapshot;
  }

  /** Calls `listener` after each rebuild that succeeded. Returns a way to stop. */
  onReload(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Rebuilds the vault. If a rebuild is already running, it runs once more afterwards. */
  reload(): Promise<void> {
    if (this.reloading) {
      this.changedWhileReloading = true;
      return this.reloading;
    }
    this.reloading = this.rebuildUntilSettled().finally(() => {
      this.reloading = undefined;
    });
    return this.reloading;
  }

  async close(): Promise<void> {
    clearTimeout(this.timer);
    await this.watcher?.close();
    await this.reloading;
  }

  private async rebuildUntilSettled(): Promise<void> {
    let reloaded = false;
    do {
      this.changedWhileReloading = false;
      try {
        this.snapshot = await this.load(this.root, this.folder);
        reloaded = true;
      } catch (error) {
        console.error("[vault] Reload failed; still serving the previous snapshot.", error);
      }
    } while (this.changedWhileReloading);
    if (reloaded) for (const listener of this.listeners) listener();
  }

  private scheduleReload(): void {
    const now = Date.now();
    this.firstChangeAt ??= now;
    clearTimeout(this.timer);
    const wait = Math.max(0, Math.min(QUIET_MS, this.firstChangeAt + MAX_WAIT_MS - now));
    this.timer = setTimeout(() => {
      this.firstChangeAt = undefined;
      void this.reload();
    }, wait);
  }

  /** Resolves once the watcher is ready; changes before then would go unnoticed. */
  private startWatching(): Promise<void> {
    this.watcher = watch(this.root, {
      ignoreInitial: true,
      // Obsidian's config folder changes constantly (workspace layout) and isn't content, and
      // rclone's half-downloaded `.partial` files are renamed into place when complete.
      ignored: (path) => /[\\/]\.(obsidian|trash|git)([\\/]|$)|\.partial$/.test(path),
    });
    this.watcher.on("all", () => this.scheduleReload());
    this.watcher.on("error", (error) =>
      console.error("[vault] Watching for changes failed", error),
    );
    const watcher = this.watcher;
    return new Promise((resolve) => watcher.once("ready", resolve));
  }
}
