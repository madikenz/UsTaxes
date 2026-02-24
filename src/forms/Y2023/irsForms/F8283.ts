import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8283Data } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'

export default class F8283 extends F1040Attachment {
    tag: FormTag = 'f8283'
    sequenceIndex = 55
    data: Form8283Data

    constructor(f1040: F1040, data?: Form8283Data) {
        super(f1040)
        // Use data passed or pull from info
        this.data = data ?? this.f1040.info.form8283 ?? { contributions: [] }
    }

    // Calculate the total noncash contributions from Section A (donated property of $5,000 or less per item)
    // And Section B (over $5,000)
    totalContributions = (): number => {
        return this.data.contributions.reduce((acc, contrib) => acc + contrib.fairMarketValue, 0)
    }

    fields = (): Field[] => {
        const fieldsArr = [
            this.f1040.namesString(),
            this.f1040.info.taxPayer.primaryPerson.ssid
        ]

        // Form 8283 has a table in Part I for Section A
        // We'll fill up to 5 entries
        for (let i = 0; i < 5; i++) {
            const contrib = this.data.contributions[i]
            if (contrib) {
                fieldsArr.push(
                    contrib.doneeOrganization, // Name and address
                    contrib.description,
                    contrib.dateOfContribution,
                    contrib.dateAcquired,
                    contrib.howAcquired,
                    contrib.donorCost.toString(),
                    contrib.fairMarketValue.toString(),
                    contrib.methodOfFMV
                )
            } else {
                // Pad empty fields for the row (8 fields per row)
                fieldsArr.push('', '', '', '', '', '', '', '')
            }
        }

        return fieldsArr
    }
}
