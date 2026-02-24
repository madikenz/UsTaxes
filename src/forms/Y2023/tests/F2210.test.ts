import F2210 from '../irsForms/F2210'
import F1040 from '../irsForms/F1040'
import { Form2210Data } from 'ustaxes/core/data'

describe('F2210', () => {
    it('calculates the underpayment penalty correctly', () => {
        const data: Form2210Data = {
            priorYearTax: 12000,
            estimatedPayments: [
                { datePaid: '04/15/2023', amount: 1000 },
                { datePaid: '06/15/2023', amount: 1000 },
                { datePaid: '09/15/2023', amount: 1000 },
                { datePaid: '01/15/2024', amount: 1000 }
            ],
            withholding: 5000
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    primaryPerson: {
                        ssid: '123-45-6789'
                    }
                },
                form2210: data
            },
            l22: () => 15000,   // Total tax
            schedule2: { l21: () => 0 },
            l27: () => 0,       // Refundable credits
            l28: () => 0,
            l29: () => 0,
            schedule3: { l14: () => 0 },
            l25d: () => 4000    // Base withholding
        } as unknown as F1040

        const f2210 = new F2210(mockF1040, data)

        // Part I
        expect(f2210.l1()).toBe(15000)
        expect(f2210.l2()).toBe(0)
        expect(f2210.l3()).toBe(0)
        expect(f2210.l4()).toBe(15000)
        expect(f2210.l5()).toBe(13500) // 15000 * 0.9
        expect(f2210.l6()).toBe(5000)  // max(4000, 5000)
        expect(f2210.l7()).toBe(10000) // 15000 - 5000 -> greater than 1000 so penalty applies
        expect(f2210.isPenaltyOwed()).toBe(true)
        expect(f2210.l8()).toBe(12000)
        expect(f2210.l9()).toBe(12000) // min(13500, 12000)

        // Part III
        expect(f2210.l10()).toBe(5000)
        expect(f2210.l11()).toBe(4000)
        expect(f2210.l12()).toBe(9000)
        expect(f2210.l13()).toBe(3000) // 12000 - 9000
        expect(f2210.l14()).toBe(161)  // floor(3000 * 0.05373)
    })
})
