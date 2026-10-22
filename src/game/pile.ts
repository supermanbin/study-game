/** Detects the pile staying above the warning line (top < lineY) continuously for holdMs. */
export class PileOverflowTracker {
  private heldMs = 0;

  constructor(
    private readonly lineY: number,
    private readonly holdMs: number,
  ) {}

  /** `highestTopY` is the smallest top y of all pile bodies, or null when there is no pile. */
  update(dtMs: number, highestTopY: number | null): boolean {
    if (highestTopY === null || highestTopY >= this.lineY) {
      this.heldMs = 0;
      return false;
    }
    this.heldMs += dtMs;
    return this.heldMs >= this.holdMs;
  }
}
