import {
  AccountType,
  Dependent,
  FilingStatus,
  IncomeW2,
  PersonRole,
  PlanType1099,
  Asset
} from 'ustaxes/core/data'
import federalBrackets, { CURRENT_YEAR } from '../data/federal'
import F4972 from './F4972'
import F5695 from './F5695'
import F8814 from './F8814'
import F8888 from './F8888'
import F8889 from './F8889'
import F8910 from './F8910'
import F8936 from './F8936'
import F8959 from './F8959'
import F8995, { getF8995PhaseOutIncome } from './F8995'
import F8995A from './F8995A'
import Schedule1 from './Schedule1'
import Schedule2 from './Schedule2'
import Schedule3 from './Schedule3'
import Schedule8812 from './Schedule8812'
import ScheduleA from './ScheduleA'
import ScheduleD from './ScheduleD'
import ScheduleE from './ScheduleE'
import ScheduleSE from './ScheduleSE'
import ScheduleEIC from './ScheduleEIC'
import ScheduleR from './ScheduleR'
import Form, { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import ScheduleB from './ScheduleB'
import { computeOrdinaryTax } from './TaxTable'
import SDQualifiedAndCapGains from './worksheets/SDQualifiedAndCapGains'
import QualifyingDependents from './worksheets/QualifyingDependents'
import SocialSecurityBenefitsWorksheet from './worksheets/SocialSecurityBenefits'
import F4797 from './F4797'
import SimplifiedMethodWorksheet from './worksheets/SimplifiedMethodWorksheet'
import StudentLoanInterestWorksheet from './worksheets/StudentLoanInterestWorksheet'
import F1040V from './F1040v'
import _ from 'lodash'
import F8960 from './F8960'
import F4952 from './F4952'
import F2555 from './F2555'
import F4563 from './F4563'
import F1116 from './F1116'
import F8606 from './F8606'
import F8863 from './F8863'
import F8962 from './F8962'
import F4136 from './F4136'
import F2439 from './F2439'
import F2441 from './F2441'
import ScheduleC from './ScheduleC'
import F8949 from './F8949'
import F6251 from './F6251'
import F4137 from './F4137'
import F8919 from './F8919'
import F8853 from './F8853'
import F2210 from './F2210'
import F8283 from './F8283'
import F8582 from './F8582'
import F8829 from './F8829'
import F8880 from './F8880'
import ScheduleF from './ScheduleF'
import F4562 from './F4562'
import F8801 from './F8801'
import Schedule1A from './Schedule1A'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040Base, { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040Attachment from './F1040Attachment'

export default class F1040 extends F1040Base {
  tag: FormTag = 'f1040'
  sequenceIndex = 0

  assets: Asset<Date>[]

  schedule1: Schedule1
  schedule2: Schedule2
  schedule3: Schedule3
  scheduleA: ScheduleA
  scheduleB: ScheduleB
  scheduleC?: ScheduleC
  _scheduleCList?: ScheduleC[]
  scheduleD: ScheduleD
  scheduleE: ScheduleE
  scheduleSE: ScheduleSE
  scheduleEIC: ScheduleEIC
  scheduleF?: ScheduleF
  _scheduleFList?: ScheduleF[]
  scheduleR?: ScheduleR
  schedule8812: Schedule8812
  f1116?: F1116
  _f1116List?: F1116[]
  f2210?: F2210
  f2439?: F2439
  f2441?: F2441
  f2555?: F2555
  f4136?: F4136
  f4137?: F4137
  f4563?: F4563
  f4797?: F4797
  f4952?: F4952
  f4972?: F4972
  f5695?: F5695
  f6251: F6251
  f8606?: F8606
  _f8606List?: F8606[]
  f8283?: F8283
  f8814?: F8814
  _f8814List?: F8814[]
  f8582?: F8582
  f4562?: F4562
  _f4562List?: F4562[]
  f8829?: F8829
  _f8829List?: F8829[]
  f8853?: F8853
  f8863?: F8863
  f8801?: F8801
  f8880?: F8880
  f8888?: F8888
  f8889: F8889
  f8889Spouse?: F8889
  f8910?: F8910
  f8919?: F8919
  f8936?: F8936
  f8949: F8949
  _f8949s?: F8949[]
  f8959: F8959
  f8960: F8960
  f8962?: F8962
  f8995?: F8995 | F8995A
  schedule1A?: Schedule1A
  qualifiedAndCapGainsWorksheet?: SDQualifiedAndCapGains
  studentLoanInterestWorksheet?: StudentLoanInterestWorksheet
  socialSecurityBenefitsWorksheet?: SocialSecurityBenefitsWorksheet

  qualifyingDependents: QualifyingDependents

  constructor(info: ValidatedInformation, assets: Asset<Date>[]) {
    super(info)
    this.assets = assets
    this.qualifyingDependents = new QualifyingDependents(this)

    this.scheduleA = new ScheduleA(this)
    this.scheduleB = new ScheduleB(this)
    this.scheduleD = new ScheduleD(this)
    this.scheduleE = new ScheduleE(this)
    this.scheduleEIC = new ScheduleEIC(this)
    this.scheduleSE = new ScheduleSE(this)

    // Create Schedule C forms for each business
    if (
      this.info.scheduleCBusinesses !== undefined &&
      this.info.scheduleCBusinesses.length > 0
    ) {
      this._scheduleCList = this.info.scheduleCBusinesses.map(
        (data) => new ScheduleC(this, data)
      )
      this.scheduleC = this._scheduleCList[0]
    }

    // Create Schedule F for farm income
    if (this.info.scheduleFData !== undefined && this.info.scheduleFData.length > 0) {
      this._scheduleFList = this.info.scheduleFData.map(
        (data) => new ScheduleF(this, data)
      )
      this.scheduleF = this._scheduleFList[0]
    }

    // Create Form 8880 for saver's credit
    if (this.info.form8880 !== undefined) {
      this.f8880 = new F8880(this, this.info.form8880)
    }

    // Create Form 8283 for noncash charity
    if (this.info.form8283 !== undefined && this.info.form8283.contributions.length > 0) {
      this.f8283 = new F8283(this, this.info.form8283)
    }

    // Create Form 2441 if child/dependent care data exists
    if (this.info.form2441 !== undefined) {
      this.f2441 = new F2441(this)
    }

    // Create Form 8863 if education credit data exists
    if (this.info.form8863 !== undefined && this.info.form8863.students.length > 0) {
      this.f8863 = new F8863(this, this.info.form8863)
    }

    // Create Form 8962 if marketplace health insurance data exists
    if (this.info.form8962 !== undefined && this.info.form8962.policies.length > 0) {
      this.f8962 = new F8962(this, this.info.form8962)
    }

    // Create Form 8606 for nondeductible IRA activity
    if (this.info.form8606s !== undefined && this.info.form8606s.length > 0) {
      this._f8606List = this.info.form8606s.map(
        (data) => new F8606(this, data)
      )
      this.f8606 = this._f8606List[0]
    }

    // Create Form 8829 for home office deduction
    if (this.info.form8829s !== undefined && this.info.form8829s.length > 0) {
      this._f8829List = this.info.form8829s.map(
        (data) => new F8829(this, data)
      )
      this.f8829 = this._f8829List[0]
    }

    // Create Form 8582 for passive activity loss limitations
    if (this.info.form8582 !== undefined || this.info.realEstate.length > 0) {
      this.f8582 = new F8582(this)
    }

    // Create Form 1116 for foreign tax credit
    if (this.info.form1116s !== undefined && this.info.form1116s.length > 0) {
      this._f1116List = this.info.form1116s.map(
        (data) => new F1116(this, data)
      )
      this.f1116 = this._f1116List[0]
    }

    // Create Form 2555 for foreign earned income exclusion
    if (this.info.form2555s !== undefined && this.info.form2555s.length > 0) {
      this.f2555 = new F2555(this, this.info.form2555s[0])
    }

    // Create Form 5695 if residential energy credit data exists
    if (this.info.form5695 !== undefined) {
      this.f5695 = new F5695(this, this.info.form5695)
    }

    // Create Form 4137 for unreported tip income
    if (this.info.form4137 !== undefined) {
      this.f4137 = new F4137(this, this.info.form4137)
    }

    // Create Form 8919 for uncollected SS/Medicare tax on wages
    if (this.info.form8919 !== undefined) {
      this.f8919 = new F8919(this, this.info.form8919)
    }

    // Create Form 4797 for sales of business property
    if (this.info.form4797 !== undefined) {
      this.f4797 = new F4797(this, this.info.form4797)
    }

    // Create Form 4952 for investment interest expense deduction
    if (this.info.form4952 !== undefined) {
      this.f4952 = new F4952(this, this.info.form4952)
    }

    // Create Form 4562 for depreciation and amortization
    if (this.info.form4562s !== undefined && this.info.form4562s.length > 0) {
      this._f4562List = this.info.form4562s.map(
        (data) => new F4562(this, data)
      )
      this.f4562 = this._f4562List[0]
    }

    // Create Form 8814 for child's interest/dividends on parent's return
    if (this.info.form8814s !== undefined && this.info.form8814s.length > 0) {
      this._f8814List = this.info.form8814s.map(
        (data) => new F8814(this, data)
      )
      this.f8814 = this._f8814List[0]
    }

    // Create Schedule R for credit for elderly/disabled
    if (this.info.scheduleRData !== undefined) {
      this.scheduleR = new ScheduleR(this)
    }

    this.schedule1 = new Schedule1(this)
    this.schedule2 = new Schedule2(this)
    this.schedule3 = new Schedule3(this)
    this.schedule8812 = new Schedule8812(this)

    this.f6251 = new F6251(this)
    this.f8949 = new F8949(this)
    this.f8889 = new F8889(this, this.info.taxPayer.primaryPerson)

    // add in separate form 8889 for the spouse
    if (this.info.taxPayer.spouse) {
      this.f8889Spouse = new F8889(this, this.info.taxPayer.spouse)
    }

    this.f8959 = new F8959(this)
    this.f8960 = new F8960(this)

    if (this.f1099ssas().length > 0) {
      const ssws = new SocialSecurityBenefitsWorksheet(this)
      this.socialSecurityBenefitsWorksheet = ssws
    }

    if (this.info.f1098es.length > 0) {
      this.studentLoanInterestWorksheet = new StudentLoanInterestWorksheet(
        this,
        this.info.f1098es
      )
    }

    // Create Form 8801 for prior year minimum tax credit
    if (this.info.form8801 !== undefined) {
      this.f8801 = new F8801(this, this.info.form8801)
    }

    // Create Form 2210 for underpayment penalty calculation
    if (this.info.form2210 !== undefined) {
      this.f2210 = new F2210(this, this.info.form2210)
    }

    // Create Schedule 1-A for additional deductions (TY2026+)
    if (this.info.schedule1AData !== undefined) {
      this.schedule1A = new Schedule1A(this)
    }

    if (this.totalQbi() > 0) {
      const formAMinAmount = getF8995PhaseOutIncome(
        this.info.taxPayer.filingStatus
      )
      if (this.l11() - this.l12() >= formAMinAmount) {
        this.f8995 = new F8995A(this)
      } else {
        this.f8995 = new F8995(this)
      }
    }
  }

  get f8949s(): F8949[] {
    if (this._f8949s === undefined) {
      this._f8949s = [this.f8949, ...this.f8949.copies()]
    }
    return this._f8949s
  }

  totalQbi = () =>
    this.info.scheduleK1Form1065s
      .map((k1) => k1.section199AQBI)
      .reduce((c, a) => c + a, 0)

  // Total net profit/loss from all Schedule C businesses
  scheduleCNetProfit = (): number =>
    (this._scheduleCList ?? []).reduce(
      (sum, sc) => sum + sc.netProfitOrLoss(),
      0
    )

  // All Schedule C forms (for copies pattern)
  get scheduleCList(): ScheduleC[] {
    return this._scheduleCList ?? []
  }

  // All Form 8606 forms (for copies pattern)
  get f8606List(): F8606[] {
    return this._f8606List ?? []
  }

  // All Form 1116 forms (for copies pattern)
  get f1116List(): F1116[] {
    return this._f1116List ?? []
  }

  // All Schedule F forms
  get scheduleFList(): ScheduleF[] {
    return this._scheduleFList ?? []
  }

  // All Form 8814 forms (for copies pattern)
  get f8814List(): F8814[] {
    return this._f8814List ?? []
  }

  // Total F8814 income for Schedule 1, line 8n
  f8814TotalIncome = (): number =>
    (this._f8814List ?? []).reduce((sum, f) => sum + f.l12(), 0)

  // Total F8814 tax for Form 1040, line 16
  f8814TotalTax = (): number =>
    (this._f8814List ?? []).reduce((sum, f) => sum + f.tax(), 0)

  // Total net farm profit/loss from all Schedule F
  scheduleFNetProfit = (): number =>
    (this._scheduleFList ?? []).reduce(
      (sum, sf) => sum + sf.netProfitOrLoss(),
      0
    )

  // Total foreign tax credit across all categories
  totalForeignTaxCredit = (): number =>
    (this._f1116List ?? []).reduce((sum, f) => sum + f.l24(), 0)

  toString = (): string => `
    Form 1040 generated from information:
    Information:
    ${JSON.stringify(this.info)}
  `

  // TODO - get from W2 box 12, code Q
  nonTaxableCombatPay = (): number | undefined => undefined

  schedules = (): Form[] => {
    const res1: (F1040Attachment | undefined)[] = [
      this.scheduleA,
      this.scheduleB,
      this.scheduleC,
      this.scheduleD,
      this.scheduleE,
      this.scheduleSE,
      this.scheduleF,
      this.scheduleR,
      this.scheduleEIC,
      this.schedule8812,
      this.f1116,
      this.f2210,
      this.f2441,
      this.f2555,
      this.f4137,
      this.f4562,
      this.f4797,
      this.f8283,
      this.f8606,
      this.f8829,
      this.f8863,
      this.f8801,
      this.f8880,
      this.f4952,
      this.f4972,
      this.f5695,
      this.f6251,
      this.f8582,
      this.f8814,
      this.f8888,
      this.f8889,
      this.f8889Spouse,
      this.f8910,
      this.f8919,
      this.f8936,
      this.f8949,
      this.f8959,
      this.f8960,
      this.f8962,
      this.f8995,
      this.schedule1,
      this.schedule1A,
      this.schedule2,
      this.schedule3
    ]
    const res = _.compact(res1)
      .filter((f) => f.isNeeded())
      .flatMap((f) => [f, ...f.copies()])

    // Attach payment voucher to front if there is a payment due
    if (this.l37() > 0) {
      res.push(new F1040V(this))
    }

    return [this, ...res].sort((a, b) => a.sequenceIndex - b.sequenceIndex)
  }

  // born before 1959/01/02
  bornBeforeDate = (): boolean =>
    this.info.taxPayer.primaryPerson.dateOfBirth <
    new Date(CURRENT_YEAR - 64, 0, 2)

  blind = (): boolean => this.info.taxPayer.primaryPerson.isBlind

  spouseBeforeDate = (): boolean =>
    (this.info.taxPayer.spouse?.dateOfBirth ?? new Date()) <
    new Date(CURRENT_YEAR - 64, 0, 2)

  spouseBlind = (): boolean => this.info.taxPayer.spouse?.isBlind ?? false

  validW2s = (): IncomeW2[] => {
    if (this.info.taxPayer.filingStatus === FilingStatus.MFS) {
      return this.info.w2s.filter((w2) => w2.personRole === PersonRole.PRIMARY)
    }
    return this.info.w2s
  }

  wages = (): number => this.validW2s().reduce((res, w2) => res + w2.income, 0)
  medicareWages = (): number =>
    this.validW2s().reduce((res, w2) => res + w2.medicareIncome, 0)

  occupation = (r: PersonRole): string | undefined =>
    this.info.w2s.find((w2) => w2.personRole === r && w2.occupation !== '')
      ?.occupation

  standardDeduction = (): number | undefined => {
    const filingStatus = this.info.taxPayer.filingStatus

    const allowances = [
      this.bornBeforeDate(),
      this.blind(),
      this.spouseBeforeDate(),
      this.spouseBlind()
    ].reduce((res, e) => res + +!!e, 0)

    if (
      this.info.taxPayer.primaryPerson.isTaxpayerDependent ||
      (this.info.taxPayer.spouse?.isTaxpayerDependent ?? false)
    ) {
      const l4a = Math.min(
        federalBrackets.ordinary.status[filingStatus].deductions[0].amount,
        this.wages() > 750 ? this.wages() + 350 : 1100
      )
      if (allowances > 0) {
        if (
          filingStatus === FilingStatus.HOH ||
          filingStatus === FilingStatus.S
        ) {
          return l4a + allowances * 1700
        } else {
          return l4a + allowances * 1350
        }
      } else {
        return l4a
      }
    }

    return federalBrackets.ordinary.status[filingStatus].deductions[allowances]
      .amount
  }

  totalQualifiedDividends = (): number =>
    this.f1099Divs()
      .map((f) => f.form.qualifiedDividends)
      .reduce((l, r) => l + r, 0)

  totalGrossDistributionsFromIra = (): number =>
    this.info.individualRetirementArrangements.reduce(
      (res, i) => res + i.grossDistribution,
      0
    )

  totalTaxableFromIra = (): number =>
    this.info.individualRetirementArrangements.reduce(
      (r, i) => r + i.taxableAmount,
      0
    )

  totalGrossDistributionsFrom1099R = (planType: PlanType1099): number =>
    this.f1099rs()
      .filter((element) => element.form.planType === planType)
      .reduce((res, f1099) => res + f1099.form.grossDistribution, 0)

  totalTaxableFrom1099R = (planType: PlanType1099): number =>
    this.f1099rs()
      .filter((element) => element.form.planType === planType)
      .reduce((res, f1099) => res + f1099.form.taxableAmount, 0)

  l1a = (): number => this.wages()
  l1b = (): number | undefined => this.info.householdEmployeeIncome ?? undefined
  l1c = (): number | undefined => this.f4137?.l4()
  l1d = (): number | undefined => this.info.medicaidWaiverPayments ?? undefined
  l1e = (): number | undefined => {
    const val = this.f2441?.l14()
    return val !== undefined && val > 0 ? val : undefined
  }
  l1f = (): number | undefined => undefined
  l1g = (): number | undefined => {
    const wages = this.f8919?.l5()
    return wages !== undefined && wages > 0 ? wages : undefined
  }
  l1h = (): number | undefined => this.info.strikeBenefits ?? undefined
  l1i = (): number | undefined => this.info.stockOptionIncome ?? undefined
  l1z = (): number =>
    sumFields([
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l1e(),
      this.l1f(),
      this.l1g(),
      this.l1h(),
      this.l1i()
    ])
  l2a = (): number | undefined => this.scheduleB.l3()
  l2b = (): number | undefined => this.scheduleB.to1040l2b()
  l3a = (): number | undefined => this.totalQualifiedDividends()
  l3b = (): number | undefined => this.scheduleB.to1040l3b()
  // This is the value of box 1 in 1099-R forms coming from IRAs
  l4a = (): number | undefined => this.totalGrossDistributionsFromIra()
  // Taxable IRA distributions. If Form 8606 is filed, use its calculation
  // (accounts for nontaxable basis); otherwise use 1099-R box 2a.
  l4b = (): number | undefined => {
    if (this._f8606List && this._f8606List.length > 0) {
      return this._f8606List.reduce((sum, f) => sum + f.taxableAmount(), 0)
    }
    return this.totalTaxableFromIra()
  }
  // This is the value of box 1 in 1099-R forms coming from pensions/annuities
  l5a = (): number | undefined =>
    this.totalGrossDistributionsFrom1099R(PlanType1099.Pension)
  // Taxable pension/annuity amount. Uses Simplified Method Worksheet when
  // box 2a is not determined; otherwise uses box 2a directly.
  l5b = (): number | undefined => {
    const pensions = this.f1099rs().filter(
      (f) => f.form.planType === PlanType1099.Pension
    )
    if (pensions.length === 0) return undefined
    return pensions.reduce((sum, f) => {
      if (f.form.taxableAmountNotDetermined && f.form.simplifiedMethodData) {
        const ws = new SimplifiedMethodWorksheet(
          f.form.grossDistribution,
          f.form.simplifiedMethodData
        )
        return sum + ws.taxableAmount()
      }
      return sum + f.form.taxableAmount
    }, 0)
  }
  // The sum of box 5 from SSA-1099
  l6a = (): number | undefined => this.socialSecurityBenefitsWorksheet?.l1()
  // calculation of the taxable amount of line 6a based on other income
  l6b = (): number | undefined =>
    this.socialSecurityBenefitsWorksheet?.taxableAmount()
  // TODO: change this so that it is not hard coded
  l6c = (): boolean => false
  l7Box = (): boolean => !this.scheduleD.isNeeded()
  l7 = (): number | undefined => this.scheduleD.to1040()
  l8 = (): number | undefined => this.schedule1.l10()
  l9 = (): number =>
    sumFields([
      this.l1z(),
      this.l2b(),
      this.l3b(),
      this.l4b(),
      this.l5b(),
      this.l6b(),
      this.l7(),
      this.l8()
    ])

  l10 = (): number | undefined => this.schedule1.to1040Line10()

  l11 = (): number => Math.max(0, this.l9() - (this.l10() ?? 0))

  l12 = (): number => {
    if (this.scheduleA.isNeeded()) {
      return this.scheduleA.deductions()
    }
    return this.standardDeduction() ?? 0
  }

  l13 = (): number | undefined => this.f8995?.deductions()
  // Line 13b: Schedule 1-A additional deductions (TY2026+)
  l13b = (): number | undefined => this.schedule1A?.deduction()
  l14 = (): number => sumFields([this.l12(), this.l13(), this.l13b()])

  l15 = (): number => Math.max(0, this.l11() - this.l14())

  f8814Box = (): boolean | undefined => this.f8814 !== undefined
  f4972Box = (): boolean | undefined => this.f4972 !== undefined
  // TODO: tax from other form?
  otherFormBox = (): boolean => false
  otherFormName = (): string | undefined => undefined

  computeTax = (): number | undefined => {
    // If Schedule D Tax Worksheet is needed (28% rate gain or unrecaptured 1250),
    // use it instead of the simpler Qualified Dividends worksheet
    if (this.scheduleD.taxWorksheet.isNeeded()) {
      return this.scheduleD.taxWorksheet.tax()
    }

    if (
      this.scheduleD.computeTaxOnQDWorksheet() ||
      this.totalQualifiedDividends() > 0
    ) {
      this.qualifiedAndCapGainsWorksheet = new SDQualifiedAndCapGains(this)
      return this.qualifiedAndCapGainsWorksheet.tax()
    }

    return computeOrdinaryTax(this.info.taxPayer.filingStatus, this.l15())
  }

  l16 = (): number | undefined =>
    sumFields([this.f8814TotalTax(), this.f4972?.tax(), this.computeTax()])

  l17 = (): number | undefined => this.schedule2.l3()
  l18 = (): number => sumFields([this.l16(), this.l17()])

  l19 = (): number | undefined => this.schedule8812.to1040Line19()
  l20 = (): number | undefined =>
    this.schedule3.isNeeded() ? this.schedule3.l8() : undefined

  l21 = (): number => sumFields([this.l19(), this.l20()])

  l22 = (): number => Math.max(0, this.l18() - this.l21())

  l23 = (): number | undefined => this.schedule2.l21()

  l24 = (): number => sumFields([this.l22(), this.l23()])

  l25a = (): number =>
    this.validW2s().reduce((res, w2) => res + w2.fedWithholding, 0)

  // tax withheld from all 1099 types (R, SSA, INT, DIV, B, NEC, MISC, G)
  l25b = (): number => {
    const from1099R = this.f1099rs().reduce(
      (res, f1099) => res + f1099.form.federalIncomeTaxWithheld,
      0
    )
    const from1099SSA = this.f1099ssas().reduce(
      (res, f1099) => res + f1099.form.federalIncomeTaxWithheld,
      0
    )
    const from1099Int = this.f1099Ints().reduce(
      (res, f1099) => res + (f1099.form.federalIncomeTaxWithheld ?? 0),
      0
    )
    const from1099Div = this.f1099Divs().reduce(
      (res, f1099) => res + (f1099.form.federalIncomeTaxWithheld ?? 0),
      0
    )
    const from1099B = this.f1099Bs().reduce(
      (res, f1099) => res + (f1099.form.federalIncomeTaxWithheld ?? 0),
      0
    )
    const from1099NEC = (this.info.f1099necs ?? []).reduce(
      (res, f1099) => res + f1099.form.federalIncomeTaxWithheld,
      0
    )
    const from1099MISC = (this.info.f1099miscs ?? []).reduce(
      (res, f1099) => res + f1099.form.federalIncomeTaxWithheld,
      0
    )
    const from1099G = (this.info.f1099gs ?? []).reduce(
      (res, f1099) => res + f1099.form.federalIncomeTaxWithheld,
      0
    )
    return from1099R + from1099SSA + from1099Int + from1099Div + from1099B +
      from1099NEC + from1099MISC + from1099G
  }

  // TODO: form(s) W-2G box 4, schedule K-1, form 1042-S, form 8805, form 8288-A
  l25c = (): number | undefined => this.f8959.l24()

  l25d = (): number => sumFields([this.l25a(), this.l25b(), this.l25c()])

  l26 = (): number =>
    this.info.estimatedTaxes.reduce((res, et) => res + et.payment, 0)

  l27 = (): number =>
    this.scheduleEIC.isNeeded() ? this.scheduleEIC.credit() : 0

  // TODO: handle taxpayers between 1998 and 2004 that
  // can claim themselves for eic.
  //l27acheckBox = (): boolean => false

  // TODO: nontaxable combat pay
  //l27b = (): number | undefined => undefined

  // TODO: prior year earned income
  //l27c = (): number | undefined => undefined

  l28 = (): number | undefined => this.schedule8812.to1040Line28()

  l29 = (): number | undefined => this.f8863?.l8()

  // TODO: recovery rebate credit?
  l30 = (): number | undefined => undefined

  l31 = (): number | undefined =>
    this.schedule3.isNeeded() ? this.schedule3.l15() : undefined

  l32 = (): number =>
    sumFields([this.l27(), this.l28(), this.l29(), this.l30(), this.l31()])

  l33 = (): number => sumFields([this.l25d(), this.l26(), this.l32()])

  l34 = (): number => Math.max(0, this.l33() - this.l24())

  // TODO: assuming user wants amount refunded
  // rather than applied to estimated tax
  l35a = (): number => this.l34()
  l36 = (): number => Math.max(0, this.l34() - this.l35a())

  l37 = (): number => Math.max(0, this.l24() - this.l33())

  // Estimated tax penalty (from Form 2210)
  l38 = (): number | undefined => this.f2210?.estimatedTaxPenalty()

  _depField = (idx: number): string | boolean => {
    const deps: Dependent[] = this.info.taxPayer.dependents

    // Based on the PDF row we are on, select correct dependent
    const depIdx = Math.floor(idx / 5)
    const depFieldIdx = idx % 5

    let fieldArr = ['', '', '', false, false]

    if (depIdx < deps.length) {
      const dep = deps[depIdx]
      // Based on the PDF column, select the correct field
      fieldArr = [
        `${dep.firstName} ${dep.lastName}`,
        dep.ssid,
        dep.relationship,
        this.qualifyingDependents.qualifiesChild(dep),
        this.qualifyingDependents.qualifiesOther(dep)
      ]
    }

    return fieldArr[depFieldIdx]
  }

  // 1040 allows 4 dependents listed without a supplemental schedule,
  // so create field mappings for 4x5 grid of fields
  _depFieldMappings = (): Array<string | boolean> =>
    Array.from(Array(20)).map((u, n: number) => this._depField(n))

  fields = (): Field[] =>
    [
      '',
      '',
      '',
      this.info.taxPayer.primaryPerson.firstName,
      this.info.taxPayer.primaryPerson.lastName,
      this.info.taxPayer.primaryPerson.ssid,
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.firstName
        : '',
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.lastName ?? ''
        : '',
      this.info.taxPayer.spouse?.ssid,
      this.info.taxPayer.primaryPerson.address.address,
      this.info.taxPayer.primaryPerson.address.aptNo,
      this.info.taxPayer.primaryPerson.address.city,
      this.info.taxPayer.primaryPerson.address.state,
      this.info.taxPayer.primaryPerson.address.zip,
      this.info.taxPayer.primaryPerson.address.foreignCountry,
      this.info.taxPayer.primaryPerson.address.province,
      this.info.taxPayer.primaryPerson.address.postalCode,
      false, // election campaign boxes
      false,
      this.info.taxPayer.filingStatus === FilingStatus.S,
      this.info.taxPayer.filingStatus === FilingStatus.HOH,
      this.info.taxPayer.filingStatus === FilingStatus.MFJ,
      this.info.taxPayer.filingStatus === FilingStatus.MFS,
      this.info.taxPayer.filingStatus === FilingStatus.W,
      // TODO: implement non dependent child for HOH and QW
      this.info.taxPayer.filingStatus === 'MFS' ? this.spouseFullName() : '',
      false, //teating non-resident alien
      '',
      this.info.questions.CRYPTO ?? false,
      !(this.info.questions.CRYPTO ?? false),
      this.info.taxPayer.primaryPerson.isTaxpayerDependent,
      this.info.taxPayer.spouse?.isTaxpayerDependent ?? false,
      false, // TODO: spouse itemizes separately,
      this.bornBeforeDate(),
      this.blind(),
      this.spouseBeforeDate(),
      this.spouseBlind(),
      this.info.taxPayer.dependents.length > 4,
      ...this._depFieldMappings(),
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l1e(),
      this.l1f(),
      this.l1g(),
      this.l1h(),
      this.l1i(),
      this.l1z(),
      this.l2a(),
      this.l2b(),
      this.l3a(),
      this.l3b(),
      this.l4a(),
      this.l4b(),
      this.l5a(),
      this.l5b(),
      this.l6a(),
      this.l6b(),
      this.l6c(),
      this.l7Box(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.f8814Box(),
      this.f4972Box(),
      this.otherFormBox(),
      this.otherFormName(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20(),
      this.l21(),
      this.l22(),
      this.l23(),
      this.l24(),
      this.l25a(),
      this.l25b(),
      this.l25c(),
      this.l25d(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29(),
      undefined, //this.l30(),
      this.l31(),
      this.l32(),
      this.l33(),
      this.l34(),
      this.f8888 !== undefined,
      this.l35a(),
      this.info.refund?.routingNumber,
      this.info.refund?.accountType === AccountType.checking,
      this.info.refund?.accountType === AccountType.savings,
      this.info.refund?.accountNumber,
      this.l36(),
      this.l37(),
      this.l38(),
      // TODO: 3rd party
      false,
      false,
      '',
      '',
      '',
      this.occupation(PersonRole.PRIMARY),
      // TODO: pin numbers
      '',
      this.occupation(PersonRole.SPOUSE),
      '',
      this.info.taxPayer.contactPhoneNumber,
      this.info.taxPayer.contactEmail,
      // Paid preparer fields:
      '',
      '',
      false,
      '',
      '',
      '',
      ''
    ].map((x) => (x === undefined ? '' : x))
}
