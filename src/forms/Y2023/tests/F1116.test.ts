import F1116 from '../irsForms/F1116'
import F1040 from '../irsForms/F1040'
import { Form1116Data, ForeignIncomeCategory } from 'ustaxes/core/data'

describe('F1116', () => {
    it('calculates Foreign Tax Credit correctly', () => {
        const data: Form1116Data = {
            category: ForeignIncomeCategory.PassiveCategory,
            electionToClaimCredit: true,
            personRole: 'PRIMARY' as any,
            foreignIncomes: [
                {
                    country: 'Canada',
                    grossIncome: 5000,
                    definitelyAllocableDeductions: 500,
                    apportionedShareDeductions: 0,
                    foreignTaxesPaidOrAccrued: 750,
                    taxType: 'paid'
                }
            ]
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    primaryPerson: {
                        ssid: '123-45-6789'
                    }
                }
            },
            l15: () => 100000, // Taxable income from all sources
            l16: () => 15000   // Total US tax
        } as unknown as F1040

        const f1116 = new F1116(mockF1040, data)

        expect(f1116.l1a()).toBe(5000)
        expect(f1116.l2()).toBe(500)
        expect(f1116.l6()).toBe(500)
        expect(f1116.l7()).toBe(4500)
        expect(f1116.l8()).toBe(750)

        expect(f1116.l14()).toBe(750)
        expect(f1116.l15()).toBe(4500)
        expect(f1116.l17()).toBe(100000)
        expect(f1116.l18()).toBe(0.045)
        expect(f1116.l19()).toBe(15000)
        expect(f1116.l20()).toBe(675) // 15000 * 0.045
        expect(f1116.l21()).toBe(675) // min(750, 675)

        expect(f1116.l35()).toBe(675)
    })
})
