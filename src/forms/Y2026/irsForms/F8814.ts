import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { Form8814Data } from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Form 8814 — Parents' Election To Report Child's Interest and Dividends
 *
 * Used when parents elect to include their child's interest, dividend,
 * and capital gain distribution income on their own return.
 *
 * Requirements (all must be met):
 * - Child's income is only from interest and dividends (incl. cap gain distributions)
 * - Child's gross income < $12,500
 * - Child didn't make estimated tax payments or have backup withholding
 *
 * Line 12 (child income included in parent's return) → Schedule 1, line 8n
 * Line 15 (tax on first $2,500) → Form 1040, line 16
 *
 * Reference: 2024 Form 8814 instructions
 */
export default class F8814 extends F1040Attachment {
  tag: FormTag = 'f8814'
  sequenceIndex = 40

  readonly data: Form8814Data

  constructor(f1040: F1040, data: Form8814Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form8814s !== undefined &&
    this.f1040.info.form8814s.length > 0

  copies = (): F8814[] => {
    const list = this.f1040.f8814List
    if (list.length <= 1) return []
    return list.slice(1)
  }

  // Line 1a: Child's interest income
  l1a = (): number => this.data.interestIncome

  // Line 1b: Tax-exempt interest
  l1b = (): number | undefined => this.data.taxExemptInterest

  // Line 2a: Child's ordinary dividends
  l2a = (): number => this.data.ordinaryDividends

  // Line 3: Child's capital gain distributions
  l3 = (): number => this.data.capitalGainDistributions

  // Line 4: Add lines 1a, 2a, and 3
  l4 = (): number => this.l1a() + this.l2a() + this.l3()

  // Line 5: Base amount ($2,500 for 2024)
  // First $1,250 not taxed; next $1,250 taxed at child's rate (10%)
  l5 = (): number => 2500

  // Line 6: Subtract line 5 from line 4
  // This is the amount included on parent's return
  l6 = (): number => Math.max(0, this.l4() - this.l5())

  // Line 7: Capital gain distributions included in line 4
  // If there are capital gain distributions and they exceed the base amount,
  // allocate the portion above line 5 proportionally
  l7 = (): number => {
    if (this.l3() === 0 || this.l6() === 0) return 0
    // Capital gains portion of income above $2,500
    const totalIncome = this.l4()
    if (totalIncome === 0) return 0
    // Allocation ratio: capital gains / total income
    return Math.round((this.l3() / totalIncome) * this.l6() * 100) / 100
  }

  // Line 8: Subtract line 7 from line 6 (interest + dividend portion included)
  l8 = (): number => Math.max(0, this.l6() - this.l7())

  // Line 9: Divide line 8 by 2.0 (split between interest and dividends)
  l9 = (): number => Math.round((this.l8() / 2) * 100) / 100

  // Line 10: Qualified dividends included on parent's return
  // Proportional allocation of child's qualified dividends
  l10 = (): number => {
    const qualDiv = this.data.qualifiedDividendsIncluded ?? 0
    if (qualDiv === 0 || this.l4() === 0) return 0
    // Qualified dividends in income above base = qualDiv * (line 6 / line 4)
    const ratio = this.l6() / this.l4()
    return Math.round(Math.min(qualDiv, qualDiv * ratio) * 100) / 100
  }

  // Line 11: Subtract line 10 from line 9 (ordinary dividend portion)
  l11 = (): number => Math.max(0, this.l9() - this.l10())

  // Line 12: Amount to include on parent's return = line 6
  l12 = (): number => this.l6()

  // Line 13: Base amount taxable at child's rate
  // = min(line 4, line 5) - $1,250
  // First $1,250 is not taxed, next up to $1,250 is taxed at 10%
  l13 = (): number => Math.max(0, Math.min(this.l4(), this.l5()) - 1250)

  // Line 15: Tax (line 13 * 10%)
  tax = (): number => Math.round(this.l13() * 0.10 * 100) / 100

  fields = (): Field[] => [
    this.f1040.namesString(),                          // 0: Name
    this.f1040.info.taxPayer.primaryPerson.ssid,       // 1: SSN
    this.data.childName,                               // 2: Child's name
    this.data.childSSN,                                // 3: Child's SSN
    this.l1a(),                                        // 4: Line 1a
    this.l1b(),                                        // 5: Line 1b
    this.l2a(),                                        // 6: Line 2a
    this.l3(),                                         // 7: Line 3
    this.l4(),                                         // 8: Line 4
    this.l5(),                                         // 9: Line 5
    this.l6(),                                         // 10: Line 6
    this.l7(),                                          // 11: Line 7
    this.l8(),                                          // 12: Line 8
    this.l9(),                                          // 13: Line 9
    this.l10(),                                         // 14: Line 10
    this.l11(),                                         // 15: Line 11
    this.l12(),                                        // 16: Line 12
    this.l13(),                                        // 17: Line 13
    this.tax()                                         // 18: Line 15 (tax)
  ]
}
