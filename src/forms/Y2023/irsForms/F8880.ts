import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8880Data, FilingStatus } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

export default class F8880 extends F1040Attachment {
    tag: FormTag = 'f8880'
    sequenceIndex = 68
    data: Form8880Data

    constructor(f1040: F1040, data?: Form8880Data) {
        super(f1040)
        // Use data passed or pull from info
        this.data = data ?? this.f1040.info.form8880 ?? {
            primaryTraditionalIRA: 0,
            primaryRothIRA: 0,
            primaryEmployerPlan: 0,
            primaryABLEAccount: 0,
            primaryDistributions: 0
        }
    }

    // Column (a) = Primary, Column (b) = Spouse
    l1a = (): number => this.data.primaryTraditionalIRA + this.data.primaryRothIRA
    l1b = (): number => (this.data.spouseTraditionalIRA ?? 0) + (this.data.spouseRothIRA ?? 0)

    l2a = (): number => this.data.primaryEmployerPlan
    l2b = (): number => (this.data.spouseEmployerPlan ?? 0)

    l3a = (): number => this.data.primaryABLEAccount
    l3b = (): number => (this.data.spouseABLEAccount ?? 0)

    l4a = (): number => sumFields([this.l1a(), this.l2a(), this.l3a()])
    l4b = (): number => sumFields([this.l1b(), this.l2b(), this.l3b()])

    l5a = (): number => this.data.primaryDistributions
    l5b = (): number => (this.data.spouseDistributions ?? 0)

    l6a = (): number => Math.max(0, this.l4a() - this.l5a())
    l6b = (): number => Math.max(0, this.l4b() - this.l5b())

    l7a = (): number => Math.min(2000, this.l6a())
    l7b = (): number => Math.min(2000, this.l6b())

    l8 = (): number => sumFields([this.l7a(), this.l7b()])

    l9 = (): number => this.f1040.l11() // AGI

    l10 = (): number => {
        const agi = this.l9()
        const fs = this.f1040.info.taxPayer.filingStatus

        if (fs === FilingStatus.MFJ) {
            if (agi <= 43500) return 0.5
            if (agi <= 47500) return 0.2
            if (agi <= 73000) return 0.1
            return 0.0
        } else if (fs === FilingStatus.HOH) {
            if (agi <= 32625) return 0.5
            if (agi <= 35625) return 0.2
            if (agi <= 54750) return 0.1
            return 0.0
        } else {
            // Single, MFS, QSS
            if (agi <= 21750) return 0.5
            if (agi <= 23750) return 0.2
            if (agi <= 36500) return 0.1
            return 0.0
        }
    }

    l11 = (): number => this.l8() * this.l10()

    l12 = (): number => {
        // simplified tax liability limit
        return this.f1040.l16() ?? 0
    }

    l13 = (): number => Math.min(this.l11(), this.l12())

    fields = (): Field[] => [
        this.f1040.namesString(),
        this.f1040.info.taxPayer.primaryPerson.ssid,
        this.l1a(),
        this.l1b(),
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
        this.l7a(),
        this.l7b(),
        this.l8(),
        this.l9(),
        this.l10(),
        this.l11(),
        this.l12(),
        this.l13()
    ]
}
