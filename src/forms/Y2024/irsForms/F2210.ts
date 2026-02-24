import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form2210Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 2210 — Underpayment of Estimated Tax by Individuals,
 * Estates, and Trusts
 *
 * Calculates penalty for underpayment of estimated taxes.
 * The penalty flows to F1040 line 38.
 *
 * The IRS typically calculates this penalty automatically,
 * but taxpayers may compute it themselves if they:
 * - Want to use the annualized income installment method
 * - Filed late estimated payments
 * - Had uneven income during the year
 *
 * Reference: 2024 Form 2210 instructions (272 Excel formulas)
 */
export default class F2210 extends F1040Attachment {
  tag: FormTag = 'f2210'
  sequenceIndex = 66

  readonly data: Form2210Data

  constructor(f1040: F1040, data: Form2210Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form2210 !== undefined

  // --- Part I: Required Annual Payment ---

  // Line 1: Current year tax (from F1040 line 24)
  l1 = (): number => this.f1040.l24()

  // Line 2: Credits and other payments already accounted for
  // Multiply Schedule 3, line 11 by percentage
  l2 = (): number => 0

  // Line 3: Current year tax after credits = line 1 - line 2
  l3 = (): number => Math.max(0, this.l1() - this.l2())

  // Line 4: Multiply line 3 by 90% (0.90)
  // (For farmers/fishermen, multiply by 66.67%)
  l4 = (): number => Math.round(this.l3() * 0.9 * 100) / 100

  // Line 5: Withholding taxes (from F1040 line 25d)
  l5 = (): number => this.f1040.l25d()

  // Line 6: Subtract line 5 from line 3. If <= $1,000, no penalty.
  l6 = (): number => Math.max(0, this.l3() - this.l5())

  // Line 7: Is line 6 less than $1,000? If yes, no penalty.
  l7NoPenalty = (): boolean => this.l6() < 1000

  // Line 8: Required annual payment (larger of line 4 or prior year tax)
  l8 = (): number => Math.max(this.l4(), this.l9())

  // Line 9: Prior year tax (100% or 110% if AGI > $150,000)
  l9 = (): number => {
    const threshold =
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS
        ? 75000
        : 150000
    const multiplier = this.f1040.l11() > threshold ? 1.1 : 1.0
    return Math.round(this.data.priorYearTax * multiplier * 100) / 100
  }

  // Line 10: Required annual payment = smaller of line 8 or line 3
  l10 = (): number => Math.min(this.l8(), this.l3())

  // --- Part II: Reasons for Filing ---
  // Simplified: check if any penalty applies

  // Line 11: If withholding >= required annual payment, no penalty
  l11NoPenalty = (): boolean => this.l5() >= this.l10()

  // --- Part III/IV: Penalty Calculation (Short Method) ---
  // Using the short method (equal quarterly payments assumed)

  // Required quarterly payment
  requiredQuarterlyPayment = (): number =>
    Math.round((this.l10() / 4) * 100) / 100

  // Total estimated payments made
  totalEstimatedPayments = (): number =>
    this.data.estimatedPayments.reduce((sum, p) => sum + p.amount, 0)

  // Total payments (withholding + estimated)
  totalPayments = (): number => this.l5() + this.totalEstimatedPayments()

  // Line 15: Underpayment amount (required payment minus withholding only)
  l15 = (): number => Math.max(0, this.l10() - this.l5())

  // Line 17: Penalty rate for 2024 (8% annual, per IRS)
  penaltyRate = (): number => 0.08

  // Penalty calculation (Short Method — Part III)
  // Each quarter's underpayment accrues penalty from its due date to
  // the filing due date (4/15 next year):
  //   Q1 (4/15→4/15): 365 days
  //   Q2 (6/15→4/15): 304 days
  //   Q3 (9/15→4/15): 212 days
  //   Q4 (1/15→4/15):  90 days
  //   Total = 971 days across 4 quarters
  penalty = (): number => {
    if (this.l7NoPenalty() || this.l11NoPenalty()) return 0

    // Net underpayment = gross underpayment - estimated payments made
    const netUnderpayment = Math.max(
      0,
      this.l15() - this.totalEstimatedPayments()
    )
    if (netUnderpayment <= 0) return 0

    // Short Method: weighted average of quarterly penalty periods
    const totalDays = 365 + 304 + 212 + 90 // 971
    const penaltyFactor = totalDays / (4 * 365)
    return Math.round(
      netUnderpayment * this.penaltyRate() * penaltyFactor * 100
    ) / 100
  }

  // --- Part IV: Regular Method ---
  // Tracks each quarter's underpayment separately

  // Quarterly due dates (month/day): Q1=4/15, Q2=6/15, Q3=9/15, Q4=1/15 next year
  // Days from each due date to filing deadline (4/15 next year):
  private quarterDays = [365, 304, 212, 90] as const

  // Line 19: Required installment per quarter (25% of line 10)
  private regularL19 = (): [number, number, number, number] => {
    const q = this.requiredQuarterlyPayment()
    return [q, q, q, q]
  }

  // Line 20: Estimated tax paid each quarter
  private regularL20 = (): [number, number, number, number] => [
    this.data.estimatedPayments[0]?.amount ?? 0,
    this.data.estimatedPayments[1]?.amount ?? 0,
    this.data.estimatedPayments[2]?.amount ?? 0,
    this.data.estimatedPayments[3]?.amount ?? 0
  ]

  // Line 21: Withholding allocated equally to each quarter
  private regularL21 = (): [number, number, number, number] => {
    const perQ = Math.round((this.l5() / 4) * 100) / 100
    return [perQ, perQ, perQ, perQ]
  }

  // Lines 22-27: Quarterly underpayment/overpayment tracking
  private regularQuarterlyCalc = (): {
    l22: number[]
    l23: number[]
    l24: number[] // underpayment
    l25: number[] // overpayment carried forward
  } => {
    const l19 = this.regularL19()
    const l20 = this.regularL20()
    const l21 = this.regularL21()

    const l22 = [0, 0, 0, 0]
    const l23 = [0, 0, 0, 0]
    const l24 = [0, 0, 0, 0] // underpayment
    const l25 = [0, 0, 0, 0] // overpayment

    for (let i = 0; i < 4; i++) {
      l22[i] = l20[i] + l21[i]
      l23[i] = l22[i] + (i > 0 ? l25[i - 1] : 0)

      if (l23[i] < l19[i]) {
        l24[i] = Math.round((l19[i] - l23[i]) * 100) / 100
        l25[i] = 0
      } else {
        l24[i] = 0
        l25[i] = Math.round((l23[i] - l19[i]) * 100) / 100
      }
    }

    return { l22, l23, l24, l25 }
  }

  // Regular method penalty per quarter
  regularPenalty = (): number => {
    if (this.l7NoPenalty() || this.l11NoPenalty()) return 0

    const { l24 } = this.regularQuarterlyCalc()
    const rate = this.penaltyRate()

    let totalPenalty = 0
    for (let i = 0; i < 4; i++) {
      if (l24[i] > 0) {
        // Penalty = underpayment * (days/365) * annual rate
        const days = this.quarterDays[i]
        totalPenalty += l24[i] * (days / 365) * rate
      }
    }

    return Math.round(totalPenalty * 100) / 100
  }

  // Regular method: penalty per quarter for fields output
  private quarterlyPenalties = (): [number, number, number, number] => {
    const { l24 } = this.regularQuarterlyCalc()
    const rate = this.penaltyRate()
    return [
      Math.round(l24[0] * (this.quarterDays[0] / 365) * rate * 100) / 100,
      Math.round(l24[1] * (this.quarterDays[1] / 365) * rate * 100) / 100,
      Math.round(l24[2] * (this.quarterDays[2] / 365) * rate * 100) / 100,
      Math.round(l24[3] * (this.quarterDays[3] / 365) * rate * 100) / 100
    ]
  }

  // For F1040 line 38
  estimatedTaxPenalty = (): number | undefined => {
    const p = this.penalty()
    return p > 0 ? p : undefined
  }

  fields = (): Field[] => [
    // ===== Page 1 (fields 0-24) =====

    // --- Header ---
    this.f1040.namesString(),                   // 0: Name
    this.f1040.info.taxPayer.primaryPerson.ssid, // 1: SSN

    // --- Part I: Required Annual Payment (lines 1-10) ---
    // PDF has f1_3..f1_11 (9 text fields in a 2-column table for lines 1-9)
    this.l1(),                                   // 2: f1_3 Line 1 left column
    undefined,                                   // 3: f1_4 Line 1 right column
    this.l3(),                                   // 4: f1_5 Line 3
    this.l4(),                                   // 5: f1_6 Line 4
    this.l5(),                                   // 6: f1_7 Line 5
    this.l6(),                                   // 7: f1_8 Line 6
    this.l8(),                                   // 8: f1_9 Line 8
    this.l9(),                                   // 9: f1_10 Line 9
    this.l10(),                                  // 10: f1_11 Line 10

    // --- Part II: Reasons for Filing (checkboxes A-G) ---
    this.l7NoPenalty(),                          // 11: c1_1[0] Checkbox A (line 7 < $1,000)
    this.data.useAnnualizedMethod ?? false,      // 12: c1_1[1] Checkbox B — Annualized income
    undefined,                                   // 13: c1_2[0] Checkbox C — Joint return after separate
    undefined,                                   // 14: c1_3[0] Checkbox D
    undefined,                                   // 15: c1_4[0] Checkbox E — Penalty computed
    undefined,                                   // 16: c1_5[0] Checkbox F
    undefined,                                   // 17: c1_6[0] Checkbox G

    // --- Part III: Short Method (lines 13-18) ---
    this.l10(),                                  // 18: Line 13 — enter amount from line 10
    this.l5(),                                   // 19: Line 14 — enter withholding (line 5)
    this.l15(),                                  // 20: Line 15 — line 13 minus line 14
    this.totalEstimatedPayments(),               // 21: Line 16 — total estimated tax payments
    undefined,                                   // 22: Line 17 — number of days * rate
    this.penalty(),                              // 23: Line 18 — penalty
    undefined,                                   // 24: Waiver checkbox (check if waiver applies)

    // ===== Page 2: Part IV Regular Method (fields 25-93) =====

    // --- Section A: Figure Your Underpayment (lines 19-27, 4 columns) ---
    // Line 19: Required installment (25% of line 9)
    this.requiredQuarterlyPayment(),             // 25: Line 19, col (a) Q1 — 4/15
    this.requiredQuarterlyPayment(),             // 26: Line 19, col (b) Q2 — 6/15
    this.requiredQuarterlyPayment(),             // 27: Line 19, col (c) Q3 — 9/15
    this.requiredQuarterlyPayment(),             // 28: Line 19, col (d) Q4 — 1/15

    // Line 20: Estimated tax paid each quarter
    this.data.estimatedPayments[0]?.amount,      // 29: Line 20, col (a)
    this.data.estimatedPayments[1]?.amount,      // 30: Line 20, col (b)
    this.data.estimatedPayments[2]?.amount,      // 31: Line 20, col (c)
    this.data.estimatedPayments[3]?.amount,      // 32: Line 20, col (d)

    // Line 21: Withholding (allocated equally or as provided)
    ...(() => { const w = this.regularL21(); return [w[0], w[1], w[2], w[3]] })(),

    // Line 22: Add lines 20 and 21
    ...(() => { const c = this.regularQuarterlyCalc(); return [c.l22[0], c.l22[1], c.l22[2], c.l22[3]] })(),

    // Line 23: Add lines 25 and 22
    ...(() => { const c = this.regularQuarterlyCalc(); return [c.l23[0], c.l23[1], c.l23[2], c.l23[3]] })(),

    // Line 24: Subtract line 23 from line 19 (underpayment each quarter)
    ...(() => { const c = this.regularQuarterlyCalc(); return [c.l24[0], c.l24[1], c.l24[2], c.l24[3]] })(),

    // Line 25: Overpayment from prior column
    0,                                           // 49: Line 25, col (a) — no prior
    ...(() => { const c = this.regularQuarterlyCalc(); return [c.l25[0], c.l25[1], c.l25[2]] })(),

    // Line 26: Underpayment (same as line 24)
    ...(() => { const c = this.regularQuarterlyCalc(); return [c.l24[0], c.l24[1], c.l24[2], c.l24[3]] })(),

    // Line 27: Overpayment (same as line 25)
    ...(() => { const c = this.regularQuarterlyCalc(); return [c.l25[0], c.l25[1], c.l25[2], c.l25[3]] })(),

    // --- Section B: Figure the Penalty (lines 28-35, 4 columns) ---
    // Line 28: Number of days underpayment from due date to payment/4-15
    this.quarterDays[0],                         // 61: Line 28, col (a) — 365
    this.quarterDays[1],                         // 62: Line 28, col (b) — 304
    this.quarterDays[2],                         // 63: Line 28, col (c) — 212
    this.quarterDays[3],                         // 64: Line 28, col (d) — 90

    // Line 29: Underpayment * days/365 * rate (first period penalty)
    ...(() => { const p = this.quarterlyPenalties(); return [p[0], p[1], p[2], p[3]] })(),

    // Line 30: Number of days (second period — rate change within quarter)
    undefined,                                   // 69: Line 30, col (a)
    undefined,                                   // 70: Line 30, col (b)
    undefined,                                   // 71: Line 30, col (c)
    undefined,                                   // 72: Line 30, col (d)

    // Line 31: Penalty for second period
    undefined,                                   // 73: Line 31, col (a)
    undefined,                                   // 74: Line 31, col (b)
    undefined,                                   // 75: Line 31, col (c)
    undefined,                                   // 76: Line 31, col (d)

    // Line 32: Number of days (third period)
    undefined,                                   // 77: Line 32, col (a)
    undefined,                                   // 78: Line 32, col (b)
    undefined,                                   // 79: Line 32, col (c)
    undefined,                                   // 80: Line 32, col (d)

    // Line 33: Penalty for third period
    undefined,                                   // 81: Line 33, col (a)
    undefined,                                   // 82: Line 33, col (b)
    undefined,                                   // 83: Line 33, col (c)
    undefined,                                   // 84: Line 33, col (d)

    // Line 34: Penalty per column (sum of penalty periods)
    ...(() => { const p = this.quarterlyPenalties(); return [p[0], p[1], p[2], p[3]] })(),

    // Line 35: Penalty (add columns of line 34) + name/SSN repeat
    this.regularPenalty(),                        // 89: Line 35 — total penalty
    this.f1040.namesString(),                    // 90: Name (page 2 header)
    this.f1040.info.taxPayer.primaryPerson.ssid,  // 91: SSN (page 2 header)
    undefined,                                   // 92: Reserved / extra field
    undefined,                                   // 93: Reserved / extra field

    // ===== Page 3: Schedule AI — Annualized Income Installment Method =====
    // ===== Part I (fields 94-148 = 55 fields) =====

    // Schedule AI header
    undefined,                                   // 94: Name (Schedule AI header)
    undefined,                                   // 95: SSN (Schedule AI header)

    // Line 1: Annualized income for each period
    undefined,                                   // 96: AI Line 1, col (a) — 1/1-3/31
    undefined,                                   // 97: AI Line 1, col (b) — 1/1-5/31
    undefined,                                   // 98: AI Line 1, col (c) — 1/1-8/31
    undefined,                                   // 99: AI Line 1, col (d) — 1/1-12/31

    // Line 2: Annualization amounts
    undefined,                                   // 100: AI Line 2, col (a) — 4
    undefined,                                   // 101: AI Line 2, col (b) — 2.4
    undefined,                                   // 102: AI Line 2, col (c) — 1.5
    undefined,                                   // 103: AI Line 2, col (d) — 1

    // Line 3: Annualized income (line 1 * line 2)
    undefined,                                   // 104: AI Line 3, col (a)
    undefined,                                   // 105: AI Line 3, col (b)
    undefined,                                   // 106: AI Line 3, col (c)
    undefined,                                   // 107: AI Line 3, col (d)

    // Line 4: Itemized deductions for period
    undefined,                                   // 108: AI Line 4, col (a)
    undefined,                                   // 109: AI Line 4, col (b)
    undefined,                                   // 110: AI Line 4, col (c)
    undefined,                                   // 111: AI Line 4, col (d)

    // Line 5: Annualization amounts for deductions
    undefined,                                   // 112: AI Line 5, col (a)
    undefined,                                   // 113: AI Line 5, col (b)
    undefined,                                   // 114: AI Line 5, col (c)
    undefined,                                   // 115: AI Line 5, col (d)

    // Line 6: Annualized deductions (line 4 * line 5)
    undefined,                                   // 116: AI Line 6, col (a)
    undefined,                                   // 117: AI Line 6, col (b)
    undefined,                                   // 118: AI Line 6, col (c)
    undefined,                                   // 119: AI Line 6, col (d)

    // Line 7: Standard deduction or line 6
    undefined,                                   // 120: AI Line 7, col (a)
    undefined,                                   // 121: AI Line 7, col (b)
    undefined,                                   // 122: AI Line 7, col (c)
    undefined,                                   // 123: AI Line 7, col (d)

    // Line 8: Subtract line 7 from line 3
    undefined,                                   // 124: AI Line 8, col (a)
    undefined,                                   // 125: AI Line 8, col (b)
    undefined,                                   // 126: AI Line 8, col (c)
    undefined,                                   // 127: AI Line 8, col (d)

    // Line 9: Exemption amount
    undefined,                                   // 128: AI Line 9, col (a)
    undefined,                                   // 129: AI Line 9, col (b)
    undefined,                                   // 130: AI Line 9, col (c)
    undefined,                                   // 131: AI Line 9, col (d)

    // Line 10: Taxable income (line 8 minus line 9)
    undefined,                                   // 132: AI Line 10, col (a)
    undefined,                                   // 133: AI Line 10, col (b)
    undefined,                                   // 134: AI Line 10, col (c)
    undefined,                                   // 135: AI Line 10, col (d)

    // Line 11: Tax on line 10
    undefined,                                   // 136: AI Line 11, col (a)
    undefined,                                   // 137: AI Line 11, col (b)
    undefined,                                   // 138: AI Line 11, col (c)
    undefined,                                   // 139: AI Line 11, col (d)

    // Line 12: Other taxes for period
    undefined,                                   // 140: AI Line 12, col (a)
    undefined,                                   // 141: AI Line 12, col (b)
    undefined,                                   // 142: AI Line 12, col (c)
    undefined,                                   // 143: AI Line 12, col (d)

    // Line 13: Total tax (line 11 + line 12)
    undefined,                                   // 144: AI Line 13, col (a)
    undefined,                                   // 145: AI Line 13, col (b)
    undefined,                                   // 146: AI Line 13, col (c)
    undefined,                                   // 147: AI Line 13, col (d)

    // Line 14: Credits for period
    undefined,                                   // 148: AI Line 14, col (a)

    // ===== Page 4: Schedule AI continued (fields 149-198 = 50 fields) =====

    undefined,                                   // 149: AI Line 14, col (b)
    undefined,                                   // 150: AI Line 14, col (c)
    undefined,                                   // 151: AI Line 14, col (d)

    // Line 15: Subtract line 14 from line 13
    undefined,                                   // 152: AI Line 15, col (a)
    undefined,                                   // 153: AI Line 15, col (b)
    undefined,                                   // 154: AI Line 15, col (c)
    undefined,                                   // 155: AI Line 15, col (d)

    // Line 16: Self-employment tax for period
    undefined,                                   // 156: AI Line 16, col (a)
    undefined,                                   // 157: AI Line 16, col (b)
    undefined,                                   // 158: AI Line 16, col (c)
    undefined,                                   // 159: AI Line 16, col (d)

    // Line 17: Other taxes annualized
    undefined,                                   // 160: AI Line 17, col (a)
    undefined,                                   // 161: AI Line 17, col (b)
    undefined,                                   // 162: AI Line 17, col (c)
    undefined,                                   // 163: AI Line 17, col (d)

    // Line 18: Total annualized tax (line 15 + 16 + 17)
    undefined,                                   // 164: AI Line 18, col (a)
    undefined,                                   // 165: AI Line 18, col (b)
    undefined,                                   // 166: AI Line 18, col (c)
    undefined,                                   // 167: AI Line 18, col (d)

    // Line 19: Applicable percentage (22.5%, 45%, 67.5%, 90%)
    undefined,                                   // 168: AI Line 19, col (a)
    undefined,                                   // 169: AI Line 19, col (b)
    undefined,                                   // 170: AI Line 19, col (c)
    undefined,                                   // 171: AI Line 19, col (d)

    // Line 20: Multiply line 18 by line 19
    undefined,                                   // 172: AI Line 20, col (a)
    undefined,                                   // 173: AI Line 20, col (b)
    undefined,                                   // 174: AI Line 20, col (c)
    undefined,                                   // 175: AI Line 20, col (d)

    // --- Part II: Annualized Self-Employment Tax ---
    // Line 21: Net SE income for period
    undefined,                                   // 176: AI Line 21, col (a)
    undefined,                                   // 177: AI Line 21, col (b)
    undefined,                                   // 178: AI Line 21, col (c)
    undefined,                                   // 179: AI Line 21, col (d)

    // Line 22: Prorated social security tax limit
    undefined,                                   // 180: AI Line 22, col (a)
    undefined,                                   // 181: AI Line 22, col (b)
    undefined,                                   // 182: AI Line 22, col (c)
    undefined,                                   // 183: AI Line 22, col (d)

    // Line 23: Annualized SE tax
    undefined,                                   // 184: AI Line 23, col (a)
    undefined,                                   // 185: AI Line 23, col (b)
    undefined,                                   // 186: AI Line 23, col (c)
    undefined,                                   // 187: AI Line 23, col (d)

    // --- Part III: Required Installments ---
    // Line 24: Enter required installments from Part IV line 19
    undefined,                                   // 188: AI Line 24, col (a)
    undefined,                                   // 189: AI Line 24, col (b)
    undefined,                                   // 190: AI Line 24, col (c)
    undefined,                                   // 191: AI Line 24, col (d)

    // Line 25: Annualized installment from line 20 less prior column amounts
    undefined,                                   // 192: AI Line 25, col (a)
    undefined,                                   // 193: AI Line 25, col (b)
    undefined,                                   // 194: AI Line 25, col (c)
    undefined,                                   // 195: AI Line 25, col (d)

    // Line 26: Enter the smaller of line 24 or line 25
    undefined,                                   // 196: AI Line 26, col (a)
    undefined,                                   // 197: AI Line 26, col (b)
    undefined                                    // 198: AI Line 26, col (c)
    // Note: field 198 is the last field (index 198 = 199th field)
  ]
}
