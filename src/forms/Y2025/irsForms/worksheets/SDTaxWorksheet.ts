import { Worksheet } from '../F1040Attachment'
import federalBrackets from '../../data/federal'
import { computeOrdinaryTax } from '../TaxTable'

/**
 * Schedule D Tax Worksheet — Line 16 (Schedule D instructions)
 *
 * Used instead of the Qualified Dividends and Capital Gain Tax Worksheet
 * when Schedule D line 18 (28% rate gain) or line 19 (unrecaptured section 1250 gain)
 * is more than zero, or when Form 4952 line 4g is more than zero.
 *
 * This worksheet computes tax using the 0%/15%/20%/25%/28% rate tiers
 * for long-term capital gains, unrecaptured section 1250 gain, and 28% rate gain.
 */
export default class SDTaxWorksheet extends Worksheet {
  isNeeded = (): boolean => {
    const sd = this.f1040.scheduleD
    const f4952 = this.f1040.f4952

    const sdCondition =
      sd.isNeeded() &&
      ((sd.l18() ?? 0) > 0 || (sd.l19() ?? 0) > 0) &&
      sd.l15() > 0 &&
      sd.l16() > 0

    const f4952Condition = f4952 !== undefined && (f4952.l4g() ?? 0) > 0

    return sdCondition || f4952Condition
  }

  // Line 1: Taxable income from Form 1040, line 15
  // (If filing Form 2555, use line 3 of Foreign Earned Income Tax Worksheet)
  l1 = (): number => {
    if (this.f1040.f2555 !== undefined) {
      return this.f1040.f2555.l3() ?? 0
    }
    return this.f1040.l15()
  }

  // Line 2: Qualified dividends from Form 1040, line 3a
  l2 = (): number => this.f1040.l3a() ?? 0

  // Line 3: Form 4952, line 4g
  l3 = (): number => this.f1040.f4952?.l4g() ?? 0

  // Line 4: Form 4952, line 4e
  l4 = (): number => this.f1040.f4952?.l4e() ?? 0

  // Line 5: Subtract line 4 from line 3. If zero or less, enter 0.
  l5 = (): number => Math.max(0, this.l3() - this.l4())

  // Line 6: Subtract line 5 from line 2. If zero or less, enter 0.
  l6 = (): number => Math.max(0, this.l2() - this.l5())

  // Line 7: Smaller of Schedule D line 15 or line 16
  l7 = (): number =>
    Math.min(this.f1040.scheduleD.l15(), this.f1040.scheduleD.l16())

  // Line 8: Smaller of line 3 or line 4
  l8 = (): number => Math.min(this.l3(), this.l4())

  // Line 9: Subtract line 8 from line 7. If zero or less, enter 0.
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Line 10: Add lines 6 and 9
  l10 = (): number => this.l6() + this.l9()

  // Line 11: Add Schedule D lines 18 and 19
  l11 = (): number => (this.f1040.scheduleD.l18() ?? 0) + (this.f1040.scheduleD.l19() ?? 0)

  // Line 12: Smaller of line 9 or line 11
  l12 = (): number => Math.min(this.l9(), this.l11())

  // Line 13: Subtract line 12 from line 10
  l13 = (): number => this.l10() - this.l12()

  // Line 14: Subtract line 13 from line 1. If zero or less, enter 0.
  l14 = (): number => Math.max(0, this.l1() - this.l13())

