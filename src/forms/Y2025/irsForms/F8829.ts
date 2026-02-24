import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8829Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 8829 — Expenses for Business Use of Your Home (2025 revision)
 * Used to figure the allowable deduction for business use of your home.
 * The deduction flows to Schedule C, line 30.
 *
 * Line numbers match the 2025 IRS PDF (f8829.pdf).
 */
export default class F8829 extends F1040Attachment {
  tag: FormTag = 'f8829'
  sequenceIndex = 66

  readonly data: Form8829Data

  constructor(f1040: F1040, data: Form8829Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form8829s !== undefined &&
    this.f1040.info.form8829s.length > 0

  // ─── Part I: Part of Your Home Used for Business ───

  // Line 1: Area used regularly and exclusively for business
  l1 = (): number => this.data.businessArea

  // Line 2: Total area of home
  l2 = (): number => this.data.totalAreaOfHome

  // Line 3: Divide line 1 by line 2 (business percentage)
  l3 = (): number => {
    if (this.l2() === 0) return 0
    return Math.round((this.l1() / this.l2()) * 10000) / 10000
  }

  // Lines 4-6: Daycare facilities (not implemented)
  // Line 4: Multiply days used for daycare by hours used per day
  // Line 5: Total hours available (8,760 or adjusted)
  // Line 6: Divide line 4 by line 5

  // Line 7: Business percentage (for daycare = line 6 * line 3; others = line 3)
  l7 = (): number => this.l3()

  // ─── Part II: Figure Your Allowable Deduction ───

  // Line 8: Enter the amount from Schedule C, line 29
  l8 = (): number => {
    const scheduleC = this.f1040.scheduleC
    if (scheduleC === undefined) return 0
    return scheduleC.l29()
  }

  // Lines 9-12: Direct (a) and Indirect (b) deductible expenses

  // Line 9: Casualty losses
  l9Direct = (): number => 0
  l9Indirect = (): number => 0

  // Line 10: Deductible mortgage interest
  l10Direct = (): number => this.data.directMortgageInterest
  l10Indirect = (): number => this.data.indirectMortgageInterest

  // Line 11: Real estate taxes
  l11Direct = (): number => this.data.directRealEstateTaxes
  l11Indirect = (): number => this.data.indirectRealEstateTaxes

  // Line 12: Add lines 9, 10, and 11
  l12Direct = (): number =>
    sumFields([this.l9Direct(), this.l10Direct(), this.l11Direct()])
  l12Indirect = (): number =>
    sumFields([this.l9Indirect(), this.l10Indirect(), this.l11Indirect()])

  // Line 13: Multiply line 12, column (b), by line 7
  l13 = (): number => Math.round(this.l12Indirect() * this.l7() * 100) / 100

  // Line 14: Add line 12, column (a), and line 13
  l14 = (): number => this.l12Direct() + this.l13()

  // Line 15: Subtract line 14 from line 8. If zero or less, enter -0-
  l15 = (): number => Math.max(0, this.l8() - this.l14())

  // Lines 16-22: Direct (a) and Indirect (b) other expenses

  // Line 16: Excess mortgage interest
  l16Direct = (): number => 0
  l16Indirect = (): number => 0

  // Line 17: Excess real estate taxes
  l17Direct = (): number => 0
  l17Indirect = (): number => 0

  // Line 18: Insurance
  l18Direct = (): number => this.data.directInsurance
  l18Indirect = (): number => this.data.indirectInsurance

  // Line 19: Rent
  l19Direct = (): number => 0
  l19Indirect = (): number => 0

  // Line 20: Repairs and maintenance
  l20Direct = (): number => this.data.directRepairs
  l20Indirect = (): number => this.data.indirectRepairs

  // Line 21: Utilities
  l21Direct = (): number => this.data.directUtilities
  l21Indirect = (): number => this.data.indirectUtilities

  // Line 22: Other expenses
  l22Direct = (): number => this.data.directOther
  l22Indirect = (): number => this.data.indirectOther

  // Line 23: Add lines 16 through 22
  l23Direct = (): number =>
    sumFields([
      this.l16Direct(),
      this.l17Direct(),
      this.l18Direct(),
      this.l19Direct(),
      this.l20Direct(),
      this.l21Direct(),
      this.l22Direct()
    ])
  l23Indirect = (): number =>
    sumFields([
      this.l16Indirect(),
      this.l17Indirect(),
      this.l18Indirect(),
      this.l19Indirect(),
      this.l20Indirect(),
      this.l21Indirect(),
      this.l22Indirect()
    ])

  // Line 24: Multiply line 23, column (b), by line 7
  l24 = (): number => Math.round(this.l23Indirect() * this.l7() * 100) / 100

  // Line 25: Carryover of prior year operating expenses (not tracked yet)
  l25 = (): number => 0

  // Line 26: Add line 23, column (a), line 24, and line 25
  l26 = (): number => sumFields([this.l23Direct(), this.l24(), this.l25()])

  // Line 27: Allowable operating expenses. Enter the smaller of line 15 or line 26
  l27 = (): number => Math.min(this.l15(), this.l26())

  // Line 28: Limit on excess casualty losses and depreciation.
  //          Subtract line 27 from line 15
  l28 = (): number => Math.max(0, this.l15() - this.l27())

  // Line 29: Excess casualty losses
  l29 = (): number => 0

  // Line 30: Depreciation of your home from line 42 below
  l30 = (): number => this.l42()

  // Line 31: Carryover of prior year excess casualty losses and depreciation
  l31 = (): number => 0

  // Line 32: Add lines 29 through 31
  l32 = (): number => sumFields([this.l29(), this.l30(), this.l31()])

  // Line 33: Allowable excess casualty losses and depreciation.
  //          Enter the smaller of line 28 or line 32
  l33 = (): number => Math.min(this.l28(), this.l32())

  // Line 34: Add lines 14, 27, and 33
  l34 = (): number => sumFields([this.l14(), this.l27(), this.l33()])

  // Line 35: Casualty loss portion, if any, from lines 14 and 33
  l35 = (): number => 0

  // Line 36: Allowable expenses for business use of your home.
  //          Subtract line 35 from line 34. Enter here and on Schedule C, line 30.
  l36 = (): number => Math.max(0, this.l34() - this.l35())

  // ─── Part III: Depreciation of Your Home ───

  // Line 37: Enter the smaller of your home's adjusted basis or its FMV
  l37 = (): number => this.data.costOrBasisOfHome

  // Line 38: Value of land included on line 37
  l38 = (): number => this.data.costOfLand

  // Line 39: Basis of building. Subtract line 38 from line 37
  l39 = (): number => Math.max(0, this.l37() - this.l38())

  // Line 40: Business basis of building. Multiply line 39 by line 7
  l40 = (): number => Math.round(this.l39() * this.l7() * 100) / 100

  // Line 41: Depreciation percentage (residential = 2.564%)
  l41 = (): number => 0.02564

  // Line 42: Depreciation allowable. Multiply line 40 by line 41.
  //          Enter here and on line 30 above.
  l42 = (): number => Math.round(this.l40() * this.l41() * 100) / 100

  // ─── Part IV: Carryover of Unallowed Expenses ───

  // Line 43: Operating expenses. Subtract line 27 from line 26.
  //          If less than zero, enter -0-
  l43 = (): number => Math.max(0, this.l26() - this.l27())

  // Line 44: Excess casualty losses and depreciation.
  //          Subtract line 33 from line 32. If less than zero, enter -0-
  l44 = (): number => Math.max(0, this.l32() - this.l33())

  // The deduction that flows to Schedule C line 30
  deduction = (): number => this.l36()

  // ─── PDF field mapping (58 fields) ───
  //
  // The fields array is positionally mapped to the fillable PDF fields
  // in public/forms/Y2024/irs/f8829.pdf.

  fields = (): Field[] => [
    // 0-1: Header
    this.f1040.namesString(),                        // 0  Name(s) of proprietor(s)
    this.f1040.info.taxPayer.primaryPerson.ssid,      // 1  Your social security number

    // 2-8: Part I — Lines 1-7
    this.l1(),                                        // 2  Line 1
    this.l2(),                                        // 3  Line 2
    this.l3(),                                        // 4  Line 3 (%)
    undefined,                                        // 5  Line 4 (daycare hours)
    undefined,                                        // 6  Line 5 (total hours)
    undefined,                                        // 7  Line 6 (decimal)
    this.l7(),                                        // 8  Line 7 (%)

    // 9: Part II — Line 8
    this.l8(),                                        // 9  Line 8

    // 10-17: Lines 9-12 (a) direct, (b) indirect
    this.l9Direct(),                                  // 10 Line 9(a)
    this.l9Indirect(),                                // 11 Line 9(b)
    this.l10Direct(),                                 // 12 Line 10(a)
    this.l10Indirect(),                               // 13 Line 10(b)
    this.l11Direct(),                                 // 14 Line 11(a)
    this.l11Indirect(),                               // 15 Line 11(b)
    this.l12Direct(),                                 // 16 Line 12(a)
    this.l12Indirect(),                               // 17 Line 12(b)

    // 18-20: Lines 13-15
    this.l13(),                                       // 18 Line 13
    this.l14(),                                       // 19 Line 14
    this.l15(),                                       // 20 Line 15

    // 21-34: Lines 16-22 (a) direct, (b) indirect
    this.l16Direct(),                                 // 21 Line 16(a)
    this.l16Indirect(),                               // 22 Line 16(b)
    this.l17Direct(),                                 // 23 Line 17(a)
    this.l17Indirect(),                               // 24 Line 17(b)
    this.l18Direct(),                                 // 25 Line 18(a)
    this.l18Indirect(),                               // 26 Line 18(b)
    this.l19Direct(),                                 // 27 Line 19(a)
    this.l19Indirect(),                               // 28 Line 19(b)
    this.l20Direct(),                                 // 29 Line 20(a)
    this.l20Indirect(),                               // 30 Line 20(b)
    this.l21Direct(),                                 // 31 Line 21(a)
    this.l21Indirect(),                               // 32 Line 21(b)
    this.l22Direct(),                                 // 33 Line 22(a)
    this.l22Indirect(),                               // 34 Line 22(b)

    // 35-41: Lines 23-28
    this.l23Direct(),                                 // 35 Line 23(a)
    this.l23Indirect(),                               // 36 Line 23(b)
    this.l24(),                                       // 37 Line 24
    this.l25(),                                       // 38 Line 25
    this.l26(),                                       // 39 Line 26
    this.l27(),                                       // 40 Line 27
    this.l28(),                                       // 41 Line 28

    // 42-49: Lines 29-36
    this.l29(),                                       // 42 Line 29
    this.l30(),                                       // 43 Line 30
    this.l31(),                                       // 44 Line 31
    this.l32(),                                       // 45 Line 32
    this.l33(),                                       // 46 Line 33
    this.l34(),                                       // 47 Line 34
    this.l35(),                                       // 48 Line 35
    this.l36(),                                       // 49 Line 36

    // 50-55: Part III — Lines 37-42
    this.l37(),                                       // 50 Line 37
    this.l38(),                                       // 51 Line 38
    this.l39(),                                       // 52 Line 39
    this.l40(),                                       // 53 Line 40
    this.l41(),                                       // 54 Line 41 (%)
    this.l42(),                                       // 55 Line 42

    // 56-57: Part IV — Lines 43-44
    this.l43(),                                       // 56 Line 43
    this.l44()                                        // 57 Line 44
  ]

  copies = (): F8829[] => {
    const list = this.f1040._f8829List ?? []
    return list.slice(1)
  }
}
