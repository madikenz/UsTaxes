import F8606 from '../irsForms/F8606'
import F1040 from '../irsForms/F1040'
import { Form8606Data, PersonRole } from 'ustaxes/core/data'

describe('F8606', () => {
    it('calculates the taxable amount of nondeductible IRA distributions correctly', () => {
        const data: Form8606Data = {
            personRole: PersonRole.PRIMARY,
            nondeductibleContributions: 1000,
            totalBasisPriorYears: 4000,
            amountConverted: 0,
            distributionsFromTraditional: 10000,
            valueOfAllTraditionalIRAs: 40000,
            rothDistributions: 0
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    primaryPerson: {
                        ssid: '123-45-6789',
                        firstName: 'John',
                        lastName: 'Doe'
                    }
                },
                form8606s: [data]
            }
        } as unknown as F1040

        const f8606 = new F8606(mockF1040, data)

        // Total nondeductible basis = 1000 + 4000 = 5000
        expect(f8606.l3()).toBe(5000)
        expect(f8606.l5()).toBe(5000)

        // Total value of IRAs including distributions = 40000 + 10000 = 50000
        expect(f8606.l9()).toBe(50000)

        // Nontaxable ratio = 5000 / 50000 = 0.1
        expect(f8606.l10()).toBe(0.1)

        // Nontaxable portion of distribution = 10000 * 0.1 = 1000
        expect(f8606.l12()).toBe(1000)

        // Taxable portion of distribution = 10000 - 1000 = 9000
        expect(f8606.l15c()).toBe(9000)
        expect(f8606.totalTaxable()).toBe(9000)
    })
})