  // Line 15: 0% bracket cutoff by filing status
  l15 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    return federalBrackets.longTermCapGains.status[fs].brackets[0]
  }

  // Line 16: Smaller of line 1 or line 15
  l16 = (): number => Math.min(this.l1(), this.l15())

  // Line 17: Smaller of line 14 or line 16
  l17 = (): number => Math.min(this.l14(), this.l16())

  // Line 18: Subtract line 10 from line 1. If zero or less, enter 0.
  l18 = (): number => Math.max(0, this.l1() - this.l10())

  // Line 19: 15% bracket cutoff by filing status
  l19 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    return federalBrackets.longTermCapGains.status[fs].brackets[1]
  }

  // Line 20: Smaller of line 14 or line 19
  l20 = (): number => Math.min(this.l14(), this.l19())

  // Line 21: Larger of line 18 or line 20
  l21 = (): number => Math.max(this.l18(), this.l20())

  // Line 22: Subtract line 17 from line 16. Taxed at 0%.
  l22 = (): number => Math.max(0, this.l16() - this.l17())

  // Lines 23-34: Skip if lines 1 and 16 are the same (go to line 44)
  private skipTo44 = (): boolean => this.l1() === this.l16()

  // Line 23: Smaller of line 1 or line 13
  l23 = (): number => Math.min(this.l1(), this.l13())

  // Line 24: Amount from line 22
  l24 = (): number => this.l22()

  // Line 25: Subtract line 24 from line 23. If zero or less, enter 0.
  l25 = (): number => Math.max(0, this.l23() - this.l24())

  // Line 26: 15%→20% bracket cutoff
  l26 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    return federalBrackets.longTermCapGains.status[fs].brackets[1]
  }

  // Line 27: Smaller of line 1 or line 26
  l27 = (): number => Math.min(this.l1(), this.l26())

  // Line 28: Add lines 21 and 22
  l28 = (): number => this.l21() + this.l22()

  // Line 29: Subtract line 28 from line 27. If zero or less, enter 0.
  l29 = (): number => Math.max(0, this.l27() - this.l28())

  // Line 30: Smaller of line 25 or line 29
  l30 = (): number => Math.min(this.l25(), this.l29())

  // Line 31: Multiply line 30 by 15%
  l31 = (): number => this.l30() * 0.15

  // Line 32: Add lines 24 and 30
  l32 = (): number => this.l24() + this.l30()

  // Lines 33-34: Skip if lines 1 and 32 are the same (go to line 44)
  private skipTo44From33 = (): boolean => this.l1() === this.l32()

  // Line 33: Subtract line 32 from line 23
  l33 = (): number => Math.max(0, this.l23() - this.l32())

  // Line 34: Multiply line 33 by 20%
  l34 = (): number => this.l33() * 0.20

  // Lines 35-40: Skip if Schedule D line 19 is zero or blank (go to line 41)
  private hasUnrecaptured1250 = (): boolean =>
    (this.f1040.scheduleD.l19() ?? 0) > 0

  // Line 35: Smaller of line 9 or Schedule D line 19
  l35 = (): number =>
    this.hasUnrecaptured1250()
      ? Math.min(this.l9(), this.f1040.scheduleD.l19() ?? 0)
      : 0

  // Line 36: Add lines 10 and 21
  l36 = (): number => this.l10() + this.l21()

  // Line 37: Enter the amount from line 1
  l37 = (): number => this.l1()

  // Line 38: Subtract line 37 from line 36. If zero or less, enter 0.
  l38 = (): number => Math.max(0, this.l36() - this.l37())

  // Line 39: Subtract line 38 from line 35. If zero or less, enter 0.
  l39 = (): number =>
    this.hasUnrecaptured1250()
      ? Math.max(0, this.l35() - this.l38())
      : 0

  // Line 40: Multiply line 39 by 25%
  l40 = (): number => this.l39() * 0.25

  // Lines 41-43: Skip if Schedule D line 18 is zero or blank (go to line 44)
  private has28PctGain = (): boolean =>
    (this.f1040.scheduleD.l18() ?? 0) > 0

  // Line 41: Add lines 21, 22, 30, 33, and 39
  l41 = (): number =>
    this.l21() + this.l22() + this.l30() + this.l33() + this.l39()

  // Line 42: Subtract line 41 from line 1
  l42 = (): number =>
    this.has28PctGain() ? Math.max(0, this.l1() - this.l41()) : 0

  // Line 43: Multiply line 42 by 28%
  l43 = (): number => this.l42() * 0.28

  // Line 44: Tax on the amount on line 21 (ordinary rates)
  l44 = (): number =>
    computeOrdinaryTax(this.f1040.info.taxPayer.filingStatus, this.l21())

  // Line 45: Add lines 31, 34, 40, 43, and 44
  l45 = (): number =>
    this.l31() + this.l34() + this.l40() + this.l43() + this.l44()

  // Line 46: Tax on amount on line 1 (ordinary rates)
  l46 = (): number =>
    computeOrdinaryTax(this.f1040.info.taxPayer.filingStatus, this.l1())

  // Line 47: Smaller of line 45 or line 46
  l47 = (): number => Math.round(Math.min(this.l45(), this.l46()))

  // Tax result for F1040 line 16
  tax = (): number => this.l47()
}
