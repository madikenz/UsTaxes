import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form8880Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 8880 — Credit for Qualified Retirement Savings Contributions
 * (Saver's Credit)
 *
 * Credit rate based on AGI:
 *   MFJ: 50% if AGI <= $47,500; 20% if <= $51,000; 10% if <= $79,000
 *   HOH: 50% if AGI <= $35,625; 20% if <= $38,250; 10% if <= $59,250
 *   Other: 50% if AGI <= $23,750; 20% if <= $25,500; 10% if <= $39,500
 *
 * Maximum contribution base: $2,000 per person ($4,000 MFJ)
 * Credit flows to Schedule 3 line 4.
 *
 * Reference: 2025 Form 8880 instructions
 */
export default class F8880 extends F1040Attachment {
  tag: FormTag = 'f8880'
  sequenceIndex = 54

  readonly data: Form8880Data

  constructor(f1040: F1040, data: Form8880Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form8880 !== undefined

  // Line 1: Primary contributions (max $2,000)
  l1 = (): number =>
    Math.min(
      2000,
      sumFields([
        this.data.primaryTraditionalIRA,
        this.data.primaryRothIRA,
        this.data.primaryEmployerPlan,
        this.data.primaryABLEAccount
      ])
    )

  // Line 2: Spouse contributions (max $2,000, MFJ only)
  l2 = (): number => {
    if (this.f1040.info.taxPayer.filingStatus !== FilingStatus.MFJ) return 0
    return Math.min(
      2000,
      sumFields([
        this.data.spouseTraditionalIRA,
        this.data.spouseRothIRA,
        this.data.spouseEmployerPlan,
        this.data.spouseABLEAccount
      ])
    )
  }

  // Line 3: Primary distributions (reduces eligible contributions)
  l3 = (): number => this.data.primaryDistributions

  // Line 4: Subtract line 3 from line 1 (min 0)
  l4 = (): number => Math.max(0, this.l1() - this.l3())

  // Line 5: Spouse distributions
  l5 = (): number => this.data.spouseDistributions ?? 0

  // Line 6: Subtract line 5 from line 2 (min 0)
  l6 = (): number => Math.max(0, this.l2() - this.l5())

  // Line 7: Add lines 4 and 6
  l7 = (): number => this.l4() + this.l6()

  // Line 8: AGI
  l8 = (): number => this.f1040.l11()

  // Line 9: Credit rate based on AGI and filing status
  l9 = (): number => {
    const agi = this.l8()
    const fs = this.f1040.info.taxPayer.filingStatus

    if (fs === FilingStatus.MFJ) {
      if (agi <= 47500) return 0.5
      if (agi <= 51000) return 0.2
      if (agi <= 79000) return 0.1
      return 0
    }
    if (fs === FilingStatus.HOH) {
      if (agi <= 35625) return 0.5
      if (agi <= 38250) return 0.2
      if (agi <= 59250) return 0.1
      return 0
    }
    // S, MFS, W
    if (agi <= 23750) return 0.5
    if (agi <= 25500) return 0.2
    if (agi <= 39500) return 0.1
    return 0
  }

  // Line 10: Multiply line 7 by line 9
  l10 = (): number => Math.round(this.l7() * this.l9() * 100) / 100

  // Line 11: Tax liability limit (from Credit Limit Worksheet)
  // F1040 line 18 minus prior credits: Schedule 3 lines 1-3 only.
  // DO NOT include l7 (which contains ScheduleR l6d) — ScheduleR comes
  // AFTER F8880 in the credit ordering and would create a circular dependency.
  l11 = (): number => {
    const tax = this.f1040.l18()
    const sch3 = this.f1040.schedule3
    const priorCredits = sumFields([
      sch3.l1(), // Foreign tax credit
      sch3.l2(), // Child/dependent care (F2441)
      sch3.l3()  // Education credits (F8863)
    ])
    return Math.max(0, tax - priorCredits)
  }

  // Line 12: Credit (smaller of line 10 or line 11)
  l12 = (): number => Math.min(this.l10(), this.l11())

  // For Schedule 3 line 4
  credit = (): number | undefined =>
    this.l12() > 0 ? this.l12() : undefined

  fields = (): Field[] => [
    // 0: f1_1  – Name(s) shown on return
    this.f1040.namesString(),
    // 1: f1_2  – Your social security number
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // 2: f1_3  – Line 1(a) IRA/ABLE contributions, You
    undefined,
    // 3: f1_4  – Line 1(b) IRA/ABLE contributions, Your spouse
    undefined,
    // 4: f1_5  – Line 2(a) Elective deferrals, You
    undefined,
    // 5: f1_6  – Line 2(b) Elective deferrals, Your spouse
    undefined,
    // 6: f1_7  – Line 3(a) Add lines 1 and 2, You
    undefined,
    // 7: f1_8  – Line 3(b) Add lines 1 and 2, Your spouse
    undefined,
    // 8: f1_9  – Line 4(a) Distributions, You
    this.l3(),
    // 9: f1_10 – Line 4(b) Distributions, Your spouse
    this.l5(),
    // 10: f1_11 – Line 5(a) Subtract line 4 from line 3, You
    undefined,
    // 11: f1_12 – Line 5(b) Subtract line 4 from line 3, Your spouse
    undefined,
    // 12: f1_13 – Line 6(a) Smaller of line 5 or $2,000, You
    this.l4(),
    // 13: f1_14 – Line 6(b) Smaller of line 5 or $2,000, Your spouse
    this.l6(),
    // 14: f1_15 – Line 7  Add amounts on line 6
    this.l7(),
    // 15: f1_16 – Line 8  AGI (Form 1040 line 11a)
    this.l8(),
    // 16: f1_17 – Line 9  Applicable decimal amount
    this.l9() > 0 ? this.l9().toFixed(2) : undefined,
    // 17: f1_18 – Line 10 Multiply line 7 by line 9
    this.l10(),
    // 18: f1_19 – Line 11 Limitation based on tax liability
    this.l11(),
    // 19: f1_20 – Line 12 Credit for qualified retirement savings contributions
    this.l12(),
    // Page 2: Credit Limit Worksheet
    // 20: f2_1 – CL Worksheet line 1 (Form 1040 line 18)
    undefined,
    // 21: f2_2 – CL Worksheet line 2 (Sch 3 credits total)
    undefined,
    // 22: f2_3 – CL Worksheet line 3 (line 1 minus line 2)
    undefined
  ]
}
