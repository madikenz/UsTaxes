import F8801 from '../irsForms/F8801'
import F1040 from '../irsForms/F1040'
import { Form8801Data } from 'ustaxes/core/data'

describe('F8801', () => {
    it('calculates the prior year minimum tax credit correctly', () => {
        const data: Form8801Data = {
            priorYearAMTI: 100000,
            exclusionItems: 5000,
            mtcNOLDeduction: 0,
            priorYearRegularTaxMinusCredits: 12000,
            priorYearAMTCreditCarryforward: 3000
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    primaryPerson: {
                        ssid: '123-45-6789'
                    }
                },
                form8801: data
            },
            l16: () => 15000, // Total current year tax
            f6251: {
                l11: () => 10000 // Tentative minimum tax
            }
        } as unknown as F1040

        const f8801 = new F8801(mockF1040, data)

        expect(f8801.l1()).toBe(100000)
        expect(f8801.l2()).toBe(5000)
        expect(f8801.l4()).toBe(105000)
        expect(f8801.l10()).toBe(12000)
        expect(f8801.l26()).toBe(3000)

        // limit is current tax (15000) - tentative minimum tax (10000) = 5000
        // so allowable credit is min(carryforward=3000, limit=5000) = 3000
        expect(f8801.credit()).toBe(3000)
    })
})
