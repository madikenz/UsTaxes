import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8606Data, PersonRole } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

export default class F8606 extends F1040Attachment {
    tag: FormTag = 'f8606'
    sequenceIndex = 65
    data: Form8606Data

    constructor(f1040: F1040, data: Form8606Data) {
        super(f1040)
        this.data = data
    }

    // Part I: Nondeductible Contributions and Nontaxable Distributions
    l1 = (): number => this.data.nondeductibleContributions
    l2 = (): number => this.data.totalBasisPriorYears
    l3 = (): number => sumFields([this.l1(), this.l2()])

    // Enter contributions made in current year between Jan 1 and April 15 of next year
    // Simplified for now - assuming 0
    l4 = (): number => 0
    l5 = (): number => Math.max(0, this.l3() - this.l4())

    l6 = (): number => this.data.valueOfAllTraditionalIRAs
    l7 = (): number => this.data.distributionsFromTraditional
    l8 = (): number => this.data.amountConverted

    l9 = (): number => sumFields([this.l6(), this.l7(), this.l8()])

    l10 = (): number => {
        if (this.l9() === 0) return 0
        const ratio = this.l5() / this.l9()
        // Cannot exceed 1.0; usually rounded to 3 decimal places but keep full float
        return Math.min(1.0, ratio)
    }

    l11 = (): number => this.l8() * this.l10()
    l12 = (): number => this.l7() * this.l10()

    l13 = (): number => sumFields([this.l11(), this.l12()])

    l14 = (): number => Math.max(0, this.l3() - this.l13()) // Total basis for next year

    // Taxable amount of distributions
    l15a = (): number => Math.max(0, this.l7() - this.l12())
    // Simplification for disaster distributions
    l15b = (): number => 0
    l15c = (): number => Math.max(0, this.l15a() - this.l15b())

    // Part II: Conversions
    l16 = (): number => this.data.amountConverted
    l17 = (): number => this.l11()
    l18 = (): number => Math.max(0, this.l16() - this.l17())

    // Part III: Roth IRA distributions
    l19 = (): number => this.data.rothDistributions ?? 0

    // Total taxable amount from F8606 to go on F1040 line 4b
    totalTaxable = (): number => sumFields([this.l15c(), this.l18()]) // Roth omitted as usually qualified or requires complex Part III

    fields = (): Field[] => [
        this.data.personRole === PersonRole.PRIMARY ?
            this.f1040.info.taxPayer.primaryPerson.firstName + ' ' + this.f1040.info.taxPayer.primaryPerson.lastName :
            (this.f1040.info.taxPayer.spouse?.firstName ?? '') + ' ' + (this.f1040.info.taxPayer.spouse?.lastName ?? ''),
        this.data.personRole === PersonRole.PRIMARY ?
            this.f1040.info.taxPayer.primaryPerson.ssid :
            this.f1040.info.taxPayer.spouse?.ssid,
        this.l1(),
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
        this.l15a(),
        this.l15b(),
        this.l15c(),
        this.l16(),
        this.l17(),
        this.l18(),
        this.l19()
    ]
}
