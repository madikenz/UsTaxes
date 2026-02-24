import { SimplifiedMethodData } from 'ustaxes/core/data'

/**
 * Simplified Method Worksheet — Lines 5a and 5b
 *
 * Calculates the taxable amount of pension/annuity payments when
 * Box 2a of Form 1099-R is not determined by the payer.
 *
 * The worksheet determines the tax-free portion of each payment
 * based on the taxpayer's investment (cost) in the contract and
 * the expected number of payments from IRS Tables 1 and 2.
 */
export default class SimplifiedMethodWorksheet {
  readonly data: SimplifiedMethodData
  readonly grossDistribution: number

  constructor(grossDistribution: number, data: SimplifiedMethodData) {
    this.grossDistribution = grossDistribution
    this.data = data
  }

  // Table 1: Single life expectancy (number of expected payments)
  // Before 11/19/1996
  static table1Before(age: number): number {
    if (age <= 55) return 300
    if (age <= 60) return 260
    if (age <= 65) return 240
    if (age <= 70) return 170
    return 120
  }

  // After 11/18/1996
  static table1After(age: number): number {
    if (age <= 55) return 360
    if (age <= 60) return 310
    if (age <= 65) return 260
    if (age <= 70) return 210
    return 160
  }

  // Table 2: Joint and survivor (combined ages, after 11/18/1996 only)
  static table2(combinedAges: number): number {
    if (combinedAges <= 110) return 410
    if (combinedAges <= 120) return 360
    if (combinedAges <= 130) return 310
    if (combinedAges <= 140) return 260
    return 210
  }

  // Line 1: Total pension/annuity payments (1099-R box 1)
  l1 = (): number => this.grossDistribution

  // Line 2: Cost in the plan at annuity starting date
  l2 = (): number => this.data.costInPlan

  // Line 3: Number from Table 1 or Table 2
  l3 = (): number => {
    if (this.data.useTable2 && this.data.combinedAgesAtStart !== undefined) {
      return SimplifiedMethodWorksheet.table2(this.data.combinedAgesAtStart)
    }
    if (this.data.annuityStartedBefore19961119) {
      return SimplifiedMethodWorksheet.table1Before(this.data.ageAtAnnuityStart)
    }
    return SimplifiedMethodWorksheet.table1After(this.data.ageAtAnnuityStart)
  }

  // Line 4: Line 2 / Line 3
  l4 = (): number => {
    const divisor = this.l3()
    if (divisor === 0) return 0
    return Math.round((this.l2() / divisor) * 100) / 100
  }

  // Line 5: Line 4 × months of payments
  l5 = (): number =>
    Math.round(this.l4() * this.data.monthsOfPayments * 100) / 100

  // Line 6: Amount recovered tax free in years after 1986
  l6 = (): number => this.data.priorYearTaxFreeRecovery

  // Line 7: Line 2 - Line 6
  l7 = (): number => Math.max(0, this.l2() - this.l6())

  // Line 8: Smaller of line 5 or line 7 (tax-free amount for this year)
  l8 = (): number => Math.min(this.l5(), this.l7())

  // Line 9: Taxable amount = Line 1 - Line 8 (not less than 0)
  taxableAmount = (): number => Math.max(0, this.l1() - this.l8())

  // Line 10: If annuity started before 1987, stop. Otherwise, line 6 + line 8
  l10 = (): number => {
    if (this.data.annuityStartedBefore19861231) return this.l6()
    return this.l6() + this.l8()
  }

  // Line 11: Balance of cost to be recovered = Line 2 - Line 10
  balanceToRecover = (): number => Math.max(0, this.l2() - this.l10())
}
