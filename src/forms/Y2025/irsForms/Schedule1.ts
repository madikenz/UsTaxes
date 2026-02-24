import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'
import { Field } from 'ustaxes/core/pdfFiller'

export default class Schedule1 extends F1040Attachment {
  tag: FormTag = 'f1040s1'
  sequenceIndex = 1
  otherIncomeStrings: Set<string>

  constructor(f1040: F1040) {
    super(f1040)
    this.otherIncomeStrings = new Set<string>()
  }

  isNeeded = (): boolean =>
    this.f1040.scheduleE.isNeeded() ||
    (this.f1040.scheduleC?.isNeeded() ?? false) ||
    (this.f1040.scheduleF?.isNeeded() ?? false) ||
    (this.f1040.f4797?.l7() ?? 0) !== 0 ||
    (this.f1040.f2555?.l50() ?? 0) > 0 ||
    (this.f1040.studentLoanInterestWorksheet !== undefined &&
      this.f1040.studentLoanInterestWorksheet.notMFS() &&
      this.f1040.studentLoanInterestWorksheet.isNotDependent()) ||
    this.f1040.f8889.isNeeded() ||
    (this.f1040.f8889Spouse?.isNeeded() ?? false) ||
    this.f1040.f8814TotalIncome() > 0 ||
    (this.f1040.info.f1099gs ?? []).length > 0 ||
    (this.f1040.info.educatorExpenses ?? 0) > 0 ||
    (this.f1040.info.selfEmploymentRetirementContributions ?? 0) > 0 ||
    (this.f1040.info.selfEmploymentHealthInsurance ?? 0) > 0 ||
    this.l18() !== undefined

  // Line 1: Taxable refunds from 1099-G (state/local tax refunds)
  // Only taxable if taxpayer itemized in the prior year
  l1 = (): number | undefined => {
    const refunds = (this.f1040.info.f1099gs ?? []).reduce(
      (sum, g) => sum + g.form.stateLocalTaxRefund,
      0
    )
    return refunds > 0 ? refunds : undefined
  }
  l2a = (): number | undefined => undefined
  l2b = (): number | undefined => undefined
  l3 = (): number | undefined =>
    this.f1040.scheduleCNetProfit() !== 0
      ? this.f1040.scheduleCNetProfit()
      : undefined
  l4 = (): number | undefined => this.f1040.f4797?.l18b()
  l5 = (): number | undefined => this.f1040.scheduleE.l41()
  l6 = (): number | undefined =>
    this.f1040.scheduleFNetProfit() !== 0
      ? this.f1040.scheduleFNetProfit()
      : undefined
  // Line 7: Unemployment compensation from 1099-G
  l7 = (): number | undefined => {
    const unemployment = (this.f1040.info.f1099gs ?? []).reduce(
      (sum, g) => sum + g.form.unemploymentCompensation,
      0
    )
    return unemployment > 0 ? unemployment : undefined
  }
  // Line 8a: Prizes, awards, gambling winnings
  l8a = (): number | undefined => this.f1040.info.gamblingIncome ?? undefined
  l8b = (): number | undefined => undefined
  // Line 8c: Cancellation of debt
  l8c = (): number | undefined => this.f1040.info.cancellationOfDebtIncome ?? undefined
  l8d = (): number | undefined => {
    const exclusion = this.f1040.f2555?.l50() ?? 0
    return exclusion > 0 ? -exclusion : undefined
  }
  l8e = (): number | undefined => undefined
  l8f = (): number | undefined =>
    sumFields([this.f1040.f8889.l16(), this.f1040.f8889Spouse?.l16()])
  l8g = (): number | undefined => undefined
  l8h = (): number | undefined => undefined
  l8i = (): number | undefined => undefined
  l8j = (): number | undefined => undefined
  l8k = (): number | undefined => undefined
  l8l = (): number | undefined => undefined
  l8m = (): number | undefined => undefined
  l8n = (): number | undefined => {
    const income = this.f1040.f8814TotalIncome()
    return income > 0 ? income : undefined
  }
  l8o = (): number | undefined => undefined
  // Line 8p: 529/ABLE plan distributions
  l8p = (): number | undefined => this.f1040.info.section529Distributions ?? undefined
  // Line 8q: Scholarship/fellowship income not on W-2
  l8q = (): number | undefined => this.f1040.info.scholarshipIncome ?? undefined
  l8r = (): number | undefined => undefined
  l8s = (): number | undefined => undefined
  l8t = (): number | undefined => undefined
  l8u = (): number | undefined => undefined
  l8v = (): number | undefined => undefined

