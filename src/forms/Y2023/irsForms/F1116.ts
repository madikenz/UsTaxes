import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form1116Data } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

export default class F1116 extends F1040Attachment {
    tag: FormTag = 'f1116'
    sequenceIndex = 35
    data: Form1116Data

    constructor(f1040: F1040, data: Form1116Data) {
        super(f1040)
        this.data = data
    }

    // Part I
    l1a = (): number => {
        return this.data.foreignIncomes.reduce((acc, inc) => acc + inc.grossIncome, 0)
    }

    // We simplify to sum all countries together for the overall category
    l2 = (): number => {
        return this.data.foreignIncomes.reduce((acc, inc) => acc + inc.definitelyAllocableDeductions, 0)
    }

    l3a = (): number => {
        return this.data.foreignIncomes.reduce((acc, inc) => acc + (inc.apportionedShareDeductions ?? 0), 0)
    }

    l6 = (): number => sumFields([this.l2(), this.l3a()])
    l7 = (): number => Math.max(0, this.l1a() - this.l6())

    // Part II
    l8 = (): number => {
        return this.data.foreignIncomes.reduce((acc, inc) => acc + inc.foreignTaxesPaidOrAccrued, 0)
    }

    // Part III
    l9 = (): number => this.l8()
    l10 = (): number => 0 // Carryback/carryover not supported yet
    l11 = (): number => sumFields([this.l9(), this.l10()])
    l12 = (): number => 0 // Reductions not supported yet
    l14 = (): number => Math.max(0, this.l11() - this.l12())
    l15 = (): number => this.l7()
    l17 = (): number => this.f1040.l15() ?? 0 // Total taxable income from all sources

    l18 = (): number => {
        if (this.l17() <= 0) return 0
        const ratio = this.l15() / this.l17()
        return Math.min(ratio, 1.0)
    }

    l19 = (): number => this.f1040.l16() ?? 0 // Total US tax

    l20 = (): number => {
        return this.l19() * this.l18()
    }

    l21 = (): number => {
        return Math.min(this.l14(), this.l20())
    }

    // Part IV: If this is the only or primary F1116, this logic goes to Sch 3
    l33 = (): number => this.l21() // Simplified, assumes 1 category or sums outside
    l35 = (): number => this.l33()

    fields = (): Field[] => [
        this.f1040.namesString(),
        this.f1040.info.taxPayer.primaryPerson.ssid,
        // Note: PDF mapping for F1116 is highly complex due to country columns and checkboxes.
        // We only map the top level amounts for the basic implementation.
        this.data.category === 'A',
        this.data.category === 'B',
        this.data.category === 'C',
        this.data.category === 'D',
        this.data.category === 'E',
        this.data.category === 'F',
        this.data.foreignIncomes[0]?.country,
        this.l1a(),
        this.l2(),
        this.l3a(),
        this.l6(),
        this.l7(),
        this.l8(),
        this.l9(),
        this.l10(),
        this.l11(),
        this.l12(),
        this.l14(),
        this.l15(),
        this.l17(),
        this.l18(),
        this.l19(),
        this.l20(),
        this.l21(),
        this.l33(),
        this.l35()
    ]
}
