import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8962Data, MarketplacePolicy, FilingStatus } from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Form 8962 -- Premium Tax Credit (PTC)
 *
 * Calculates the net premium tax credit for taxpayers who enrolled
 * in health insurance through a Health Insurance Marketplace and
 * received Form 1095-A.
 *
 * - Net PTC (line 26) flows to Schedule 3, line 9 as a refundable credit.
 * - Excess advance PTC repayment (line 27) flows to Schedule 2, line 2
 *   as additional tax owed.
 *
 * Reference: 2025 Form 8962 and instructions.
 */
export default class F8962 extends F1040Attachment {
  tag: FormTag = 'f8962'
  sequenceIndex = 73

  readonly data: Form8962Data

  constructor(f1040: F1040, data: Form8962Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form8962 !== undefined &&
    this.f1040.info.form8962.policies.length > 0

  // ---------------------------------------------------------------
  // Part I: Annual and Monthly Contribution Amount
  // ---------------------------------------------------------------

  /** Line 1: Tax family size */
  l1 = (): number => this.data.familySize

  /** Line 2a: Modified AGI = F1040 line 11 + tax-exempt interest (l2a) + foreign earned income exclusion (F2555) */
  l2a = (): number =>
    this.f1040.l11() +
    (this.f1040.l2a() ?? 0) +
    (this.f1040.f2555?.l45() ?? 0)

  /**
   * Line 3: Household income as a percentage of the federal poverty line.
   * Rounded to two decimal places (the form asks for a whole-number
   * percentage, but we keep decimals for intermediate accuracy).
   */
  l3 = (): number => {
    if (this.data.federalPovertyLine <= 0) return 0
    return Math.round((this.l2a() / this.data.federalPovertyLine) * 100) / 100
  }

  /** Line 4: Is household income at or above 100% FPL?
   *  For 2025, taxpayers above 400% FPL are still eligible (capped at 8.5%).
   */
  l4 = (): boolean => {
    const pct = this.l3()
    return pct >= 1.0
  }

  /**
   * Line 5: Applicable figure (contribution percentage).
   *
   * 2025 ACA affordability table -- the contribution percentage is the
   * share of household income the taxpayer is expected to pay toward
   * the benchmark (second-lowest cost silver plan) premium.
   *
   * The table uses linear interpolation within each band.
   */
  l5 = (): number => {
    const pct = this.l3()
    return applicableFigure2025(pct)
  }

  /**
   * Line 6: Annual contribution amount = line 2a * line 5.
   * This is the annual expected contribution toward premiums.
   */
  l6 = (): number => Math.round(this.l2a() * this.l5())

  /** Monthly contribution amount (line 6 / 12) used in per-policy calcs */
  monthlyContribution = (): number => this.l6() / 12

  // ---------------------------------------------------------------
  // Lines 11-23: Per-policy calculations (simplified annual approach)
  // ---------------------------------------------------------------

  /**
   * For each marketplace policy, compute:
   *   - months of coverage
   *   - annual premium (column A)
   *   - annual SLCSP (column B)
   *   - contribution for covered months (column C)
   *   - max PTC = max(0, SLCSP - contribution) (column D)
   *   - PTC = min(premium, max PTC) (column E)
   *   - advance PTC paid (column F)
   */
  policyPTC = (policy: MarketplacePolicy): number => {
    const months = policy.endMonth - policy.startMonth + 1
    if (months <= 0) return 0
    if (!this.l4()) return 0

    const monthlyPremium = policy.annualPremium / 12
    const monthlySLCSP = policy.annualSLCSP / 12
    const monthlyContrib = this.monthlyContribution()

    // Shared policy allocation
    const allocationPct = this.data.isSharedPolicy
      ? (this.data.sharedPolicyAllocationPercentage ?? 100) / 100
      : 1

    let totalPTC = 0
    for (let m = 0; m < months; m++) {
      const allocPremium = monthlyPremium * allocationPct
      const allocSLCSP = monthlySLCSP * allocationPct
      const maxPTC = Math.max(0, allocSLCSP - monthlyContrib)
      totalPTC += Math.min(allocPremium, maxPTC)
    }

    return Math.round(totalPTC)
  }

  policyAdvancePTC = (policy: MarketplacePolicy): number => {
    const allocationPct = this.data.isSharedPolicy
      ? (this.data.sharedPolicyAllocationPercentage ?? 100) / 100
      : 1
    return Math.round(policy.advancePayments * allocationPct)
  }

  // ---------------------------------------------------------------
  // Part II and III: Net PTC or Excess Advance PTC Repayment
  // ---------------------------------------------------------------

  /** Line 24: Total premium tax credit allowed */
  l24 = (): number =>
    this.data.policies.reduce((sum, p) => sum + this.policyPTC(p), 0)

  /** Line 25: Total advance PTC from all 1095-A forms */
  l25 = (): number =>
    this.data.policies.reduce((sum, p) => sum + this.policyAdvancePTC(p), 0)

  /**
   * Line 26: Net premium tax credit.
   * If total PTC (line 24) > advance PTC (line 25), the excess
   * is a refundable credit claimed on Schedule 3 line 9.
   */
  l26 = (): number => Math.max(0, this.l24() - this.l25())

  /**
   * Line 27: Excess advance premium tax credit repayment.
   * If advance PTC (line 25) > total PTC (line 24), the taxpayer must
   * repay the excess, subject to a repayment limitation cap based on
   * income as a percentage of FPL and filing status.
   */
  l27 = (): number => {
    const excess = Math.max(0, this.l25() - this.l24())
    if (excess === 0) return 0

    const cap = this.repaymentCap()
    // If cap is undefined the taxpayer is above 400% FPL --
    // full repayment with no cap.
    if (cap === undefined) return excess
    return Math.min(excess, cap)
  }

  // ---------------------------------------------------------------
  // Public methods for wiring to other forms
  // ---------------------------------------------------------------

  /**
   * Net PTC credit -- feeds Schedule 3 line 9.
   * Returns the refundable credit amount, or undefined if zero.
   */
  credit = (): number | undefined => {
    const net = this.l26()
    return net > 0 ? net : undefined
  }

  /**
   * Excess advance PTC repayment -- feeds Schedule 2 line 2
   * (additional tax owed).
   */
  excessAdvancePTC = (): number | undefined => {
    const excess = this.l27()
    return excess > 0 ? excess : undefined
  }

  // ---------------------------------------------------------------
  // Repayment limitation cap (Table 5 from 2025 Form 8962 instructions)
  // ---------------------------------------------------------------

  /**
   * Returns the repayment cap amount based on household income as a
   * percentage of FPL and filing status. Returns undefined if above
   * 400% FPL (no cap applies -- full repayment required).
   */
  private repaymentCap = (): number | undefined => {
    const pct = this.l3()
    // HOH uses the "all other" (non-single) column per IRS Table 5
    const single =
      this.f1040.info.taxPayer.filingStatus === FilingStatus.S ||
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS

    // 2025 repayment limitation amounts (Table 5)
    if (pct < 2.0) {
      return single ? 375 : 750
    } else if (pct < 3.0) {
      return single ? 975 : 1950
    } else if (pct < 4.0) {
      return single ? 1625 : 3250
    }
    // At or above 400% FPL: no cap
    return undefined
  }

  // ---------------------------------------------------------------
  // Line 28: Repayment limitation
  // ---------------------------------------------------------------

  /** Line 28: Repayment limitation cap */
  l28 = (): number | undefined => this.repaymentCap()

  /**
   * Line 29: Excess advance PTC repayment = smaller of line 27 or line 28.
   * Same as l27() since l27 already applies the cap.
   */
  l29 = (): number => this.l27()

  // ---------------------------------------------------------------
  // Monthly helpers for the line 11-23 table
  // ---------------------------------------------------------------

  /**
   * Aggregate monthly values across all policies for a given month (1-12).
   * Returns [premium, slcsp, contribution, maxPTC, ptc, advancePTC]
   * for each column (a)-(f) in the monthly calculation table.
   */
  private monthlyRow = (
    month: number
  ): [
    number | undefined,
    number | undefined,
    number | undefined,
    number | undefined,
    number | undefined,
    number | undefined
  ] => {
    let totalPremium = 0
    let totalSLCSP = 0
    let totalAdvance = 0
    let hasCoverage = false

    const allocationPct = this.data.isSharedPolicy
      ? (this.data.sharedPolicyAllocationPercentage ?? 100) / 100
      : 1

    for (const p of this.data.policies) {
      if (month >= p.startMonth && month <= p.endMonth) {
        hasCoverage = true
        totalPremium += (p.annualPremium / 12) * allocationPct
        totalSLCSP += (p.annualSLCSP / 12) * allocationPct
        totalAdvance += (p.advancePayments / 12) * allocationPct
      }
    }

    if (!hasCoverage) {
      return [undefined, undefined, undefined, undefined, undefined, undefined]
    }

    const monthlyContrib = this.monthlyContribution()
    const maxPTC = Math.max(0, totalSLCSP - monthlyContrib)
    const ptc = Math.min(totalPremium, maxPTC)

    return [
      Math.round(totalPremium),
      Math.round(totalSLCSP),
      Math.round(monthlyContrib),
      Math.round(maxPTC),
      Math.round(ptc),
      Math.round(totalAdvance)
    ]
  }

  /**
   * Aggregate annual values across all policies for the line 11 row.
   * Returns [premium, slcsp, contribution, maxPTC, ptc, advancePTC].
   */
  private annualRow = (): [
    number | undefined,
    number | undefined,
    number | undefined,
    number | undefined,
    number | undefined,
    number | undefined
  ] => {
    if (this.data.policies.length === 0) {
      return [undefined, undefined, undefined, undefined, undefined, undefined]
    }

    const allocationPct = this.data.isSharedPolicy
      ? (this.data.sharedPolicyAllocationPercentage ?? 100) / 100
      : 1

    let totalPremium = 0
    let totalSLCSP = 0
    let totalAdvance = 0

    for (const p of this.data.policies) {
      totalPremium += p.annualPremium * allocationPct
      totalSLCSP += p.annualSLCSP * allocationPct
      totalAdvance += p.advancePayments * allocationPct
    }

    const annualContrib = this.l8a()
    const maxPTC = Math.max(0, totalSLCSP - annualContrib)
    const ptc = Math.min(totalPremium, maxPTC)

    return [
      Math.round(totalPremium),
      Math.round(totalSLCSP),
      Math.round(annualContrib),
      Math.round(maxPTC),
      Math.round(ptc),
      Math.round(totalAdvance)
    ]
  }

  /** Whether all policies cover the full year (Jan-Dec) */
  private isFullYear = (): boolean =>
    this.data.policies.length > 0 &&
    this.data.policies.every((p) => p.startMonth === 1 && p.endMonth === 12)

  /**
   * Line 8a: Annual contribution amount = household income * applicable figure.
   * (Renamed from l6 to match actual form line numbering.)
   */
  l8a = (): number => this.l6()

  /**
   * Line 8b: Monthly contribution amount = line 8a / 12.
   */
  l8b = (): number => Math.round(this.monthlyContribution())

  // ---------------------------------------------------------------
  // PDF field output — 141 fields matching f8962.pdf
  // ---------------------------------------------------------------

  fields = (): Field[] => {
    // Determine whether to use annual (line 11) or monthly (lines 12-23)
    const useAnnual = this.isFullYear()

    // Annual row values for line 11
    const annual = this.annualRow()

    // Monthly row values for lines 12-23 (Jan=1 .. Dec=12)
    const mon = (m: number) => this.monthlyRow(m)

    // Household income = line 2a + line 2b (we only have 2a)
    const householdIncome = this.l2a()

    // FPL percentage as a whole number (e.g. 250 for 250%)
    const fplPct = this.data.federalPovertyLine > 0
      ? Math.round((householdIncome / this.data.federalPovertyLine) * 100)
      : 0

    // Applicable figure as a percentage with two decimals (e.g. 8.50)
    const applicableFigurePct =
      Math.round(this.l5() * 10000) / 100

    // Shared policy allocation percentage for Part IV
    const allocPct = this.data.isSharedPolicy
      ? this.data.sharedPolicyAllocationPercentage
      : undefined

    return [
      // ---- Header (fields 0-1) ----
      /* 0  */ this.f1040.namesString(),                           // Name
      /* 1  */ this.f1040.info.taxPayer.primaryPerson.ssid,        // SSN

      // ---- Line A: MFS exception checkbox (field 2) ----
      /* 2  */ undefined,                                          // MFS exception checkbox

      // ---- Part I: Annual and Monthly Contribution Amount ----
      /* 3  */ this.l1(),                                          // Line 1: tax family size
      /* 4  */ this.l2a(),                                         // Line 2a: modified AGI
      /* 5  */ undefined,                                          // Line 2b: dependents' modified AGI
      /* 6  */ householdIncome,                                    // Line 3: household income
      /* 7  */ false,                                              // Line 4 checkbox: Alaska
      /* 8  */ false,                                              // Line 4 checkbox: Hawaii
      /* 9  */ true,                                               // Line 4 checkbox: Other 48 states and DC
      /* 10 */ this.data.federalPovertyLine,                       // Line 4: federal poverty line amount
      /* 11 */ fplPct,                                             // Line 5: household income as % of FPL
      /* 12 */ applicableFigurePct,                                // Line 7: applicable figure
      /* 13 */ this.l8a(),                                         // Line 8a: annual contribution amount
      /* 14 */ this.l8b(),                                         // Line 8b: monthly contribution amount

      // ---- Part II: PTC Claim and Reconciliation ----
      /* 15 */ this.data.isSharedPolicy,                           // Line 9 Yes checkbox
      /* 16 */ !this.data.isSharedPolicy,                          // Line 9 No checkbox
      /* 17 */ useAnnual,                                          // Line 10 Yes checkbox (use annual)
      /* 18 */ !useAnnual,                                         // Line 10 No checkbox (use monthly)

      // ---- Line 11: Annual Totals (fields 19-24) ----
      /* 19 */ useAnnual ? annual[0] : undefined,                  // Line 11(a): annual enrollment premiums
      /* 20 */ useAnnual ? annual[1] : undefined,                  // Line 11(b): annual applicable SLCSP
      /* 21 */ useAnnual ? annual[2] : undefined,                  // Line 11(c): annual contribution amount
      /* 22 */ useAnnual ? annual[3] : undefined,                  // Line 11(d): annual max premium assistance
      /* 23 */ useAnnual ? annual[4] : undefined,                  // Line 11(e): annual PTC allowed
      /* 24 */ useAnnual ? annual[5] : undefined,                  // Line 11(f): annual advance payment of PTC

      // ---- Line 12: January (fields 25-30) ----
      /* 25 */ !useAnnual ? mon(1)[0] : undefined,                 // Line 12(a)
      /* 26 */ !useAnnual ? mon(1)[1] : undefined,                 // Line 12(b)
      /* 27 */ !useAnnual ? mon(1)[2] : undefined,                 // Line 12(c)
      /* 28 */ !useAnnual ? mon(1)[3] : undefined,                 // Line 12(d)
      /* 29 */ !useAnnual ? mon(1)[4] : undefined,                 // Line 12(e)
      /* 30 */ !useAnnual ? mon(1)[5] : undefined,                 // Line 12(f)

      // ---- Line 13: February (fields 31-36) ----
      /* 31 */ !useAnnual ? mon(2)[0] : undefined,                 // Line 13(a)
      /* 32 */ !useAnnual ? mon(2)[1] : undefined,                 // Line 13(b)
      /* 33 */ !useAnnual ? mon(2)[2] : undefined,                 // Line 13(c)
      /* 34 */ !useAnnual ? mon(2)[3] : undefined,                 // Line 13(d)
      /* 35 */ !useAnnual ? mon(2)[4] : undefined,                 // Line 13(e)
      /* 36 */ !useAnnual ? mon(2)[5] : undefined,                 // Line 13(f)

      // ---- Line 14: March (fields 37-42) ----
      /* 37 */ !useAnnual ? mon(3)[0] : undefined,                 // Line 14(a)
      /* 38 */ !useAnnual ? mon(3)[1] : undefined,                 // Line 14(b)
      /* 39 */ !useAnnual ? mon(3)[2] : undefined,                 // Line 14(c)
      /* 40 */ !useAnnual ? mon(3)[3] : undefined,                 // Line 14(d)
      /* 41 */ !useAnnual ? mon(3)[4] : undefined,                 // Line 14(e)
      /* 42 */ !useAnnual ? mon(3)[5] : undefined,                 // Line 14(f)

      // ---- Line 15: April (fields 43-48) ----
      /* 43 */ !useAnnual ? mon(4)[0] : undefined,                 // Line 15(a)
      /* 44 */ !useAnnual ? mon(4)[1] : undefined,                 // Line 15(b)
      /* 45 */ !useAnnual ? mon(4)[2] : undefined,                 // Line 15(c)
      /* 46 */ !useAnnual ? mon(4)[3] : undefined,                 // Line 15(d)
      /* 47 */ !useAnnual ? mon(4)[4] : undefined,                 // Line 15(e)
      /* 48 */ !useAnnual ? mon(4)[5] : undefined,                 // Line 15(f)

      // ---- Line 16: May (fields 49-54) ----
      /* 49 */ !useAnnual ? mon(5)[0] : undefined,                 // Line 16(a)
      /* 50 */ !useAnnual ? mon(5)[1] : undefined,                 // Line 16(b)
      /* 51 */ !useAnnual ? mon(5)[2] : undefined,                 // Line 16(c)
      /* 52 */ !useAnnual ? mon(5)[3] : undefined,                 // Line 16(d)
      /* 53 */ !useAnnual ? mon(5)[4] : undefined,                 // Line 16(e)
      /* 54 */ !useAnnual ? mon(5)[5] : undefined,                 // Line 16(f)

      // ---- Line 17: June (fields 55-60) ----
      /* 55 */ !useAnnual ? mon(6)[0] : undefined,                 // Line 17(a)
      /* 56 */ !useAnnual ? mon(6)[1] : undefined,                 // Line 17(b)
      /* 57 */ !useAnnual ? mon(6)[2] : undefined,                 // Line 17(c)
      /* 58 */ !useAnnual ? mon(6)[3] : undefined,                 // Line 17(d)
      /* 59 */ !useAnnual ? mon(6)[4] : undefined,                 // Line 17(e)
      /* 60 */ !useAnnual ? mon(6)[5] : undefined,                 // Line 17(f)

      // ---- Line 18: July (fields 61-66) ----
      /* 61 */ !useAnnual ? mon(7)[0] : undefined,                 // Line 18(a)
      /* 62 */ !useAnnual ? mon(7)[1] : undefined,                 // Line 18(b)
      /* 63 */ !useAnnual ? mon(7)[2] : undefined,                 // Line 18(c)
      /* 64 */ !useAnnual ? mon(7)[3] : undefined,                 // Line 18(d)
      /* 65 */ !useAnnual ? mon(7)[4] : undefined,                 // Line 18(e)
      /* 66 */ !useAnnual ? mon(7)[5] : undefined,                 // Line 18(f)

      // ---- Line 19: August (fields 67-72) ----
      /* 67 */ !useAnnual ? mon(8)[0] : undefined,                 // Line 19(a)
      /* 68 */ !useAnnual ? mon(8)[1] : undefined,                 // Line 19(b)
      /* 69 */ !useAnnual ? mon(8)[2] : undefined,                 // Line 19(c)
      /* 70 */ !useAnnual ? mon(8)[3] : undefined,                 // Line 19(d)
      /* 71 */ !useAnnual ? mon(8)[4] : undefined,                 // Line 19(e)
      /* 72 */ !useAnnual ? mon(8)[5] : undefined,                 // Line 19(f)

      // ---- Line 20: September (fields 73-78) ----
      /* 73 */ !useAnnual ? mon(9)[0] : undefined,                 // Line 20(a)
      /* 74 */ !useAnnual ? mon(9)[1] : undefined,                 // Line 20(b)
      /* 75 */ !useAnnual ? mon(9)[2] : undefined,                 // Line 20(c)
      /* 76 */ !useAnnual ? mon(9)[3] : undefined,                 // Line 20(d)
      /* 77 */ !useAnnual ? mon(9)[4] : undefined,                 // Line 20(e)
      /* 78 */ !useAnnual ? mon(9)[5] : undefined,                 // Line 20(f)

      // ---- Line 21: October (fields 79-84) ----
      /* 79 */ !useAnnual ? mon(10)[0] : undefined,                // Line 21(a)
      /* 80 */ !useAnnual ? mon(10)[1] : undefined,                // Line 21(b)
      /* 81 */ !useAnnual ? mon(10)[2] : undefined,                // Line 21(c)
      /* 82 */ !useAnnual ? mon(10)[3] : undefined,                // Line 21(d)
      /* 83 */ !useAnnual ? mon(10)[4] : undefined,                // Line 21(e)
      /* 84 */ !useAnnual ? mon(10)[5] : undefined,                // Line 21(f)

      // ---- Line 22: November (fields 85-90) ----
      /* 85 */ !useAnnual ? mon(11)[0] : undefined,                // Line 22(a)
      /* 86 */ !useAnnual ? mon(11)[1] : undefined,                // Line 22(b)
      /* 87 */ !useAnnual ? mon(11)[2] : undefined,                // Line 22(c)
      /* 88 */ !useAnnual ? mon(11)[3] : undefined,                // Line 22(d)
      /* 89 */ !useAnnual ? mon(11)[4] : undefined,                // Line 22(e)
      /* 90 */ !useAnnual ? mon(11)[5] : undefined,                // Line 22(f)

      // ---- Line 23: December (fields 91-96) ----
      /* 91 */ !useAnnual ? mon(12)[0] : undefined,                // Line 23(a)
      /* 92 */ !useAnnual ? mon(12)[1] : undefined,                // Line 23(b)
      /* 93 */ !useAnnual ? mon(12)[2] : undefined,                // Line 23(c)
      /* 94 */ !useAnnual ? mon(12)[3] : undefined,                // Line 23(d)
      /* 95 */ !useAnnual ? mon(12)[4] : undefined,                // Line 23(e)
      /* 96 */ !useAnnual ? mon(12)[5] : undefined,                // Line 23(f)

      // ---- Lines 24-26 (fields 97-99) ----
      /* 97 */ this.l24(),                                         // Line 24: total PTC
      /* 98 */ this.l25(),                                         // Line 25: advance payment of PTC
      /* 99 */ this.l26() > 0 ? this.l26() : undefined,           // Line 26: net PTC

      // ---- Part III: Repayment (fields 100-102) ----
      /* 100 */ this.l25() > this.l24()                            // Line 27: excess advance payment
        ? this.l25() - this.l24() : undefined,
      /* 101 */ this.l28(),                                        // Line 28: repayment limitation
      /* 102 */ this.l29() > 0 ? this.l29() : undefined,          // Line 29: excess advance PTC repayment

      // ---- Page 2: Part IV — Allocation of Policy Amounts ----

      // ---- Allocation 1, Line 30 (fields 103-109) ----
      /* 103 */ undefined,                                         // Line 30(a): policy number
      /* 104 */ undefined,                                         // Line 30(b): SSN of other taxpayer
      /* 105 */ undefined,                                         // Line 30(c): allocation start month
      /* 106 */ undefined,                                         // Line 30(d): allocation stop month
      /* 107 */ allocPct,                                          // Line 30(e): premium percentage
      /* 108 */ allocPct,                                          // Line 30(f): SLCSP percentage
      /* 109 */ allocPct,                                          // Line 30(g): advance PTC percentage

      // ---- Allocation 2, Line 31 (fields 110-116) ----
      /* 110 */ undefined,                                         // Line 31(a): policy number
      /* 111 */ undefined,                                         // Line 31(b): SSN of other taxpayer
      /* 112 */ undefined,                                         // Line 31(c): allocation start month
      /* 113 */ undefined,                                         // Line 31(d): allocation stop month
      /* 114 */ undefined,                                         // Line 31(e): premium percentage
      /* 115 */ undefined,                                         // Line 31(f): SLCSP percentage
      /* 116 */ undefined,                                         // Line 31(g): advance PTC percentage

      // ---- Allocation 3, Line 32 (fields 117-123) ----
      /* 117 */ undefined,                                         // Line 32(a): policy number
      /* 118 */ undefined,                                         // Line 32(b): SSN of other taxpayer
      /* 119 */ undefined,                                         // Line 32(c): allocation start month
      /* 120 */ undefined,                                         // Line 32(d): allocation stop month
      /* 121 */ undefined,                                         // Line 32(e): premium percentage
      /* 122 */ undefined,                                         // Line 32(f): SLCSP percentage
      /* 123 */ undefined,                                         // Line 32(g): advance PTC percentage

      // ---- Allocation 4, Line 33 (fields 124-130) ----
      /* 124 */ undefined,                                         // Line 33(a): policy number
      /* 125 */ undefined,                                         // Line 33(b): SSN of other taxpayer
      /* 126 */ undefined,                                         // Line 33(c): allocation start month
      /* 127 */ undefined,                                         // Line 33(d): allocation stop month
      /* 128 */ undefined,                                         // Line 33(e): premium percentage
      /* 129 */ undefined,                                         // Line 33(f): SLCSP percentage
      /* 130 */ undefined,                                         // Line 33(g): advance PTC percentage

      // ---- Line 34: completed allocations? (fields 131-132) ----
      /* 131 */ undefined,                                         // Line 34 Yes checkbox
      /* 132 */ undefined,                                         // Line 34 No checkbox

      // ---- Part V: Alternative Calculation for Year of Marriage ----

      // ---- Line 35: your SSN (fields 133-136) ----
      /* 133 */ undefined,                                         // Line 35(a): alternative family size
      /* 134 */ undefined,                                         // Line 35(b): alternative monthly contribution
      /* 135 */ undefined,                                         // Line 35(c): alternative start month
      /* 136 */ undefined,                                         // Line 35(d): alternative stop month

      // ---- Line 36: spouse's SSN (fields 137-140) ----
      /* 137 */ undefined,                                         // Line 36(a): alternative family size
      /* 138 */ undefined,                                         // Line 36(b): alternative monthly contribution
      /* 139 */ undefined,                                         // Line 36(c): alternative start month
      /* 140 */ undefined                                          // Line 36(d): alternative stop month
    ]
  }
}

// ---------------------------------------------------------------
// 2025 Applicable Figure table (contribution percentage)
// ---------------------------------------------------------------

/**
 * Returns the applicable figure (as a decimal, e.g. 0.085 for 8.5%)
 * for the given household income as a ratio of FPL.
 *
 * 2025 ACA table (IRS Form 8962 instructions, Table 2):
 *   0%   - 150% FPL  =>  0.0%
 *   150% - 200% FPL  =>  0.0% - 2.0%  (linear)
 *   200% - 250% FPL  =>  2.0% - 4.0%  (linear)
 *   250% - 300% FPL  =>  4.0% - 6.0%  (linear)
 *   300% - 400% FPL  =>  6.0% - 8.5%  (linear)
 *   > 400% FPL       =>  8.5% (capped; still eligible for 2025)
 */
function applicableFigure2025(fplRatio: number): number {
  if (fplRatio <= 1.5) return 0
  if (fplRatio <= 2.0) return linearInterpolate(1.5, 0, 2.0, 0.02, fplRatio)
  if (fplRatio <= 2.5) return linearInterpolate(2.0, 0.02, 2.5, 0.04, fplRatio)
  if (fplRatio <= 3.0) return linearInterpolate(2.5, 0.04, 3.0, 0.06, fplRatio)
  if (fplRatio <= 4.0) return linearInterpolate(3.0, 0.06, 4.0, 0.085, fplRatio)
  // Above 400% -- still eligible for 2025 at 8.5% cap
  return 0.085
}

/** Simple linear interpolation between two points */
function linearInterpolate(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x: number
): number {
  return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)
}
