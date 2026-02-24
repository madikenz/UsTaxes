import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form4137Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { fica } from '../data/federal'
import F1040 from './F1040'

/**
 * Form 4137 — Social Security and Medicare Tax on Unreported Tip Income
 *
 * Calculates additional social security and Medicare tax owed on tips
 * that were allocated by an employer but not reported to the employer.
 *
 * Line 6 (unreported tips subject to Medicare tax) flows to Form 8959, line 2.
 * Line 13 (total tax) flows to Schedule 2, line 5.
 *
 * PDF field order (34 fields):
 *   0: Name
 *   1: SSN
 *   2–21: Line 1 table rows A–E, 4 columns each (employer name, EIN, tips received, tips reported)
 *   22: Line 2 (total tips received)
 *   23: Line 3 (total tips reported)
 *   24: Line 4 (unreported tips)
 *   25: Line 5 (tips < $20/month)
 *   26: Line 6 (unreported tips subject to Medicare tax)
 *   27: Line 7 (max SS wages, pre-printed)
 *   28: Line 8 (total SS wages from W-2)
 *   29: Line 9 (line 7 minus line 8)
 *   30: Line 10 (unreported tips subject to SS tax)
 *   31: Line 11 (SS tax)
 *   32: Line 12 (Medicare tax)
 *   33: Line 13 (total tax)
 *
 * Reference: 2025 Form 4137 instructions
 */
export default class F4137 extends F1040Attachment {
  tag: FormTag = 'f4137'
  sequenceIndex = 24

  readonly data: Form4137Data

  constructor(f1040: F1040, data: Form4137Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form4137 !== undefined

  // Line 2: Total cash and charge tips received (sum of line 1, column c)
  l2 = (): number => this.data.employerAllocatedTips

  // Line 3: Total cash and charge tips reported to employer (sum of line 1, column d)
  l3 = (): number => this.data.tipsReportedToEmployer

  // Line 4: Subtract line 3 from line 2
  l4 = (): number => Math.max(0, this.l2() - this.l3())

  // Line 5: Tips received but not reported because total < $20 in a month
  l5 = (): number | undefined => undefined

  // Line 6: Unreported tips subject to Medicare tax (line 4 minus line 5)
  l6 = (): number | undefined => {
    const unreported = this.l4() - (this.l5() ?? 0)
    return unreported > 0 ? unreported : undefined
  }

  // Line 7: Maximum wages subject to social security tax (pre-printed constant)
  l7 = (): number => fica.maxIncomeSSTaxApplies

  // Social security wages from W-2s (boxes 3 + 7)
  private w2SSWages = (): number =>
    this.f1040.validW2s().reduce((sum, w2) => sum + w2.ssWages, 0)

  // Line 8: Total social security wages and tips from W-2 boxes 3 and 7
  l8 = (): number => this.w2SSWages()

  // Line 9: Subtract line 8 from line 7 (if line 8 > line 7, enter 0)
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Line 10: Smaller of line 6 or line 9
  l10 = (): number | undefined => {
    const tips = this.l6()
    if (tips === undefined || tips <= 0) return undefined
    return Math.min(tips, this.l9())
  }

  // Line 11: Social security tax (line 10 * 0.062)
  l11 = (): number | undefined => {
    const base = this.l10()
    if (base === undefined || base <= 0) return undefined
    return Math.round(base * 0.062 * 100) / 100
  }

  // Line 12: Medicare tax (line 6 * 0.0145)
  l12 = (): number | undefined => {
    const tips = this.l6()
    if (tips === undefined || tips <= 0) return undefined
    return Math.round(tips * 0.0145 * 100) / 100
  }

  // Line 13: Total tax (line 11 + line 12) → Schedule 2, line 5
  l13 = (): number => sumFields([this.l11(), this.l12()])

  fields = (): Field[] => [
    this.f1040.namesString(),                             //  0: Name
    this.f1040.info.taxPayer.primaryPerson.ssid,          //  1: SSN
    // Line 1 table: rows A–E, columns (a) name, (b) EIN, (c) received, (d) reported
    undefined,                                            //  2: Row A col a
    undefined,                                            //  3: Row A col b
    undefined,                                            //  4: Row A col c
    undefined,                                            //  5: Row A col d
    undefined,                                            //  6: Row B col a
    undefined,                                            //  7: Row B col b
    undefined,                                            //  8: Row B col c
    undefined,                                            //  9: Row B col d
    undefined,                                            // 10: Row C col a
    undefined,                                            // 11: Row C col b
    undefined,                                            // 12: Row C col c
    undefined,                                            // 13: Row C col d
    undefined,                                            // 14: Row D col a
    undefined,                                            // 15: Row D col b
    undefined,                                            // 16: Row D col c
    undefined,                                            // 17: Row D col d
    undefined,                                            // 18: Row E col a
    undefined,                                            // 19: Row E col b
    undefined,                                            // 20: Row E col c
    undefined,                                            // 21: Row E col d
    this.l2(),                                            // 22: Line 2
    this.l3(),                                            // 23: Line 3
    this.l4(),                                            // 24: Line 4
    this.l5(),                                            // 25: Line 5
    this.l6(),                                            // 26: Line 6
    this.l7(),                                            // 27: Line 7
    this.l8(),                                            // 28: Line 8
    this.l9(),                                            // 29: Line 9
    this.l10(),                                           // 30: Line 10
    this.l11(),                                           // 31: Line 11
    this.l12(),                                           // 32: Line 12
    this.l13()                                            // 33: Line 13
  ]
}
