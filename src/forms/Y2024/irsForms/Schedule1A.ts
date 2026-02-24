import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Schedule1AData } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Schedule 1-A (Form 1040) — Additional Deductions (TY2026+)
 *
 * New schedule introduced in 2026 with five parts:
 *   Part I:  MAGI calculation
 *   Part II: No Tax on Tips (max $25,000, phaseout $150K/$300K MFJ)
 *   Part III: No Tax on Overtime (max $12,500/$25,000 MFJ, phaseout $150K/$300K MFJ)
 *   Part IV: No Tax on Car Loan Interest (max $10,000, phaseout $100K/$200K MFJ)
 *   Part V: Enhanced Deduction for Seniors (max $6,000/person, phaseout $75K/$150K MFJ)
 *
 * Total flows to Form 1040 line 13b.
 */
export default class Schedule1A extends F1040Attachment {
  tag: FormTag = 'f1040s1a'
  sequenceIndex = 1

  readonly data: Schedule1AData | undefined

  constructor(f1040: F1040) {
    super(f1040)
    this.data = f1040.info.schedule1AData
  }

  isNeeded = (): boolean => this.data !== undefined && this.l38() > 0

  isMFJ = (): boolean =>
    this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ

  // Part I: MAGI
  // Line 1: Form 1040 line 11 (AGI)
  l1 = (): number => this.f1040.l11()

  // Line 2e: Foreign income exclusions (Form 2555 lines 45 + 50)
  l2e = (): number => {
    const f2555 = this.f1040.f2555
    if (!f2555) return 0
    return sumFields([f2555.l45(), f2555.l50()])
  }

  // Line 3: MAGI = line 1 + line 2e
  l3 = (): number => this.l1() + this.l2e()

  // Part II: No Tax on Tips
  l4a = (): number => this.data?.qualifiedTipsW2 ?? 0
  l4b = (): number => this.data?.qualifiedTipsF4137 ?? 0
  l4c = (): number => Math.max(this.l4a(), this.l4b())
  l5 = (): number => this.data?.qualifiedTipsSelfEmployed ?? 0
  l6 = (): number => this.l4c() + this.l5()
  l7 = (): number => Math.min(this.l6(), 25000)

  // Phaseout: MAGI > $150K ($300K MFJ)
  tipsPhaseout = (): number => {
    const threshold = this.isMFJ() ? 300000 : 150000
    const excess = Math.max(0, this.l3() - threshold)
    if (excess <= 0) return this.l7()
    const reduction = Math.floor(excess / 1000) * 100
    return Math.max(0, this.l7() - reduction)
  }

  // Line 13: Qualified tips deduction
  l13 = (): number => this.tipsPhaseout()

  // Part III: No Tax on Overtime
  l14a = (): number => this.data?.qualifiedOvertimeW2 ?? 0
  l14b = (): number => this.data?.qualifiedOvertime1099 ?? 0
  l14c = (): number => this.l14a() + this.l14b()
  l15 = (): number => Math.min(this.l14c(), this.isMFJ() ? 25000 : 12500)

  overtimePhaseout = (): number => {
    const threshold = this.isMFJ() ? 300000 : 150000
    const excess = Math.max(0, this.l3() - threshold)
    if (excess <= 0) return this.l15()
    const reduction = Math.floor(excess / 1000) * 100
    return Math.max(0, this.l15() - reduction)
  }

  // Line 21: Qualified overtime compensation deduction
  l21 = (): number => this.overtimePhaseout()

  // Part IV: No Tax on Car Loan Interest
  l23 = (): number => {
    const vehicles = this.data?.vehicleInterest ?? []
    return vehicles.reduce((sum, v) => sum + v.interestForSchedule1A, 0)
  }
  l24 = (): number => Math.min(this.l23(), 10000)

  carLoanPhaseout = (): number => {
    const threshold = this.isMFJ() ? 200000 : 100000
    const excess = Math.max(0, this.l3() - threshold)
    if (excess <= 0) return this.l24()
    const reduction = Math.floor(excess / 1000) * 200
    return Math.max(0, this.l24() - reduction)
  }

  // Line 30: Qualified car loan interest deduction
  l30 = (): number => this.carLoanPhaseout()

  // Part V: Enhanced Deduction for Seniors
  seniorBase = (): number => {
    const threshold = this.isMFJ() ? 150000 : 75000
    const excess = Math.max(0, this.l3() - threshold)
    if (excess <= 0) return 6000
    const reduction = Math.round(excess * 0.06 * 100) / 100
    return Math.max(0, 6000 - reduction)
  }

  l36a = (): number =>
    this.data?.primaryBornBefore1962 ? this.seniorBase() : 0
  l36b = (): number =>
    (this.isMFJ() && this.data?.spouseBornBefore1962) ? this.seniorBase() : 0

  // Line 37: Enhanced deduction for seniors
  l37 = (): number => this.l36a() + this.l36b()

  // Part VI: Total Additional Deductions → Form 1040 line 13b
  l38 = (): number => this.l13() + this.l21() + this.l30() + this.l37()

  deduction = (): number => this.l38()

  fields = (): Field[] => [
    // 0: Name(s)
    this.f1040.namesString(),
    // 1: SSN
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    // Part I
    this.l1(), // 2: Line 1
    this.l2e(), // 3: Line 2e
    this.l3(), // 4: Line 3
    // Part II
    this.l4a(), // 5: Line 4a
    this.l4b(), // 6: Line 4b
    this.l4c(), // 7: Line 4c
    this.l5(), // 8: Line 5
    this.l6(), // 9: Line 6
    this.l7(), // 10: Line 7
    undefined, // 11: Lines 8-12 (phaseout detail)
    undefined,
    undefined,
    undefined,
    this.l13(), // 15: Line 13
    // Part III
    this.l14a(), // 16: Line 14a
    this.l14b(), // 17: Line 14b
    this.l14c(), // 18: Line 14c
    this.l15(), // 19: Line 15
    undefined, // 20: Lines 16-20 (phaseout detail)
    undefined,
    undefined,
    undefined,
    this.l21(), // 24: Line 21
    // Part IV
    undefined, // 25: Line 22 vehicles
    this.l23(), // 26: Line 23
    this.l24(), // 27: Line 24
    undefined, // 28: Lines 25-29 (phaseout detail)
    undefined,
    undefined,
    undefined,
    this.l30(), // 32: Line 30
    // Part V
    this.l3(), // 33: Line 31 (MAGI)
    undefined, // 34: Line 32 (threshold)
    undefined, // 35: Line 33
    undefined, // 36: Line 34
    undefined, // 37: Line 35
    this.l36a(), // 38: Line 36a
    this.l36b(), // 39: Line 36b
    this.l37(), // 40: Line 37
    // Part VI
    this.l38() // 41: Line 38
  ]
}
