import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form4562Data } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

export default class F4562 extends F1040Attachment {
  tag: FormTag = 'f4562'
  sequenceIndex = 40
  data: Form4562Data

  constructor(f1040: F1040, data: Form4562Data) {
    super(f1040)
    this.data = data
  }

  // Part I: Election To Expense Certain Property Under Section 179
  l1 = (): number => this.data.maximumAmount ?? 1220000 // 2024 limit
  l2 = (): number => this.data.totalCostOfSection179Property ?? 0
  l3 = (): number => this.data.thresholdCost ?? 3050000 // 2024 phaseout threshold

  l4 = (): number => {
    const excess = Math.max(0, this.l2() - this.l3())
    return Math.max(0, this.l1() - excess)
  }

  l5 = (): number => {
    // married filing separately
    if (this.f1040.info.taxPayer.filingStatus === 'MFS') {
      return this.l4() / 2
    }
    return this.l4()
  }

  // Line 6 property array handled in PDF output layer
  l7 = (): number | undefined => undefined // Listed property from Part V

  l8 = (): number => {
    let totalElectedCost = 0
    if (this.data.section179Property) {
      totalElectedCost += this.data.section179Property.reduce(
        (acc, p) => acc + p.electedCost,
        0
      )
    }
    return sumFields([totalElectedCost, this.l7()])
  }

  l9 = (): number =>
    this.data.tentativeDeduction ?? Math.min(this.l5(), this.l8())
  l10 = (): number =>
    this.data.carryoverOfDisallowedDeductionFromPriorYear ?? 0
  l11 = (): number => this.data.businessIncomeLimitation ?? 99999999

  l12 = (): number => {
    return Math.min(sumFields([this.l9(), this.l10()]), this.l11())
  }
  l13 = (): number => sumFields([this.l9(), this.l10()]) - this.l12()

  // Part II: Special Depreciation Allowance
  l14 = (): number => this.data.specialDepreciationAllowance ?? 0
  l15 = (): number => this.data.propertySubjectTo168f1 ?? 0
  l16 = (): number => this.data.otherDepreciation ?? 0

  // Part III: MACRS Depreciation
  l17 = (): number => this.data.macrsDeductionsPriorYears ?? 0

  // Line 19 list
  l19Total = (): number => {
    if (!this.data.macrsProperty) return 0
    return this.data.macrsProperty.reduce(
      (acc, p) => acc + p.depreciationDeduction,
      0
    )
  }

  // Part IV: Summary
  l21 = (): number => this.data.listedProperty ?? 0
  l22 = (): number => {
    return sumFields([
      this.l12(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l19Total(),
      this.l21()
    ])
  }

  l23 = (): number => {
    // Only applies to Section 263A costs
    return 0
  }

  // Part VI: Amortization
  l42Total = (): number => {
    if (!this.data.amortizationCosts) return 0
    return this.data.amortizationCosts.reduce(
      (acc, a) => acc + a.amortizationForThisYear,
      0
    )
  }

  l43 = (): number | undefined => undefined // Amortization prior years
  l44 = (): number => sumFields([this.l42Total(), this.l43()])

  // Total depreciation deduction for Schedule C / E / F
  totalDeduction = (): number => this.l22() + this.l44()

  isNeeded = (): boolean =>
    (this.f1040.info.form4562s?.length ?? 0) > 0

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.data.businessOrActivityToWhichThisFormRelates,
    this.f1040.info.taxPayer.primaryPerson?.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    undefined, // l6a
    undefined, // l6b
    undefined, // l6c
    this.l7(),
    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),
    this.l15(),
    this.l16(),
    this.l17(),
    undefined, // l18
    undefined, // l19a col a-g
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined, // l20
    this.l21(),
    this.l22(),
    this.l23(),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    this.l42Total(),
    this.l43(),
    this.l44()
  ]
}
