import F1040 from '../F1040'

/**
 * 28% Rate Gain Worksheet — Schedule D, Line 18
 *
 * Computes the net 28% rate gain from collectibles and section 1202 exclusion.
 * Sources: Form 8949 Part II (collectibles), 1099-DIV box 2e, K-1 box 9b,
 * section 1202 exclusion.
 */
export default class SDRateGainWorksheet {
  f1040: F1040

  constructor(f1040: F1040) {
    this.f1040 = f1040
  }

  // Line 1: Collectibles gain (or loss)
  // From Form 8949 Part II (28% rate items), 1099-DIV box 2e, K-1 box 9b
  l1 = (): number => {
    // 1099-DIV box 2e collectibles gain distributions
    const divCollectibles = this.f1040
      .f1099Divs()
      .reduce((sum, f) => sum + (f.form.collectibles28PctGain ?? 0), 0)

    // K-1 box 9b collectibles gain
    const k1Collectibles = this.f1040.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + (k1.collectibles28PctGain ?? 0),
      0
    )

    return divCollectibles + k1Collectibles
  }

  // Line 2: Section 1202 exclusion (entered as negative)
  l2 = (): number => 0

  // Line 3: Combine lines 1 and 2
  l3 = (): number => this.l1() + this.l2()

  // Line 4: Short-term capital loss carryover (from Schedule D line 6, entered as positive)
  l4 = (): number => {
    const carryover = this.f1040.info.shortTermCapitalLossCarryover
    return carryover !== undefined && carryover > 0 ? -carryover : 0
  }

  // Line 5: Long-term capital loss carryover (from Schedule D line 14, entered as positive)
  l5 = (): number => {
    const carryover = this.f1040.info.longTermCapitalLossCarryover
    return carryover !== undefined && carryover > 0 ? -carryover : 0
  }

  // Line 6: Net short-term capital loss. If Schedule D line 7 is a loss, enter that loss.
  l6 = (): number => {
    const sdL7 = this.f1040.scheduleD.l7()
    return sdL7 < 0 ? sdL7 : 0
  }

  // Line 7: Combine lines 3 through 6. If zero or less, enter 0.
  // This is the net 28% rate gain → Schedule D line 18
  l7 = (): number => Math.max(0, this.l3() + this.l4() + this.l5() + this.l6())
}
