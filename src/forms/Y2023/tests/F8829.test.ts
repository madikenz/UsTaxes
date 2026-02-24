import F8829 from '../irsForms/F8829'
import F1040 from '../irsForms/F1040'
import { Form8829Data } from 'ustaxes/core/data'

describe('F8829', () => {
    it('calculates allowable deduction for business use of home', () => {
        const data: Form8829Data = {
            totalAreaOfHome: 2000,
            businessArea: 400,
            directMortgageInterest: 0,
            directRealEstateTaxes: 0,
            directInsurance: 0,
            directRepairs: 500,
            directUtilities: 0,
            directOther: 100,
            indirectMortgageInterest: 10000,
            indirectRealEstateTaxes: 4000,
            indirectInsurance: 1000,
            indirectRepairs: 2000,
            indirectUtilities: 3000,
            indirectOther: 0,
            costOrBasisOfHome: 250000,
            costOfLand: 50000
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    primaryPerson: {
                        ssid: '123-45-6789'
                    }
                }
            }
        } as unknown as F1040

        const f8829 = new F8829(mockF1040, data)

        expect(f8829.l3()).toBe(0.2)
        expect(f8829.l7()).toBe(0.2)
        expect(f8829.l12b()).toBe(14000)
        expect(f8829.l13()).toBe(2800)
        expect(f8829.l14()).toBe(2800)
        expect(f8829.l22a()).toBe(600)
        expect(f8829.l22b()).toBe(6000)
        expect(f8829.l23()).toBe(1200)
        expect(f8829.l24()).toBe(1800)
        expect(f8829.l39()).toBe(200000)
        expect(f8829.l40()).toBe(40000)
        expect(f8829.l42()).toBeCloseTo(1025.6)
        expect(f8829.l35()).toBeCloseTo(5625.6)
    })
})
