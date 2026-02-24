import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8801Data } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'

export default class F8801 extends F1040Attachment {
    tag: FormTag = 'f8801'
    sequenceIndex = 66
    data: Form8801Data

    constructor(f1040: F1040, data?: Form8801Data) {
        super(f1040)
        // Use data passed or pull from info
        this.data = data ?? this.f1040.info.form8801 ?? { priorYearAMTI: 0, exclusionItems: 0, priorYearRegularTaxMinusCredits: 0 }
    }

    // Part I: Net Minimum Tax on Exclusion Items
    l1 = (): number => this.data.priorYearAMTI
    l2 = (): number => this.data.exclusionItems
    l3 = (): number => this.data.mtcNOLDeduction ?? 0

    l4 = (): number => Math.max(0, this.l1() + this.l2() + this.l3())

    // Fast forward simplified Parts I & II calculation
    // Usually this scales down AMT based on prior year regular tax.
    // For the sake of standard integration:
    l10 = (): number => this.data.priorYearRegularTaxMinusCredits

    // Credit carryforward from prior year
    l26 = (): number => this.data.priorYearAMTCreditCarryforward ?? 0

    // Total Credit allowed this year
    // In reality limited by current year tax minus tentative minimum tax
    // We approximate the allowable credit
    credit = (): number => {
        // Current year regular tax
        const currentTax = this.f1040.l16() ?? 0
        const amt = this.f1040.f6251.l11() ?? 0 // Tentative Minimum Tax
        const limit = Math.max(0, currentTax - amt)

        return Math.min(this.l26(), limit)
    }

    fields = (): Field[] => [
        this.f1040.namesString(),
        this.f1040.info.taxPayer.primaryPerson.ssid,
        this.l1(),
        this.l2(),
        this.l3(),
        this.l4(),
        this.l10(),
        this.l26(),
        this.credit()
    ]
}
