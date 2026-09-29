/**
 * Sends at most so many times a second, always ending with the latest: while dragging, the
 * others see the token move smoothly without a message for every pointer event.
 */
export class Throttle {
  private last = -Infinity;
  private trailing: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly perSecond: number,
    private readonly now: () => number = () => performance.now(),
  ) {}

  /** Runs `send` now if it's been long enough, or else once it has (replacing any waiting). */
  push(send: () => void): void {
    this.cancel();
    const run = () => {
      this.last = this.now();
      send();
    };
    const wait = 1000 / this.perSecond - (this.now() - this.last);
    if (wait <= 0) run();
    else this.trailing = setTimeout(run, wait);
  }

  /** Forgets anything waiting to be sent. */
  cancel(): void {
    clearTimeout(this.trailing);
    this.trailing = undefined;
  }
}
