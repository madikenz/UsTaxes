import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form8801Data } from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Form 8801 — Credit for Prior Year Minimum Tax
 * (Individuals, Estates, and Trusts)
 *
 * Allows taxpayers who paid AMT in a prior year due to timing
 * differences (exclusion items like ISO stock options, depreciation)
 * to claim a credit in the current year against regular tax.
 *
 * Part I: Net Minimum Tax on Exclusion Items
 * Part II: Minimum Tax Credit and Carryforward
 *
 * Credit flows to Schedule 3 line 6h.
 */
export default class F8801 extends F1040Attachment {
  tag: FormTag = 'f8801'
  sequenceIndex = 74

  readonly data: Form8801Data

  constructor(f1040: F1040, data: Form8801Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form8801 !== undefined

  // Part I: Net Minimum Tax on Exclusion Items

  // Line 1: Prior year AMTI from Form 6251
  l1 = (): number => this.data.priorYearAMTI

  // Line 2: Adjustments and preferences treated as exclusion items
  l2 = (): number => this.data.exclusionItems

  // Line 3: Minimum tax credit NOL deduction
  l3 = (): number => this.data.mtcNOLDeduction ?? 0

  // Line 4: Combine lines 1, 2, and 3 (min 0)
  l4 = (): number => Math.max(0, this.l1() + this.l2() + this.l3())

  // Line 5: AMT exemption amount (prior year filing status)
  l5 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    // 2024 AMT exemption amounts (for 2025 Form 8801 computing on prior year)
    if (fs === FilingStatus.MFJ || fs === FilingStatus.W)
      return 133300
    if (fs === FilingStatus.MFS)
      return 66650
    return 85700 // Single, HOH
  }

  // Line 6: Phaseout threshold
  l6 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    if (fs === FilingStatus.MFJ || fs === FilingStatus.W)
      return 1218700
    if (fs === FilingStatus.MFS)
      return 609350
    return 609350 // Single, HOH
  }

  // Line 7: Line 4 minus line 6 (min 0)
  l7 = (): number => Math.max(0, this.l4() - this.l6())

  // Line 8: Multiply line 7 by 25%
  l8 = (): number => Math.round(this.l7() * 0.25 * 100) / 100

  // Line 9: Subtract line 8 from line 5 (min 0)
  l9 = (): number => Math.max(0, this.l5() - this.l8())

  // Line 10: Subtract line 9 from line 4 (min 0)
  l10 = (): number => Math.max(0, this.l4() - this.l9())

  // Lines 11-14: AMT on exclusion items at 26%/28% rates
  // Simplified: 26% on first $232,600 (MFJ) or $116,300 (other), 28% on rest
  l15 = (): number => {
    const amount = this.l10()
    if (amount <= 0) return 0
    const fs = this.f1040.info.taxPayer.filingStatus
    const threshold = (fs === FilingStatus.MFJ || fs === FilingStatus.W)
      ? 232600 : 116300
    if (amount <= threshold) {
      return Math.round(amount * 0.26 * 100) / 100
    }
    return Math.round((threshold * 0.26 + (amount - threshold) * 0.28) * 100) / 100
  }

  // Part II: Minimum Tax Credit

  // Line 16: Prior year regular tax minus credits
  l16 = (): number => this.data.priorYearRegularTaxMinusCredits

  // Line 17: Prior year AMT (from Form 6251 line 11 of prior year)
  // If prior year AMT > 0, this equals l16 + AMT = total tax
  // Simplified: net minimum tax = max(0, l15 - l16)
  netMinimumTax = (): number => Math.max(0, this.l15() - this.l16())

  // Line 21: Minimum tax credit (carryforward + net minimum tax on exclusion items)
  l21 = (): number => {
    const carryforward = this.data.priorYearAMTCreditCarryforward ?? 0
    return carryforward + this.netMinimumTax()
  }

  // Line 22: Current year regular tax
  l22 = (): number => this.f1040.l18()

  // Line 23: Current year AMT (if any)
  l23 = (): number => this.f1040.f6251.l7() ?? 0

  // Line 24: Subtract line 23 from line 22 (regular tax minus AMT)
  // This is the tax liability available for the credit
  l24 = (): number => Math.max(0, this.l22() - this.l23())

  // Line 25: Subtract nonrefundable credits (Schedule 3 lines 1-6g, 7)
  l25 = (): number => {
    const sch3 = this.f1040.schedule3
    const priorCredits = (sch3.l7() ?? 0)
    return Math.max(0, this.l24() - priorCredits)
  }

  // Line 26 (credit): Smaller of line 21 or line 25
  credit = (): number => Math.min(this.l21(), this.l25())

  // Line 27: Carryforward to next year
  carryforward = (): number => Math.max(0, this.l21() - this.credit())

  fields = (): Field[] => [
    // 0: Name(s)
    this.f1040.namesString(),
    // 1: SSN
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Part I
    // 2: Line 1
    this.l1(),
    // 3: Line 2
    this.l2(),
    // 4: Line 3
    this.l3(),
    // 5: Line 4
    this.l4(),
    // 6: Line 5
    this.l5(),
    // 7: Line 6
    this.l6(),
    // 8: Line 7
    this.l7(),
    // 9: Line 8
    this.l8(),
    // 10: Line 9
    this.l9(),
    // 11: Line 10
    this.l10(),
    // 12-14: Lines 11-14 (simplified)
    undefined,
    undefined,
    undefined,
    // 15: Line 15
    this.l15(),
    // Part II
    // 16: Line 16
    this.l16(),
    // 17-20: Lines 17-20
    undefined,
    undefined,
    undefined,
    undefined,
    // 21: Line 21
    this.l21(),
    // 22: Line 22
    this.l22(),
    // 23: Line 23
    this.l23(),
    // 24: Line 24
    this.l24(),
    // 25: Line 25
    this.l25(),
    // 26: Credit
    this.credit(),
    // 27: Carryforward
    this.carryforward()
  ]
}
