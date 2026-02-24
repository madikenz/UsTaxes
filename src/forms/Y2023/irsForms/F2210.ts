import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form2210Data } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

export default class F2210 extends F1040Attachment {
    tag: FormTag = 'f2210'
    sequenceIndex = 45
    data: Form2210Data

    constructor(f1040: F1040, data?: Form2210Data) {
        super(f1040)
        // Use data passed or pull from info
        this.data = data ?? this.f1040.info.form2210 ?? { priorYearTax: 0, estimatedPayments: [], withholding: 0 }
    }

    // Part I: Required Annual Payment

    // Total tax (Form 1040, line 22)
    l1 = (): number => this.f1040.l22()

    // Other taxes (Schedule 2, line 21, minus line 12 and some others)
    // For simplicity, we just use total other taxes from Schedule 2 line 21
    l2 = (): number => this.f1040.schedule2?.l21() ?? 0

    // Refundable credits
    l3 = (): number => sumFields([
        this.f1040.l27(), // EIC
        this.f1040.l28(), // Additional child tax credit
        this.f1040.l29(), // AOC
        this.f1040.schedule3?.l14() // other refundable credits
    ])

    l4 = (): number => Math.max(0, sumFields([this.l1(), this.l2()]) - this.l3())

    l5 = (): number => this.l4() * 0.90

    l6 = (): number => {
        // Withholding taxes: W-2 + 1099 + others (usually F1040 l25d)
        const baseWithholding = this.f1040.l25d()
        return Math.max(baseWithholding, this.data.withholding ?? 0)
    }

    l7 = (): number => Math.max(0, this.l4() - this.l6())

    // Is penalty owed?
    isPenaltyOwed = (): boolean => {
        if (this.l7() < 1000) {
            return false
        }
        return true
    }

    l8 = (): number => this.data.priorYearTax ?? 0

    l9 = (): number => Math.min(this.l5(), this.l8())

    // Part III: Short Method
    l10 = (): number => this.l6()

    l11 = (): number => {
        return this.data.estimatedPayments.reduce((acc, p) => acc + p.amount, 0)
    }

    l12 = (): number => sumFields([this.l10(), this.l11()])

    l13 = (): number => sumFields([this.l9(), this.l12() * -1])

    l14 = (): number => {
        if (this.l13() <= 0) return 0
        // simplified penalty calculation for short method
        // In 2023 this is roughly equivalent to l13 * 0.05373 or similar IRS factor
        return Math.floor(this.l13() * 0.05373)
    }

    fields = (): Field[] => [
        this.f1040.namesString(),
        this.f1040.info.taxPayer.primaryPerson.ssid,
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
        this.l14()
    ]
}
