import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form2441Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 2441 — Child and Dependent Care Expenses
 * Used to figure the amount of credit for child and dependent care expenses.
 * The credit flows to Schedule 3, line 2.
 *
 * Reference: Excel 2441 sheet (184 formulas)
 */
export default class F2441 extends F1040Attachment {
  tag: FormTag = 'f2441'
  sequenceIndex = 21

  isNeeded = (): boolean => this.f1040.info.form2441 !== undefined

  get data(): Form2441Data | undefined {
    return this.f1040.info.form2441
  }

  // Total qualifying expenses
  qualifyingExpenses = (): number =>
    this.data?.qualifyingPersons.reduce(
      (sum, qp) => sum + qp.qualifyingExpenses,
      0
    ) ?? 0

  // Line 3: Maximum qualifying expenses
  // $3,000 for one qualifying person, $6,000 for two or more
  l3MaxExpenses = (): number => {
    const numPersons = this.data?.qualifyingPersons.length ?? 0
    if (numPersons === 0) return 0
    if (numPersons === 1) return 3000
    return 6000
  }

  // Line 3: Smaller of qualifying expenses or the maximum
  l3 = (): number => Math.min(this.qualifyingExpenses(), this.l3MaxExpenses())

  // Line 4: YOUR earned income (primary taxpayer only for MFJ)
  l4 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    const wages =
      fs === FilingStatus.MFJ
        ? this.f1040
            .validW2s()
            .filter((w2) => w2.personRole === 'PRIMARY')
            .reduce((s, w2) => s + w2.income, 0)
        : this.f1040.validW2s().reduce((s, w2) => s + w2.income, 0)
    const seIncome = this.f1040.scheduleCNetProfit()
    return Math.max(0, wages + seIncome)
  }

  // Line 5: SPOUSE's earned income (if MFJ, includes wages + SE); otherwise same as line 4
  l5 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    if (fs !== FilingStatus.MFJ) return this.l4()
    const spouseWages = this.f1040
      .validW2s()
      .filter((w2) => w2.personRole === 'SPOUSE')
      .reduce((s, w2) => s + w2.income, 0)
    const spouseSE = this.f1040.scheduleFNetProfit()
    return Math.max(0, spouseWages + spouseSE)
  }

  // Line 6: Smallest of line 3, 4, or 5
  l6 = (): number => Math.min(this.l3(), this.l4(), this.l5())

  // Line 7: Employer-provided dependent care benefits (W-2 box 10)
  l7 = (): number => this.data?.employerProvidedBenefits ?? 0

  // Lines 8-17: Exclusion calculation for employer benefits
  l11 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    if (fs === FilingStatus.MFS) return 2500
    return 5000
  }

  l12 = (): number => Math.min(this.l4(), this.l5())

  l13 = (): number => Math.min(this.l7(), this.l11(), this.l12())

  l14 = (): number => Math.max(0, this.l7() - this.l13())

  l15 = (): number => this.l7() - this.l14()

  l17 = (): number => Math.max(0, this.l6() - this.l15())

  // Line 18: Qualifying expenses for credit
  l18 = (): number => {
    if (this.l7() === 0) return this.l6()
    return this.l17()
  }

  // Line 19: AGI from Form 1040 line 11
  l19 = (): number => this.f1040.l11()

  // Line 20: Credit percentage based on AGI
  // 35% for AGI <= $15,000, decreasing by 1% per $2,000 to 20% minimum
  l20 = (): number => {
    const agi = this.l19()
    if (agi <= 15000) return 0.35
    if (agi > 43000) return 0.20
    const reductionSteps = Math.ceil((agi - 15000) / 2000)
    return Math.max(0.20, 0.35 - reductionSteps * 0.01)
  }

  // Line 21: Multiply line 18 by line 20
  l21 = (): number => Math.round(this.l18() * this.l20() * 100) / 100

  // Line 22: Tax liability limit (tax minus prior nonrefundable credits)
  // Per Credit Limit Worksheet: Form 1040 line 18 minus foreign tax credit
  l22 = (): number => {
    const tax = this.f1040.l18()
    const priorCredits = this.f1040.schedule3.l1() ?? 0 // Foreign tax credit
    return Math.max(0, tax - priorCredits)
  }

  // Line 23: Credit (smaller of line 21 or line 22)
  l23 = (): number => Math.min(this.l21(), this.l22())

  // For Schedule 3 line 2
  credit = (): number | undefined =>
    this.l23() > 0 ? this.l23() : undefined

  fields = (): Field[] => {
    const providers = this.data?.careProviders ?? []
    const persons = this.data?.qualifyingPersons ?? []

    // Build care provider rows (3 rows, 6 fields each: name, address, TIN, checkbox SSN, checkbox EIN, amount)
    const providerFields: Field[] = []
    for (let i = 0; i < 3; i++) {
      const cp = providers[i]
      if (cp) {
        providerFields.push(
          cp.name, // f1_3/f1_7/f1_11
          cp.address, // f1_4/f1_8/f1_12
          cp.tin, // f1_5/f1_9/f1_13
          undefined, // c1_4[0]/c1_5[0]/c1_6[0] - SSN checkbox
          undefined, // c1_4[1]/c1_5[1]/c1_6[1] - EIN checkbox
          cp.amountPaid // f1_6/f1_10/f1_14
        )
      } else {
        providerFields.push('', '', '', false, false, '')
      }
    }

    // Build qualifying person rows (3 rows, 5 fields each: name, SSN, expenses, checkbox, amount)
    const personFields: Field[] = []
    for (let i = 0; i < 3; i++) {
      const qp = persons[i]
      if (qp) {
        personFields.push(
          qp.name, // f1_15/f1_19/f1_23
          qp.ssn, // f1_16/f1_20/f1_24
          qp.qualifyingExpenses, // f1_17/f1_21/f1_25
          false, // c1_8/c1_9/c1_10 - checkbox
          qp.qualifyingExpenses // f1_18/f1_22/f1_26
        )
      } else {
        personFields.push('', '', '', false, '')
      }
    }

    return [
      // 0: Name
      this.f1040.namesString(),
      // 1: SSN
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // 2-3: Page 1 top checkboxes
      undefined, // c1_1 checkbox
      undefined, // c1_2 checkbox
      // 4: Part I header checkbox
      undefined, // c1_3 checkbox
      // 5-22: Part I care providers (3 rows × 6 fields)
      ...providerFields,
      // 23: Checkbox after Part I
      undefined, // c1_7
      // 24-38: Part II qualifying persons (3 rows × 5 fields)
      ...personFields,
      // PDF: fields 39-49 = f1_27(maxLen=50) through f1_37(maxLen=50)
      // Fields 39-42 are text with maxLen=50 — info/continuation fields
      // Field 43 (f1_31) = Line 3 amount (no maxLen)
      // Field 44 (f1_32 maxLen=2) = number of qualifying persons
      // Fields 45-49 = Lines 4-8 and more
      // 39: f1_27 (maxLen=50) — Line 2 continuation
      undefined,
      // 40: f1_28 (maxLen=50) — Line 2 continuation
      undefined,
      // 41: f1_29 (maxLen=50) — Line 2 continuation
      undefined,
      // 42: f1_30 (maxLen=50) — Line 2 continuation
      undefined,
      // 43: f1_31 — Line 3: Qualifying expenses
      this.l3(),
      // 44: f1_32 (maxLen=2) — Number of qualifying persons
      persons.length > 0 ? persons.length : undefined,
      // 45: f1_33 (maxLen=50) — Line 4: Your earned income
      this.l4(),
      // 46: f1_34 (maxLen=50) — Line 5: Spouse earned income
      this.l5(),
      // 47: f1_35 (maxLen=50) — Line 6: Smallest of 3, 4, or 5
      this.l6(),
      // 48: f1_36 — Line 7: Employer-provided benefits
      this.l7(),
      // 49: f1_37 (maxLen=50) — Line 8
      this.l6(),
      // Page 2
      // 50: f2_1 (maxLen=50) — Page 2 name
      this.f1040.namesString(),
      // 51: f2_2 (maxLen=50) — Page 2 SSN
      this.f1040.info.taxPayer.primaryPerson.ssid,
      // 52: f2_3 — Line 9/10
      this.l7(),
      // 53: f2_4 (maxLen=50) — Line 11
      this.l11(),
      // 54: f2_5 (maxLen=50) — Line 12
      this.l12(),
      // 55: f2_6 (maxLen=50) — Line 13
      this.l13(),
      // 56: f2_7 (maxLen=50) — Line 14
      this.l14(),
      // 57: f2_8 (maxLen=50) — Line 15
      this.l15(),
      // 58: f2_9 (maxLen=50) — Line 16
      0,
      // 59: f2_10 (maxLen=50) — Line 17
      this.l17(),
      // 60-61: c2_1[0,1] — Line 18 Yes/No checkboxes
      undefined, // c2_1[0]
      undefined, // c2_1[1]
      // 62: f2_11 (maxLen=50) — Line 18 amount
      this.l18(),
      // 63: f2_12 (maxLen=50) — Line 19
      this.l19(),
      // 64: f2_13 (maxLen=50) — Line 20 decimal
      this.l20() > 0 ? this.l20().toFixed(2) : undefined,
      // 65: f2_14 (maxLen=50) — Line 21
      this.l21(),
      // 66: f2_15 — Line 22
      this.l22(),
      // 67: f2_16 (maxLen=50) — Line 23
      undefined,
      // 68: f2_17 (maxLen=50) — Line 24
      undefined,
      // 69: f2_18 (maxLen=50) — Line 25
      undefined,
      // 70: f2_19 (maxLen=50) — Line 26
      undefined,
      // 71: f2_20 (maxLen=50) — Line 31 credit
      this.l23()
    ]
  }
}