  l8z = (): number => {
    if (
      (this.f1040.f8889.isNeeded() && this.f1040.f8889.l20() > 0) ||
      ((this.f1040.f8889Spouse?.isNeeded() ?? false) &&
        this.f1040.f8889Spouse?.l20() !== undefined &&
        this.f1040.f8889Spouse.l20() > 0)
    ) {
      this.otherIncomeStrings.add('HSA')
    }

    return sumFields([this.f1040.f8889.l20(), this.f1040.f8889Spouse?.l20()])
  }

  l9 = (): number =>
    sumFields([
      this.l8a(),
      this.l8b(),
      this.l8c(),
      this.l8d(),
      this.l8e(),
      this.l8f(),
      this.l8g(),
      this.l8h(),
      this.l8i(),
      this.l8j(),
      this.l8k(),
      this.l8l(),
      this.l8m(),
      this.l8n(),
      this.l8o(),
      this.l8p(),
      this.l8q(),
      this.l8r(),
      this.l8s(),
      this.l8t(),
      this.l8u(),
      this.l8v(),
      this.l8z()
    ])

  l10 = (): number =>
    sumFields([
      this.l1(),
      this.l2a(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l9()
    ])

  to1040Line8 = (): number => this.l10()

  // Line 11: Educator expenses (max $300 per educator, $600 MFJ with two educators)
  l11 = (): number | undefined => {
    const expenses = this.f1040.info.educatorExpenses
    if (expenses === undefined || expenses <= 0) return undefined
    const limit =
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ ? 600 : 300
    return Math.min(expenses, limit)
  }
  l12 = (): number | undefined => undefined
  l13 = (): number | undefined =>
    sumFields([this.f1040.f8889.l13(), this.f1040.f8889Spouse?.l13()])
  l14 = (): number | undefined => undefined
  l15 = (): number | undefined => this.f1040.scheduleSE.l13()
  // Line 16: Self-employed SEP, SIMPLE, and qualified plans
  l16 = (): number | undefined =>
    this.f1040.info.selfEmploymentRetirementContributions ?? undefined
  // Line 17: Self-employed health insurance deduction
  l17 = (): number | undefined =>
    this.f1040.info.selfEmploymentHealthInsurance ?? undefined
  // Line 18: Penalty on early withdrawal of savings (from 1099-INT box 2)
  l18 = (): number | undefined => {
    const penalty = this.f1040.f1099Ints().reduce(
      (sum, f) => sum + (f.form.earlyWithdrawalPenalty ?? 0),
      0
    )
    return penalty > 0 ? penalty : undefined
  }
  // Line 19a: IRA deduction (from IRA Deduction Worksheet)
  l19a = (): number | undefined => this.f1040.info.iraDeduction ?? undefined
  l19b = (): string | undefined => undefined
  l19c = (): string | undefined => undefined
  l20 = (): number | undefined => undefined
  l21 = (): number | undefined => this.f1040.studentLoanInterestWorksheet?.l9()
  l23 = (): number | undefined => undefined
  l24a = (): number | undefined => undefined
  l24b = (): number | undefined => undefined
  l24c = (): number | undefined => undefined
  l24d = (): number | undefined => undefined
  l24e = (): number | undefined => undefined
  l24f = (): number | undefined => undefined
  l24g = (): number | undefined => undefined
  l24h = (): number | undefined => undefined
  l24i = (): number | undefined => undefined
  l24j = (): number | undefined => undefined
  l24k = (): number | undefined => undefined
  l24zDesc = (): string | undefined => undefined
  l24zDesc2 = (): string | undefined => undefined
  l24z = (): number | undefined => undefined

  l25 = (): number =>
    sumFields([
      this.l24a(),
      this.l24b(),
      this.l24c(),
      this.l24d(),
      this.l24e(),
      this.l24f(),
      this.l24g(),
      this.l24h(),
      this.l24i(),
      this.l24j(),
      this.l24k(),
      this.l24z()
    ])

  l26 = (): number =>
    sumFields([
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19a(),
      this.l20(),
      this.l21(),
      this.l23(),
      this.l25()
    ])

  to1040Line10 = (): number => this.l26()

  fields = (): Field[] => [
    // Page 1 — 41 fields (indices 0-40)
    this.f1040.namesString(),                          // 0: f1_01 name
    this.f1040.info.taxPayer.primaryPerson.ssid,        // 1: f1_02 SSN
    this.l1(),                                          // 2: f1_03 line 1
    this.l2a(),                                         // 3: f1_04 line 2a
    this.l2b(),                                         // 4: f1_05 line 2b
    this.l3(),                                          // 5: f1_06 line 3
    this.l4(),                                          // 6: f1_07 line 4
    this.f1040.scheduleC?.isNeeded() ?? false,          // 7: c1_1 Schedule C checkbox
    this.f1040.scheduleF?.isNeeded() ?? false,          // 8: c1_2 Schedule F checkbox
    this.l5(),                                          // 9: f1_08 line 5
    this.l6(),                                          // 10: f1_09 line 6
    this.l7(),                                          // 11: f1_10 line 7
    false,                                              // 12: c1_3 line 7 checkbox
    undefined,                                          // 13: f1_11 line 7 amount (supplemental)
    undefined,                                          // 14: f1_12 (reserved or additional)
    this.l8a(),                                         // 15: f1_13 line 8a
    this.l8b(),                                         // 16: f1_14 line 8b
    this.l8c(),                                         // 17: f1_15 line 8c
    this.l8d(),                                         // 18: f1_16 line 8d
    this.l8e(),                                         // 19: f1_17 line 8e
    this.l8f(),                                         // 20: f1_18 line 8f
    this.l8g(),                                         // 21: f1_19 line 8g
    this.l8h(),                                         // 22: f1_20 line 8h
    this.l8i(),                                         // 23: f1_21 line 8i
    this.l8j(),                                         // 24: f1_22 line 8j
    this.l8k(),                                         // 25: f1_23 line 8k
    this.l8l(),                                         // 26: f1_24 line 8l
    this.l8m(),                                         // 27: f1_25 line 8m
    this.l8n(),                                         // 28: f1_26 line 8n
    this.l8o(),                                         // 29: f1_27 line 8o
    this.l8p(),                                         // 30: f1_28 line 8p
    this.l8q(),                                         // 31: f1_29 line 8q
    this.l8r(),                                         // 32: f1_30 line 8r
    this.l8s(),                                         // 33: f1_31 line 8s
    this.l8t(),                                         // 34: f1_32 line 8t
    this.l8u(),                                         // 35: f1_33 line 8u
    this.l8v(),                                         // 36: f1_34 line 8v
    Array.from(this.otherIncomeStrings).join(' '),      // 37: f1_35 line 8z description
    this.l8z(),                                         // 38: f1_36 line 8z amount
    this.l9(),                                          // 39: f1_37 line 9
    this.l10(),                                         // 40: f1_38 line 10
    // Page 2 — 32 fields (indices 41-72)
    this.f1040.namesString(),                           // 41: f2_01 name (page 2)
    this.f1040.info.taxPayer.primaryPerson.ssid,        // 42: f2_02 SSN (page 2)
    this.l11(),                                         // 43: f2_03 line 11
    false,                                              // 44: c2_1 checkbox (line 14 or reserved)
    this.l12(),                                         // 45: f2_04 line 12
    this.l13(),                                         // 46: f2_05 line 13
    this.l14(),                                         // 47: f2_06 line 14
    this.l15(),                                         // 48: f2_07 line 15
    this.l16(),                                         // 49: f2_08 line 16
    this.l17(),                                         // 50: f2_09 line 17
    this.l18(),                                         // 51: f2_10 line 18
    this.l19a(),                                        // 52: f2_11 line 19a
    false,                                              // 53: c2_2 checkbox (line 19 Sch C/F)
    this.l19b(),                                        // 54: f2_12 line 19b
    this.l19c(),                                        // 55: f2_13 line 19c
    this.l20(),                                         // 56: f2_14 line 20
    this.l21(),                                         // 57: f2_15 line 21
    this.l23(),                                         // 58: f2_16 line 23
    this.l24a(),                                        // 59: f2_17 line 24a
    this.l24b(),                                        // 60: f2_18 line 24b
    this.l24c(),                                        // 61: f2_19 line 24c
    this.l24d(),                                        // 62: f2_20 line 24d
    this.l24e(),                                        // 63: f2_21 line 24e
    this.l24f(),                                        // 64: f2_22 line 24f
    this.l24g(),                                        // 65: f2_23 line 24g
    this.l24h(),                                        // 66: f2_24 line 24h
    this.l24i(),                                        // 67: f2_25 line 24i
    this.l24j(),                                        // 68: f2_26 line 24j
    this.l24k(),                                        // 69: f2_27 line 24k
    this.l24zDesc(),                                    // 70: f2_28 line 24z desc
    this.l24z(),                                        // 71: f2_29 line 24z amount
    this.l25(),                                         // 72: f2_30 line 25 (subtotal 24a-24z)
    this.l26()                                          // 73: f2_31 line 26 (total)
  ]
}
