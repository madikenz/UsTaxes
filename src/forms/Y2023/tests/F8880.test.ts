import F8880 from '../irsForms/F8880'
import F1040 from '../irsForms/F1040'
import { Form8880Data, FilingStatus, PersonRole } from 'ustaxes/core/data'

describe('F8880', () => {
    it('calculates the retirement savings contributions credit correctly', () => {
        const data: Form8880Data = {
            primaryTraditionalIRA: 1500,
            primaryRothIRA: 500,
            primaryEmployerPlan: 1000,
            primaryABLEAccount: 0,
            primaryDistributions: 500,
            // Spouse
            spouseTraditionalIRA: 0,
            spouseRothIRA: 0,
            spouseEmployerPlan: 0,
            spouseABLEAccount: 0,
            spouseDistributions: 0
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    filingStatus: FilingStatus.S,
                    primaryPerson: {
                        ssid: '123-45-6789'
                    }
                },
                form8880: data
            },
            l11: () => 22000, // AGI = $22k. For single, 22000 is between 21750 and 23750, so ratio is 0.2
            l16: () => 5000 // Total tax limit
        } as unknown as F1040

        const f8880 = new F8880(mockF1040, data)

        // Total primary contributions = 1500 + 500 + 1000 = 3000
        expect(f8880.l4a()).toBe(3000)

        // Net contributions after 500 distribution = 2500
        expect(f8880.l6a()).toBe(2500)

        // Max allowable is 2000
        expect(f8880.l7a()).toBe(2000)

        // Ratio = 0.2
        expect(f8880.l10()).toBe(0.2)

        // Credit = 2000 * 0.2 = 400
        expect(f8880.l11()).toBe(400)
        expect(f8880.l13()).toBe(400)
    })
})
