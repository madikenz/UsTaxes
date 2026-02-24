import F1040 from '../F1040'

/**
 * Unrecaptured Section 1250 Gain Worksheet — Schedule D, Line 19
 *
 * Computes unrecaptured section 1250 gain (taxed at max 25%).
 * Sources: Form 4797 (section 1250 property sales), 1099-DIV box 2d,
 * K-1 box 9c, installment sales of section 1250 property.
 *
 * This gain represents the portion of gain on section 1250 property
 * (real property) attributable to depreciation that is not excess
 * depreciation (which would be ordinary income under section 1250).
 */
export default class SDUnrecaptured1250 {
  f1040: F1040

  constructor(f1040: F1040) {
    this.f1040 = f1040
  }

  // Line 1: Gain from Form 4797, section 1250 property
  // This is the unrecaptured portion (depreciation allowed minus excess depreciation)
  l1 = (): number => {
    if (this.f1040.f4797 === undefined) return 0
    return this.f1040.f4797.unrecapturedSection1250Gain()
  }

  // Lines 2-8: Various adjustments (installment sales, like-kind exchanges, etc.)
  // These are specialist items that require additional data models
  l2 = (): number => 0
  l3 = (): number => 0
  l4 = (): number => 0
  l5 = (): number => 0
  l6 = (): number => 0
  l7 = (): number => 0
  l8 = (): number => 0

  // Line 9: Add lines 1-8
  l9 = (): number =>
    this.l1() + this.l2() + this.l3() + this.l4() +
    this.l5() + this.l6() + this.l7() + this.l8()

  // Line 10: Unrecaptured section 1250 gain from 1099-DIV (box 2d)
  l10 = (): number =>
    this.f1040
      .f1099Divs()
      .reduce((sum, f) => sum + (f.form.unrecapturedSection1250Gain ?? 0), 0)

  // Line 11: Unrecaptured section 1250 gain from K-1 (box 9c)
  l11 = (): number =>
    this.f1040.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + (k1.unrecapturedSection1250Gain ?? 0),
      0
    )

  // Line 12: Add lines 9, 10, and 11
  l12 = (): number => this.l9() + this.l10() + this.l11()

  // Line 13: Long-term capital loss carryover (positive amount)
  l13 = (): number => {
    const carryover = this.f1040.info.longTermCapitalLossCarryover
    return carryover !== undefined && carryover > 0 ? carryover : 0
  }

  // Line 14: Net short-term capital loss (if Schedule D line 7 is a loss, absolute value)
  l14 = (): number => {
    const sdL7 = this.f1040.scheduleD.l7()
    return sdL7 < 0 ? -sdL7 : 0
  }

  // Line 15: Add lines 13 and 14
  l15 = (): number => this.l13() + this.l14()

  // Line 16: Subtract line 15 from line 12. If zero or less, enter 0.
  l16 = (): number => Math.max(0, this.l12() - this.l15())

  // Line 17: Net long-term capital gain from Schedule D line 15
  l17 = (): number => Math.max(0, this.f1040.scheduleD.l15())

  // Line 18: Smaller of line 16 or line 17 → Schedule D line 19
  l18 = (): number => Math.min(this.l16(), this.l17())
}
