import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8606Data, PersonRole } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 8606 — Nondeductible IRAs
 *
 * Part I:  Nondeductible contributions to traditional IRAs and
 *          basis determination for distributions/conversions
 * Part II: Conversions from traditional, SEP, or SIMPLE IRAs to Roth IRAs
 * Part III: Distributions from Roth IRAs
 *
 * Each spouse files a separate Form 8606 if both have nondeductible IRA activity.
 * The taxable IRA amount flows to F1040 lines 4a/4b.
 *
 * Reference: 2024 Form 8606 instructions (169 Excel formulas)
 */
export default class F8606 extends F1040Attachment {
  tag: FormTag = 'f8606'
  sequenceIndex = 48

  readonly data: Form8606Data

  constructor(f1040: F1040, data: Form8606Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form8606s !== undefined &&
    this.f1040.info.form8606s.length > 0

  // Additional Form 8606 for spouse
  copies = (): F8606[] => {
    const list = this.f1040.f8606List
    if (list.length <= 1) return []
    return list.slice(1)
  }

  // --- Part I: Nondeductible Contributions to Traditional IRAs
  //             and Distributions from Traditional, SEP, and SIMPLE IRAs ---

  // Line 1: Nondeductible contributions made for the year
  l1 = (): number => this.data.nondeductibleContributions

  // Line 2: Total basis in traditional IRAs from prior years
  l2 = (): number => this.data.totalBasisPriorYears

  // Line 3: Add lines 1 and 2
  l3 = (): number => this.l1() + this.l2()

  // Line 4: Contributions withdrawn (between due date of return)
  // (Simplified — typically 0)
  l4 = (): number => 0

  // Line 5: Subtract line 4 from line 3. This is your total basis
  l5 = (): number => this.l3() - this.l4()

  // Line 6: Value of all traditional, SEP, and SIMPLE IRAs as of December 31
  l6 = (): number => this.data.valueOfAllTraditionalIRAs

  // Line 7: Distributions from traditional, SEP, and SIMPLE IRAs
  l7 = (): number => this.data.distributionsFromTraditional

  // Line 8: Net amount converted from traditional, SEP, and SIMPLE IRAs to Roth
  l8 = (): number => this.data.amountConverted

  // Line 9: Add lines 6, 7, and 8
  l9 = (): number => sumFields([this.l6(), this.l7(), this.l8()])

  // Line 10: Divide line 5 by line 9 (ratio of basis to total value)
  // Enter as decimal rounded to at least 4 places, not > 1.0000
  l10 = (): number => {
    if (this.l9() === 0) return 0
    const ratio = this.l5() / this.l9()
    return Math.min(1, Math.round(ratio * 10000) / 10000)
  }

  // Line 11: Multiply line 8 by line 10. This is the nontaxable portion of conversion
  l11 = (): number => Math.round(this.l8() * this.l10() * 100) / 100

  // Line 12: Multiply line 7 by line 10. This is the nontaxable portion of distributions
  l12 = (): number => Math.round(this.l7() * this.l10() * 100) / 100

  // Line 13: Add lines 11 and 12. This is the nontaxable portion of all distributions/conversions
  l13 = (): number => this.l11() + this.l12()

  // Line 14: Subtract line 13 from line 3. This is your total basis for next year
  // (Carryforward to next year's Form 8606 line 2)
  l14 = (): number => Math.max(0, this.l3() - this.l13())

  // Line 15a: Taxable amount of distributions
  // Subtract line 12 from line 7
  l15a = (): number => Math.max(0, this.l7() - this.l12())

  // Line 15b: Taxable amount of conversions
  // Subtract line 11 from line 8
  l15b = (): number => Math.max(0, this.l8() - this.l11())

  // Line 15c: Total taxable amount = 15a + 15b
  l15c = (): number => this.l15a() + this.l15b()

  // --- Part II: Conversions from Traditional, SEP, or SIMPLE IRAs to Roth IRAs ---

  // Line 16: Amount from line 8 if converting
  l16 = (): number => this.l8()

  // Line 17: Basis portion from line 11
  l17 = (): number => this.l11()

  // Line 18: Taxable conversion amount = line 16 - line 17
  l18 = (): number => Math.max(0, this.l16() - this.l17())

  // --- Part III: Distributions from Roth IRAs ---

  // Line 19: Total nonqualified distributions from Roth IRAs
  l19 = (): number => this.data.rothDistributions ?? 0

  // Line 20: Qualified first-time homebuyer expenses (not implemented — rare)
  l20 = (): number => 0

  // Line 21: Subtract line 20 from line 19
  l21 = (): number => Math.max(0, this.l19() - this.l20())

  // Line 22: Roth IRA contributions basis
  l22 = (): number => this.data.rothContributionBasis ?? 0

  // Line 23: Nontaxable portion of distribution. Subtract line 22 from line 21.
  // If zero or less, enter 0 and skip to line 25
  l23 = (): number => Math.max(0, this.l21() - this.l22())

  // Line 24: Conversion and rollover contributions included in line 23 (not tracked)
  l24 = (): number => 0

  // Line 25a: Taxable amount. Subtract line 24 from line 23
  l25a = (): number => Math.max(0, this.l23() - this.l24())

  // Line 25b: Amount subject to 10% early withdrawal penalty (if applicable)
  l25b = (): number => 0

  // Line 25c: Total taxable amount from Part III
  l25c = (): number => this.l25a()

  // Total taxable IRA amount from this Form 8606
  taxableAmount = (): number => this.l15c() + this.l25c()

  // Gross distribution amount (for F1040 line 4a)
  grossDistribution = (): number =>
    this.l7() + this.l8() + this.l19()

  fields = (): Field[] => [
    // PDF: 45 fields. Checkbox only at position 39 (c2_1[0]).
    // Field 17 (f1_18) has maxLen=1 (Yes/No question).

    // --- Page 1 header (fields 0-7) ---
    this.f1040.namesString(), // 0: f1_01 Name
    this.data.personRole === PersonRole.SPOUSE
      ? this.f1040.info.taxPayer.spouse?.ssid
      : this.f1040.info.taxPayer.primaryPerson.ssid, // 1: f1_02 SSN (maxLen=11)
    undefined, // 2: f1_03 Home address
    undefined, // 3: f1_04 Apt. no.
    undefined, // 4: f1_05 City, state, ZIP
    undefined, // 5: f1_06 Foreign country
    undefined, // 6: f1_07 Foreign province
    undefined, // 7: f1_08 Foreign postal code

    // --- Page 1 Part I: lines 1-14 ---
    this.l1(), // 8: f1_09 Line 1
    this.l2(), // 9: f1_10 Line 2
    this.l3(), // 10: f1_11 Line 3
    this.l4(), // 11: f1_12 Line 4
    this.l5(), // 12: f1_13 Line 5
    this.l6(), // 13: f1_14 Line 6
    this.l7(), // 14: f1_15 Line 7
    this.l8(), // 15: f1_16 Line 8
    this.l9(), // 16: f1_17 Line 9
    // 17: f1_18 Yes/No question (maxLen=1) — "Did you take distributions?"
    this.l7() > 0 || this.l8() > 0 ? 'Y' : undefined,
    this.l10() > 0 ? this.l10().toFixed(4) : undefined, // 18: f1_19 Line 10 (decimal ratio)
    this.l11(), // 19: f1_20 Line 11
    this.l12(), // 20: f1_21 Line 12
    this.l13(), // 21: f1_22 Line 13
    this.l14(), // 22: f1_23 Line 14

    // --- Page 2 header ---
    this.f1040.namesString(), // 23: f2_01 Name (page 2)
    this.f1040.info.taxPayer.primaryPerson.ssid, // 24: f2_02 SSN (page 2)

    // --- Page 2 Part I continued: lines 15a-15c ---
    this.l15a(), // 25: f2_03 Line 15a
    this.l15b(), // 26: f2_04 Line 15b
    this.l15c(), // 27: f2_05 Line 15c

    // --- Page 2 Part II: lines 16-18 ---
    this.l16(), // 28: f2_06 Line 16
    this.l17(), // 29: f2_07 Line 17
    this.l18(), // 30: f2_08 Line 18

    // --- Page 2 Part III: lines 19-25c ---
    this.l19(), // 29: f2_07 Line 18
    this.l20(), // 30: f2_08 Line 19
    this.l21(), // 31: f2_09 Line 20
    this.l22(), // 32: f2_10 Line 21
    this.l23(), // 33: f2_11 Line 22
    this.l24(), // 34: f2_12 Line 23
    this.l25a(), // 35: f2_13 Line 24
    this.l25b(), // 36: f2_14 Line 25a
    this.l25c(), // 37: f2_15 Line 25b
    undefined, // 38: f2_16 Line 25c

    // --- Page 2 checkbox and remaining fields ---
    false, // 39: c2_1[0] Checkbox (line 26 or similar)
    undefined, // 40: f2_17 (maxLen=11)
    undefined, // 41: f2_18
    undefined, // 42: f2_19 (maxLen=10)
    undefined, // 43: f2_20
    undefined // 44: f2_21
  ]
}
