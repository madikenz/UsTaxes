import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, ScheduleRData } from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Schedule R — Credit for the Elderly or the Disabled
 *
 * Calculates a nonrefundable credit for taxpayers who are:
 * - Age 65 or older, OR
 * - Under 65 and retired on permanent/total disability
 *
 * The credit (line 22) flows to Schedule 3, line 6d.
 *
 * Initial amounts by filing status box:
 *   Box 1 (S/HoH/QSS, 65+): $5,000
 *   Box 2 (S/HoH/QSS, disabled): $5,000
 *   Box 3 (MFJ, both 65+): $7,500
 *   Box 4 (MFJ, one disabled): $5,000
 *   Box 5 (MFJ, both disabled): $5,000
 *   Box 6 (MFJ, one 65+ other disabled): $7,500
 *   Box 7 (MFJ, one 65+ other not disabled): $5,000
 *   Box 8 (MFS, 65+): $3,750
 *   Box 9 (MFS, disabled): $3,750
 *
 * Reference: 2024 Schedule R instructions
 */
export default class ScheduleR extends F1040Attachment {
  tag: FormTag = 'f1040sr'
  sequenceIndex = 16

  readonly data: ScheduleRData | undefined

  constructor(f1040: F1040) {
    super(f1040)
    this.data = f1040.info.scheduleRData
  }

  isNeeded = (): boolean => this.data !== undefined

  // Part I: Filing status box (1-9)
  filingStatusBox = (): number => this.data?.filingStatusBox ?? 0

  // Line 10: Initial amount based on filing status box
  l10 = (): number => {
    const box = this.filingStatusBox()
    switch (box) {
      case 1:
      case 2:
      case 4:
      case 5:
      case 7:
        return 5000
      case 3:
      case 6:
        return 7500
      case 8:
      case 9:
        return 3750
      default:
        return 0
    }
  }

  // Line 11: If box 2, 4, 5, 6, or 9 — disability income limit
  // (taxable disability income, limited by l10)
  l11 = (): number | undefined => {
    const box = this.filingStatusBox()
    if ([2, 4, 5, 6, 9].includes(box)) {
      return Math.min(this.data?.disabilityIncome ?? 0, this.l10())
    }
    return undefined
  }

  // Line 12: If box 1 or 8, enter amount from line 10.
  // If box 2, 4, 5, 6, or 9, enter smaller of line 10 or 11.
  l12 = (): number => {
    const box = this.filingStatusBox()
    if ([1, 3, 7, 8].includes(box)) return this.l10()
    const l11 = this.l11() ?? 0
    return Math.min(this.l10(), l11)
  }

  // Line 13a: Nontaxable social security benefits
  l13a = (): number => this.data?.nontaxableSocialSecurity ?? 0

  // Line 13b: Nontaxable pensions/annuities/disability income
  l13b = (): number => this.data?.nontaxablePensions ?? 0

  // Line 13c: Add lines 13a and 13b
  l13c = (): number => this.l13a() + this.l13b()

  // Line 14: Line 12 minus line 13c (if zero or less, stop — no credit)
  l14 = (): number => Math.max(0, this.l12() - this.l13c())

  // Line 15: AGI from Form 1040 line 11
  l15 = (): number => this.f1040.l11()

  // Line 16: AGI threshold based on filing status
  l16 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    if (fs === FilingStatus.MFJ) return 25000
    if (fs === FilingStatus.MFS) return 12500
    return 17500 // S, HoH, QSS
  }

  // Line 17: Subtract line 16 from line 15 (excess AGI)
  l17 = (): number => Math.max(0, this.l15() - this.l16())

  // Line 18: Multiply line 17 by 1/2
  l18 = (): number => Math.round(this.l17() * 0.5 * 100) / 100

  // Line 19: Subtract line 18 from line 14
  l19 = (): number => Math.max(0, this.l14() - this.l18())

  // Line 20: Multiply line 19 by 15% (0.15)
  l20 = (): number => Math.round(this.l19() * 0.15 * 100) / 100

  // Line 21: Tax liability limit (Form 1040 line 18 minus credits)
  l21 = (): number => {
    const taxLiability = this.f1040.l18()
    // Subtract nonrefundable credits already claimed (Schedule 3 l1-l5, l6a-l6c)
    const sch3 = this.f1040.schedule3
    const priorCredits = (sch3.l1() ?? 0) + (sch3.l2() ?? 0) +
      (sch3.l3() ?? 0) + (sch3.l4() ?? 0) + (sch3.l5() ?? 0) +
      (sch3.l6a() ?? 0) + (sch3.l6b() ?? 0) + (sch3.l6c() ?? 0)
    return Math.max(0, taxLiability - priorCredits)
  }

  // Line 22: Credit — smaller of line 20 or line 21
  l22 = (): number | undefined => {
    if (this.l19() <= 0) return undefined
    const credit = Math.min(this.l20(), this.l21())
    return credit > 0 ? credit : undefined
  }

  fields = (): Field[] => {
    const box = this.filingStatusBox()
    return [
      this.f1040.namesString(),                          // 0: Name
      this.f1040.info.taxPayer.primaryPerson.ssid,       // 1: SSN
      // Part I — Filing status boxes (2-10)
      box === 1,                                         // 2: Box 1
      box === 2,                                         // 3: Box 2
      box === 3,                                         // 4: Box 3
      box === 4,                                         // 5: Box 4
      box === 5,                                         // 6: Box 5
      box === 6,                                         // 7: Box 6
      box === 7,                                         // 8: Box 7
      box === 8,                                         // 9: Box 8
      box === 9,                                         // 10: Box 9
      // Part II — Disability statement
      [2, 4, 5, 6, 9].includes(box),                    // 11: Disability checkbox
      // Part III — Credit calculation
      this.l10(),                                        // 12: Line 10
      this.l11(),                                        // 13: Line 11
      this.l12(),                                        // 14: Line 12
      this.l13a(),                                       // 15: Line 13a
      this.l13b(),                                       // 16: Line 13b
      this.l13c(),                                       // 17: Line 13c
      this.l14(),                                        // 18: Line 14
      this.l15(),                                        // 19: Line 15
      this.l16(),                                        // 20: Line 16
      this.l17(),                                        // 21: Line 17
      this.l18(),                                        // 22: Line 18
      this.l19(),                                        // 23: Line 19
      this.l20(),                                        // 24: Line 20
      this.l21(),                                        // 25: Line 21
      this.l22()                                         // 26: Line 22
    ]
  }
}
