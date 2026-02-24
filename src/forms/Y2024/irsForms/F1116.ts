import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import {
  FilingStatus,
  Form1116Data,
  ForeignIncomeCategory
} from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 1116 — Foreign Tax Credit (Individual, Estate, or Trust)
 *
 * Computes the foreign tax credit for taxes paid or accrued to
 * foreign countries. The credit is limited to the proportion of
 * US tax attributable to foreign source income.
 *
 * One Form 1116 per income category. Most individuals use
 * Passive Category (C) or General Category (D).
 *
 * The credit flows to Schedule 3 line 1.
 *
 * Reference: 2024 Form 1116 instructions (339 Excel formulas)
 */
export default class F1116 extends F1040Attachment {
  tag: FormTag = 'f1116'
  sequenceIndex = 16

  readonly data: Form1116Data

  constructor(f1040: F1040, data: Form1116Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form1116s !== undefined &&
    this.f1040.info.form1116s.length > 0

  // Additional Form 1116 for other categories
  copies = (): F1116[] => {
    const list = this.f1040.f1116List
    if (list.length <= 1) return []
    return list.slice(1)
  }

  // --- Part I: Taxable Income or Loss from Sources Outside the U.S. ---

  // Line 1a: Total foreign gross income for this category
  l1a = (): number =>
    this.data.foreignIncomes.reduce((sum, fi) => sum + fi.grossIncome, 0)

  // Line 2: Total definitely allocable deductions
  l2 = (): number =>
    this.data.foreignIncomes.reduce(
      (sum, fi) => sum + fi.definitelyAllocableDeductions,
      0
    )

  // Line 3a: Certain itemized deductions or standard deduction apportioned
  // Simplified: apportion based on foreign/total income ratio
  l3a = (): number => {
    const totalIncome = this.f1040.l9()
    if (totalIncome <= 0) return 0
    const ratio = this.l1a() / totalIncome
    // Apportion deductions from line 12 or standard deduction
    return Math.round(this.f1040.l12() * ratio * 100) / 100
  }

  // Line 3b: Other deductions (apportioned share)
  l3b = (): number =>
    this.data.foreignIncomes.reduce(
      (sum, fi) => sum + fi.apportionedShareDeductions,
      0
    )

  // Line 3c: Total deductions apportioned
  l3c = (): number => this.l3a() + this.l3b()

  // Line 3d: Total line 2 + line 3c
  l3d = (): number => this.l2() + this.l3c()

  // Line 3e: Losses from other categories (simplified — 0)
  l3e = (): number => 0

  // Line 3f: Add lines 3d and 3e
  l3f = (): number => this.l3d() + this.l3e()

  // Line 3g: Enter amount from line 1a
  l3g = (): number => this.l1a()

  // Line 3h: Net foreign source income = line 3g - line 3f
  l3h = (): number => Math.max(0, this.l3g() - this.l3f())

  // --- Part II: Foreign Taxes Paid or Accrued ---

  // Total foreign taxes paid or accrued
  totalForeignTaxes = (): number =>
    this.data.foreignIncomes.reduce(
      (sum, fi) => sum + fi.foreignTaxesPaidOrAccrued,
      0
    )

  // Line 8: Total foreign taxes (column totals → this line)
  l8 = (): number => this.totalForeignTaxes()

  // Line 9: Tax paid/accrued by partnership, S corp, estate/trust (simplified — 0)
  l9 = (): number => 0

  // Line 10: Carryback or carryover (simplified — 0)
  l10 = (): number => 0

  // Line 11: Total taxes = lines 8 + 9 + 10
  l11 = (): number => sumFields([this.l8(), this.l9(), this.l10()])

  // Line 12: Reduction for foreign taxes on excluded income (F2555, etc.)
  l12 = (): number => 0

  // Line 13: Taxes reclassified under high tax kickout (simplified — 0)
  l13 = (): number => 0

  // Line 14: Total foreign taxes after adjustments = line 11 - 12 + 13
  l14 = (): number => this.l11() - this.l12() + this.l13()

  // --- Part III: Foreign Tax Credit ---

  // Line 15: Net foreign source taxable income from Part I (line 3h)
  l15 = (): number => this.l3h()

  // Line 16: Adjustments to line 15 (simplified — 0)
  l16 = (): number => 0

  // Line 17: Combine lines 15 and 16
  l17 = (): number => this.l15() + this.l16()

  // Line 18: Individuals: Enter taxable income from 1040 line 15
  l18 = (): number => this.f1040.l15()

  // Line 19: Divide line 17 by line 18 (cannot exceed 1.0000)
  l19 = (): number => {
    if (this.l18() <= 0) return 0
    const ratio = this.l17() / this.l18()
    return Math.min(1, Math.round(ratio * 10000) / 10000)
  }

  // Line 20: Tax from 1040 (line 16, or tax from special methods)
  l20 = (): number => this.f1040.l16() ?? 0

  // Line 21: Multiply line 20 by line 19
  // This is the maximum credit for this category
  l21 = (): number => Math.round(this.l20() * this.l19() * 100) / 100

  // Line 22: Smaller of line 14 or line 21
  // This is the credit for this category
  l22 = (): number => Math.min(this.l14(), this.l21())

  // Line 23: Reduction in credit for international boycott operations (rare — 0)
  l23 = (): number => 0

  // Line 24: Foreign tax credit = line 22 - line 23
  l24 = (): number => Math.max(0, this.l22() - this.l23())

  // For Schedule 3 line 1: credit amount
  credit = (): number | undefined =>
    this.l24() > 0 ? this.l24() : undefined

  fields = (): Field[] => {
    const incomes = this.data.foreignIncomes.slice(0, 3)
    const inc = (idx: number) => incomes[idx]
    const country = (idx: number) => inc(idx)?.country ?? ''
    const gross = (idx: number) => inc(idx)?.grossIncome ?? undefined
    const deduct = (idx: number) => inc(idx)?.definitelyAllocableDeductions ?? undefined
    const apport = (idx: number) => inc(idx)?.apportionedShareDeductions ?? undefined
    const fTax = (idx: number) => inc(idx)?.foreignTaxesPaidOrAccrued ?? undefined

    return [
      // Page 1 header
      this.f1040.namesString(),                                    // 0: name
      this.f1040.info.taxPayer.primaryPerson.ssid,                 // 1: SSN
      // Category checkboxes A-F
      this.data.category === ForeignIncomeCategory.SectionA,       // 2: checkbox A
      this.data.category === ForeignIncomeCategory.SectionB,       // 3: checkbox B
      this.data.category === ForeignIncomeCategory.PassiveCategory, // 4: checkbox C
      this.data.category === ForeignIncomeCategory.GeneralCategory, // 5: checkbox D
      this.data.category === ForeignIncomeCategory.SectionE,       // 6: checkbox E
      this.data.category === ForeignIncomeCategory.CertainIncomeResourced, // 7: checkbox F
      // Line g: resident country checkbox
      false,                                                       // 8: c1_1 resident country checkbox
      'Various',                                                   // 9: f1_03 resident country
      // Part I rows i and 1a: 3 country columns
      country(0), country(1), country(2),                          // 10-12: country names
      undefined, gross(0), gross(1), gross(2),                     // 13-16: line 1a
      this.l1a(),                                                  // 17: line 1a total
      false,                                                       // 18: c1_2 line 1b checkbox
      // Lines 2-6 (3 columns each)
      deduct(0), deduct(1), deduct(2),                             // 19-21: line 2
      this.l3a(), undefined, undefined,                            // 22-24: line 3a
      apport(0), apport(1), apport(2),                             // 25-27: line 3b
      this.l3c(), undefined, undefined,                            // 28-30: line 3c
      this.l3d(), undefined, undefined,                            // 31-33: line 3d
      this.l3e(), undefined, undefined,                            // 34-36: line 3e
      this.l3f(), undefined, undefined,                            // 37-39: line 3f
      this.l3g(), undefined, undefined,                            // 40-42: line 3g
      undefined, undefined, undefined,                             // 43-45: line 4a
      undefined, undefined, undefined,                             // 46-48: line 4b
      undefined, undefined, undefined,                             // 49-51: line 5
      this.l3h(), undefined, undefined,                            // 52-54: line 6
      this.l3h(),                                                  // 55: line 7
      this.l8(),                                                   // 56: line 8 total
      // Part II: paid/accrued checkboxes
      false, false,                                                // 57-58: paid/accrued
      // Part II tax table rows A-C (3 rows x 10 fields)
      country(0), undefined, fTax(0), undefined, undefined,
      undefined, fTax(0), undefined, undefined, fTax(0),           // 59-68: row A
      country(1), undefined, fTax(1), undefined, undefined,
      undefined, fTax(1), undefined, undefined, fTax(1),           // 69-78: row B
      country(2), undefined, fTax(2), undefined, undefined,
      undefined, fTax(2), undefined, undefined, fTax(2),           // 79-88: row C
      this.l8(),                                                   // 89: line 8 total
      // Page 2
      this.l9(),                                                   // 90: line 9
      false,                                                       // 91: c2_1 line 10 checkbox
      this.l10(), this.l11(), this.l12(), this.l13(), this.l14(),  // 92-96: lines 10-14
      // Part III
      this.l15(), this.l16(), this.l17(), this.l18(),              // 97-100: lines 15-18
      this.l19(), this.l20(), this.l21(), this.l22(),              // 101-104: lines 19-22
      this.l23(), this.l24(),                                      // 105-106: lines 23-24
      // Remaining fields (Part IV and signatures)
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined,
      undefined                                                    // 107-117
    ]
  }
}
