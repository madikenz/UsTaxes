import F4562 from '../irsForms/F4562'
import F1040 from '../irsForms/F1040'
import { Form4562Data } from 'ustaxes/core/data'

describe('F4562', () => {
    it('calculates Section 179 and MACRS depreciation correctly', () => {
        const data: Form4562Data = {
            businessOrActivityToWhichThisFormRelates: 'Consulting',
            totalCostOfSection179Property: 100000,
            section179Property: [
                {
                    description: 'Computer Server',
                    cost: 100000,
                    electedCost: 100000
                }
            ],
            macrsProperty: [
                {
                    classification: '5-year',
                    monthAndYearPlacedInService: '06/2023',
                    basisForDepreciation: 50000,
                    recoveryPeriod: '5',
                    convention: 'HY',
                    method: '200DB',
                    depreciationDeduction: 10000 // 20%
                }
            ],
            amortizationCosts: [
                {
                    description: 'Startup Costs',
                    dateBegan: '01/2023',
                    amortizableAmount: 5000,
                    codeSection: '195',
                    amortizationPeriodOrPercentage: '15',
                    amortizationForThisYear: 333
                }
            ],
            listedProperty: 1500
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    filingStatus: 'S',
                    primaryPerson: {
                        ssid: '123-45-6789'
                    }
                }
            }
        } as unknown as F1040

        const f4562 = new F4562(mockF1040, data)

        // Part I
        expect(f4562.l1()).toBe(1160000)
        expect(f4562.l2()).toBe(100000)
        expect(f4562.l4()).toBe(1160000)
        expect(f4562.l5()).toBe(1160000)
        expect(f4562.l8()).toBe(100000)
        expect(f4562.l9()).toBe(100000) // min(1160000, 100000)
        expect(f4562.l12()).toBe(100000)
        expect(f4562.l13()).toBe(0)

        // Part III
        expect(f4562.l19Total()).toBe(10000)

        // Part IV
        expect(f4562.l21()).toBe(1500)
        expect(f4562.l22()).toBe(111500) // 100000 + 10000 + 1500

        // Part VI
        expect(f4562.l42Total()).toBe(333)
        expect(f4562.l44()).toBe(333)
    })

    it('handles MFS split correctly for l5', () => {
        const data: Form4562Data = {
            businessOrActivityToWhichThisFormRelates: 'Consulting',
            totalCostOfSection179Property: 100000
        }

        const mockF1040 = {
            info: {
                taxPayer: {
                    filingStatus: 'MFS', // Trigger split limit
                }
            }
        } as unknown as F1040

        const f4562 = new F4562(mockF1040, data)

        expect(f4562.l5()).toBe(580000) // 1160000 / 2
    })
})
