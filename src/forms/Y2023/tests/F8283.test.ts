import F8283 from '../irsForms/F8283'
import ScheduleA from '../irsForms/ScheduleA'
import F1040 from '../irsForms/F1040'
import { Form8283Data, ItemizedDeductions } from 'ustaxes/core/data'

describe('F8283 and Schedule A Integration', () => {
    it('calculates the total noncash contributions correctly across F8283 and Schedule A', () => {
        const f8283Data: Form8283Data = {
            contributions: [
                {
                    doneeOrganization: 'Goodwill',
                    doneeAddress: '123 Charity St',
                    description: 'Used Clothing',
                    dateOfContribution: '05/15/2023',
                    dateAcquired: '01/01/2020',
                    howAcquired: 'Purchase',
                    donorCost: 1000,
                    fairMarketValue: 600,
                    methodOfFMV: 'Thrift Shop Value'
                },
                {
                    doneeOrganization: 'Salvation Army',
                    doneeAddress: '456 Donation Blvd',
                    description: 'Furniture',
                    dateOfContribution: '10/20/2023',
                    dateAcquired: '06/15/2018',
                    howAcquired: 'Purchase',
                    donorCost: 2000,
                    fairMarketValue: 800,
                    methodOfFMV: 'Thrift Shop Value'
                }
            ]
        }

        const itemizedDeductions: ItemizedDeductions = {
            medicalAndDental: 0,
            stateAndLocalTaxes: 0,
            isSalesTax: false,
            stateAndLocalRealEstateTaxes: 0,
            stateAndLocalPropertyTaxes: 0,
            interest8a: 0,
            interest8b: 0,
            interest8c: 0,
            interest8d: 0,
            investmentInterest: 0,
            charityCashCheck: 0,
            charityOther: 150 // $150 in <$500 noncash contributions
        }

        const mockF1040 = {
            namesString: () => 'John Doe',
            info: {
                taxPayer: {
                    primaryPerson: {
                        ssid: '123-45-6789'
                    }
                },
                form8283: f8283Data,
                itemizedDeductions
            },
            l11: () => 0
        } as unknown as F1040

        // Assign f8283 to the F1040 object as it would be normally
        const f8283 = new F8283(mockF1040, f8283Data)
        mockF1040.f8283 = f8283

        const scheduleA = new ScheduleA(mockF1040)

        // F8283 should total its own items: 600 + 800 = 1400
        expect(f8283.totalContributions()).toBe(1400)

        // Schedule A should pull $150 from charityOther + $1400 from f8283 = $1550
        expect(scheduleA.l12()).toBe(1550)
    })
})
