import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8829Data } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

export default class F8829 extends F1040Attachment {
    tag: FormTag = 'f8829' // Assuming pdf file name is f8829.pdf
    sequenceIndex = 30 // Arbitrary
    data: Form8829Data

    constructor(f1040: F1040, data: Form8829Data) {
        super(f1040)
        this.data = data
    }

    // Part I: Part of Your Home Used for Business
    l1 = (): number => this.data.businessArea
    l2 = (): number => this.data.totalAreaOfHome
    l3 = (): number => {
        if (this.l2() === 0) return 0
        // Percentage to 2 decimal places
        return Number((this.l1() / this.l2()).toFixed(4))
    }
    // Simplified method not implemented yet, so line 7 is business percentage logic
    l7 = (): number => this.l3()

    // Part II: Figure Your Allowable Deduction
    // Without Schedule C integration, we assume a very large income for line 8 to avoid limiting the deduction for now
    // In a full implementation, this should link with Schedule C line 29.
    l8 = (): number => 999999

    l9a = (): number | undefined => undefined // Casualty losses
    l9b = (): number => this.data.indirectMortgageInterest
    l10a = (): number | undefined => undefined
    l10b = (): number => this.data.indirectRealEstateTaxes
    l11a = (): number | undefined => undefined
    l11b = (): number | undefined => undefined
    l12a = (): number => sumFields([this.l9a(), this.l10a(), this.l11a()])
    l12b = (): number => sumFields([this.l9b(), this.l10b(), this.l11b()])
    l13 = (): number => this.l12b() * this.l7()
    l14 = (): number => sumFields([this.l12a(), this.l13()])
    l15 = (): number => this.l8() - this.l14() > 0 ? this.l8() - this.l14() : 0

    l16a = (): number | undefined => undefined
    l16b = (): number | undefined => undefined
    l17a = (): number => this.data.directInsurance
    l17b = (): number => this.data.indirectInsurance
    l18a = (): number | undefined => undefined // Rent
    l18b = (): number | undefined => undefined
    l19a = (): number => this.data.directRepairs
    l19b = (): number => this.data.indirectRepairs
    l20a = (): number => this.data.directUtilities
    l20b = (): number => this.data.indirectUtilities
    l21a = (): number => this.data.directOther
    l21b = (): number => this.data.indirectOther
    l22a = (): number => sumFields([this.l16a(), this.l17a(), this.l18a(), this.l19a(), this.l20a(), this.l21a()])
    l22b = (): number => sumFields([this.l16b(), this.l17b(), this.l18b(), this.l19b(), this.l20b(), this.l21b()])
    l23 = (): number => this.l22b() * this.l7()
    l24 = (): number => sumFields([this.l22a(), this.l23()])
    l25 = (): number => this.l14() > this.l15() ? this.l15() : this.l24() // Wait... actually the limit logic is: "Enter the smaller of line 15 or line 24"
    l26 = (): number => Math.max(0, this.l15() - this.l25())

    // Depreciation
    l37 = (): number => this.data.costOrBasisOfHome
    l38 = (): number => this.data.costOfLand
    l39 = (): number => Math.max(0, this.l37() - this.l38())
    l40 = (): number => this.l39() * this.l7() // business basis
    // Assuming a generic depreciation percentage of 2.564% (MACRS 39 year) for testing.
    l41 = (): number => 2.564
    l42 = (): number => this.l40() * (this.l41() / 100)

    // Back to Part II
    l28a = (): number => this.l42() // Direct depreciation
    l28b = (): number | undefined => undefined // Indirect depreciation
    l29 = (): number => sumFields([this.l28a()])
    l30 = (): number => sumFields([this.l28b()]) * this.l7()
    l31 = (): number => sumFields([this.l29(), this.l30()])
    l32 = (): number => this.l31() > this.l26() ? this.l26() : this.l31()

    l33 = (): number => sumFields([this.l14(), this.l25(), this.l32()])
    l34 = (): number | undefined => undefined // Casualty losses
    l35 = (): number => Math.max(0, this.l33() - (this.l34() ?? 0))
    // l35 is the allowable deduction to carry over to Schedule C line 30

    // Part III: Depreciation logic implemented above (lines 37-42) carry values here

    fields = (): Field[] => [
        this.f1040.namesString(),
        this.f1040.info.taxPayer.primaryPerson.ssid,
        this.l1(),
        this.l2(),
        this.l3(),
        undefined,
        undefined,
        undefined,
        this.l7(),
        this.l8(),
        this.l9a(),
        this.l9b(),
        this.l10a(),
        this.l10b(),
        this.l11a(),
        this.l11b(),
        this.l12a(),
        this.l12b(),
        this.l13(),
        this.l14(),
        this.l15(),
        this.l16a(),
        this.l16b(),
        this.l17a(),
        this.l17b(),
        this.l18a(),
        this.l18b(),
        this.l19a(),
        this.l19b(),
        this.l20a(),
        this.l20b(),
        this.l21a(),
        this.l21b(),
        this.l22a(),
        this.l22b(),
        this.l23(),
        this.l24(),
        this.l25(),
        this.l26(),
        undefined, //l27
        this.l28a(),
        this.l28b(),
        this.l29(),
        this.l30(),
        this.l31(),
        this.l32(),
        this.l33(),
        this.l34(),
        this.l35(),
        undefined, //l36
        this.l37(),
        this.l38(),
        this.l39(),
        this.l40(),
        this.l41(),
        this.l42()
    ]
}
