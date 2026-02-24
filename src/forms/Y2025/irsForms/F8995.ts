import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'

export function getF8995PhaseOutIncome(filingStatus: FilingStatus): number {
  let formAMinAmount = 170050
  if (filingStatus === FilingStatus.MFJ) {
    formAMinAmount = 340100
  }
  return formAMinAmount
}

function ifNumber(
  num: number | undefined,
  f: (num: number) => number | undefined
) {
  return num !== undefined ? f(num) : undefined
}

export default class F8995 extends F1040Attachment {
  tag: FormTag = 'f8995'
  sequenceIndex = 55

  applicableK1s = () =>
    this.f1040.info.scheduleK1Form1065s.filter((k1) => k1.section199AQBI > 0)

  netCapitalGains = (): number => {
    let rtn = this.f1040.l3a() ?? 0
    if (this.f1040.scheduleD.isNeeded()) {
      const l15 = this.f1040.scheduleD.l15()
      const l16 = this.f1040.scheduleD.l16()
      const min = Math.min(l15, l16)
      if (min > 0) rtn += min
    } else {
      rtn += this.f1040.l7() ?? 0
    }
    return rtn
  }

  l2 = (): number | undefined =>
    this.applicableK1s()
      .map((k1) => k1.section199AQBI)
      .reduce((c, a) => c + a, 0)
  // Line 3: Qualified REIT dividends and publicly traded partnership (PTP) income
  l3 = (): number | undefined => {
    const reitDivs = this.f1040.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + (k1.qualifiedReitDividends ?? 0),
      0
    )
    const ptpIncome = this.f1040.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + (k1.publiclyTradedPartnershipIncome ?? 0),
      0
    )
    // Also include 1099-DIV section 199A dividends (REIT from mutual funds)
    const divReit = this.f1040
      .f1099Divs()
      .reduce((sum, f) => sum + (f.form.section199ADividends ?? 0), 0)
    const total = reitDivs + ptpIncome + divReit
    return total !== 0 ? total : undefined
  }
  l4 = (): number | undefined =>
    ifNumber(this.l2(), (num) => num + (this.l3() ?? 0))
  l5 = (): number | undefined => ifNumber(this.l4(), (num) => num * 0.2)

  // Line 6: Qualified REIT dividends (from K-1 and 1099-DIV)
  l6 = (): number => {
    const k1Reit = this.f1040.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + (k1.qualifiedReitDividends ?? 0),
      0
    )
    const divReit = this.f1040
      .f1099Divs()
      .reduce((sum, f) => sum + (f.form.section199ADividends ?? 0), 0)
    return k1Reit + divReit
  }

  // Line 7: Qualified PTP income (from K-1)
  l7 = (): number =>
    this.f1040.info.scheduleK1Form1065s.reduce(
      (sum, k1) => sum + (k1.publiclyTradedPartnershipIncome ?? 0),
      0
    )
  l8 = (): number | undefined => ifNumber(this.l6(), (num) => num + this.l7())
  l9 = (): number | undefined => ifNumber(this.l8(), (num) => num * 0.2)

  l10 = (): number | undefined =>
    ifNumber(this.l5(), (num) => num + (this.l9() ?? 0))
  l11 = (): number => this.f1040.l11() - this.f1040.l12()
  l12 = (): number => this.netCapitalGains()
  l13 = (): number => Math.max(0, this.l11() - this.l12())
  l14 = (): number => this.l13() * 0.2
  l15 = (): number => Math.min(this.l10() ?? 0, this.l14())
  l16 = (): number => Math.min(0, (this.l2() ?? 0) + (this.l3() ?? 0))
  l17 = (): number => Math.min(0, this.l6() + this.l7())

  deductions = (): number => this.l15()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.applicableK1s()[0]?.partnershipName,
    this.applicableK1s()[0]?.partnershipEin,
    this.applicableK1s()[0]?.section199AQBI,
    this.applicableK1s()[1]?.partnershipName,
    this.applicableK1s()[1]?.partnershipEin,
    this.applicableK1s()[1]?.section199AQBI,
    this.applicableK1s()[2]?.partnershipName,
    this.applicableK1s()[2]?.partnershipEin,
    this.applicableK1s()[2]?.section199AQBI,
    this.applicableK1s()[3]?.partnershipName,
    this.applicableK1s()[3]?.partnershipEin,
    this.applicableK1s()[3]?.section199AQBI,
    this.applicableK1s()[4]?.partnershipName,
    this.applicableK1s()[4]?.partnershipEin,
    this.applicableK1s()[4]?.section199AQBI,
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
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
    this.l17()
  ]
}
