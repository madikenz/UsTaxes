import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { ScheduleFData } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

export default class ScheduleF extends F1040Attachment {
    tag: FormTag = 'f1040sf' // Note: This tag assumes we have an IRS form PDF named 'f1040sf.pdf'
    sequenceIndex = 11 // Arbitrary sequence index matching IRS form sequence
    data: ScheduleFData

    constructor(f1040: F1040, data: ScheduleFData) {
        super(f1040)
        this.data = data
    }

    // Part I Farm Income - Cash Method
    l1a = (): number => this.data.salesLivestock
    l1b = (): number => this.data.costLivestock
    l1c = (): number => {
        const a = this.l1a()
        const b = this.l1b()
        return a >= b ? a - b : 0
    }
    l2 = (): number => 0 // Simplified — included in l1a
    l3a = (): number => this.data.cooperativeDistributions
    l3b = (): number | undefined => undefined // taxable portion not modeled separately
    l4a = (): number => this.data.agriculturePayments
    l4b = (): number | undefined => undefined // taxable portion not modeled separately
    l5a = (): number => this.data.cccLoans
    l5b = (): number | undefined => undefined // taxable amt not modeled individually for now
    l5c = (): boolean => false
    l6a = (): number => this.data.cropInsurance
    l6b = (): number | undefined => undefined
    l6c = (): boolean => false
    l6d = (): number | undefined => undefined
    l7 = (): number => this.data.customHireIncome
    l8 = (): number => this.data.otherFarmIncome

    l9 = (): number => sumFields([
        this.l1c(), this.l2(), this.l3b(), this.l4b(), this.l5a(), this.l5b(),
        this.l6b(), this.l6d(), this.l7(), this.l8()
    ])

    // Part II Farm Expenses - Cash and Accrual Method
    l10 = (): number => this.data.carAndTruck
    l11 = (): number => this.data.chemicals
    l12 = (): number => this.data.conservation
    l13 = (): number => this.data.customHire
    l14 = (): number => this.data.depreciation
    l15 = (): number => this.data.employeeBenefits
    l16 = (): number => this.data.feed
    l17 = (): number => this.data.fertilizers
    l18 = (): number => this.data.freight
    l19 = (): number => this.data.fuel
    l20 = (): number => this.data.insurance
    l21a = (): number => this.data.interestMortgage
    l21b = (): number => this.data.interestOther
    l22 = (): number => this.data.labor
    l23 = (): number => this.data.pensionProfitSharing
    l24a = (): number => this.data.rentVehicles
    l24b = (): number => this.data.rentOther
    l25 = (): number => this.data.repairs
    l26 = (): number => this.data.seeds
    l27 = (): number => this.data.storage
    l28 = (): number => this.data.supplies
    l29 = (): number => this.data.taxes
    l30 = (): number => this.data.utilities
    l31 = (): number => this.data.veterinary
    l32a = (): number => this.data.otherExpenses

    l33 = (): number => sumFields([
        this.l10(), this.l11(), this.l12(), this.l13(), this.l14(), this.l15(),
        this.l16(), this.l17(), this.l18(), this.l19(), this.l20(), this.l21a(),
        this.l21b(), this.l22(), this.l23(), this.l24a(), this.l24b(), this.l25(),
        this.l26(), this.l27(), this.l28(), this.l29(), this.l30(), this.l31(),
        this.l32a()
    ])

    // Net farm profit or loss
    l34 = (): number => {
        const grossIncome = this.l9()
        const totalExpenses = this.l33()
        return grossIncome - totalExpenses
    }

    fields = (): Field[] => [
        this.f1040.namesString(),
        this.f1040.info.taxPayer.primaryPerson.ssid,
        this.data.farmName,
        this.data.ein ?? '',
        this.data.accountingMethod === 'Cash',
        this.data.accountingMethod === 'Accrual',
        false, // didMateriallyParticipate - not in new interface
        false,
        this.l1a(),
        this.l1b(),
        this.l1c(),
        this.l2(),
        this.l3a(),
        this.l3b(),
        this.l4a(),
        this.l4b(),
        this.l5a(),
        this.l5b(),
        this.l6a(),
        this.l6b(),
        this.l7(),
        this.l8(),
        this.l9(),
        this.l10(),
        this.l11(),
        this.l12(),
        this.l13(),
        this.l14(),
        this.l15(),
        this.l16(),
        this.l17(),
        this.l18(),
        this.l19(),
        this.l20(),
        this.l21a(),
        this.l21b(),
        this.l22(),
        this.l23(),
        this.l24a(),
        this.l24b(),
        this.l25(),
        this.l26(),
        this.l27(),
        this.l28(),
        this.l29(),
        this.l30(),
        this.l31(),
        this.l32a(),
        this.l33(),
        this.l34()
    ]
}
