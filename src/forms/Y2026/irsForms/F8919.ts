import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8919Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { fica } from '../data/federal'
import F1040 from './F1040'

/**
 * Form 8919 — Uncollected Social Security and Medicare Tax on Wages
 *
 * Used when a worker was treated as an independent contractor by an employer
 * but believes they should have been classified as an employee.
 *
 * Calculates the employee share of uncollected SS and Medicare tax.
 * The total tax flows to Schedule 2 for other taxes.
 * Line 6 is referenced by Form 8959 for Additional Medicare Tax.
 *
 * Reference: 2024 Form 8919 instructions
 */
export default class F8919 extends F1040Attachment {
  tag: FormTag = 'f8919'
  sequenceIndex = 72

  readonly data: Form8919Data

  constructor(f1040: F1040, data: Form8919Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form8919 !== undefined

  // ── PDF Lines 1-5 (employer rows) ─────────────────────────────
  // Total wages from all employers listed

  // ── PDF Line 6: Total wages (sum of column f, lines 1-5) ────
  l5 = (): number =>
    this.data.employers.reduce((sum, emp) => sum + emp.wages, 0)

  // ── PDF Line 7: Maximum wages subject to SS tax ─────────────
  private l7 = (): number => fica.maxIncomeSSTaxApplies

  // ── PDF Line 8: SS wages & tips already on W-2s ─────────────
  private w2SSWages = (): number =>
    this.f1040.validW2s().reduce((sum, w2) => sum + w2.ssWages, 0)

  // ── PDF Line 9: Line 7 minus Line 8 (floor 0) ──────────────
  private l9 = (): number =>
    Math.max(0, this.l7() - this.w2SSWages())

  // ── PDF Line 10: Smaller of Line 6 or Line 9 ───────────────
  // (public — referenced by Schedule SE line 8c)
  l10 = (): number => Math.min(this.l5(), this.l9())

  // ── PDF Line 11: Line 10 × 0.062 (SS tax) ──────────────────
  private l11 = (): number =>
    Math.round(this.l10() * 0.062 * 100) / 100

  // ── PDF Line 12: Line 6 × 0.0145 (Medicare tax) ────────────
  private l12 = (): number =>
    Math.round(this.l5() * 0.0145 * 100) / 100

  // ── PDF Line 13: Line 11 + Line 12 (total tax) ─────────────
  private l13 = (): number => sumFields([this.l11(), this.l12()])

  // Public: total wages for F8959 Additional Medicare Tax (PDF Line 6)
  totalWages = (): number => this.l5()

  // Public: total tax for Schedule 2 wiring (Line 13 value)
  l6 = (): number | undefined => {
    const wages = this.l5()
    if (wages <= 0) return undefined
    return this.l13()
  }

  fields = (): Field[] => {
    const employers = this.data.employers
    // PDF has 5 employer rows, each with 6 columns:
    //   (a) Name, (b) EIN, (c) Reason code,
    //   (d) Date of IRS determination, (e) 1099-MISC/NEC checkbox,
    //   (f) Total wages
    const employerFields: Field[] = []
    for (let i = 0; i < 5; i++) {
      if (i < employers.length) {
        employerFields.push(
          employers[i].employerName,  // col (a)
          employers[i].employerEIN,   // col (b)
          employers[i].reasonCode,    // col (c)
          undefined,                  // col (d) date — not in data model
          undefined,                  // col (e) checkbox — not in data model
          employers[i].wages          // col (f)
        )
      } else {
        employerFields.push(
          undefined, undefined, undefined,
          undefined, undefined, undefined
        )
      }
    }

    // 2 header + 30 employer (5×6) + 8 summary (lines 6-13) = 40
    return [
      this.f1040.namesString(),                     //  0  Name
      this.f1040.info.taxPayer.primaryPerson.ssid,   //  1  SSN
      ...employerFields,                             //  2-31  Employer rows
      this.l5(),                                     // 32  Line 6  total wages
      this.l7(),                                     // 33  Line 7  max SS wages
      this.w2SSWages(),                              // 34  Line 8  W-2 SS wages
      this.l9(),                                     // 35  Line 9  line 7 − line 8
      this.l10(),                                    // 36  Line 10 smaller of l6/l9
      this.l11(),                                    // 37  Line 11 SS tax
      this.l12(),                                    // 38  Line 12 Medicare tax
      this.l13()                                     // 39  Line 13 total tax
    ]
  }
}
