import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { ScheduleFData } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Schedule F — Profit or Loss from Farming
 *
 * Reports income and expenses from farming operations.
 * Net profit/loss flows to Schedule 1 line 6.
 *
 * Reference: 2024 Schedule F instructions (46 Excel formulas)
 */
export default class ScheduleF extends F1040Attachment {
  tag: FormTag = 'f1040sf'
  sequenceIndex = 15

  readonly data: ScheduleFData

  constructor(f1040: F1040, data: ScheduleFData) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.scheduleFData !== undefined &&
    this.f1040.info.scheduleFData.length > 0

  // --- Part I: Farm Income (Cash Method) ---

  // Line 1a: Sales of livestock bought for resale
  l1a = (): number => this.data.salesLivestock

  // Line 1b: Cost of livestock bought for resale
  l1b = (): number => this.data.costLivestock

  // Line 1c: Subtract line 1b from line 1a
  l1c = (): number => this.l1a() - this.l1b()

  // Line 2: Sales of livestock, produce, grains, etc. raised
  l2 = (): number => 0 // Simplified — included in l1a

  // Line 3a: Cooperative distributions
  l3a = (): number => this.data.cooperativeDistributions

  // Line 4a: Agricultural program payments
  l4a = (): number => this.data.agriculturePayments

  // Line 5a: CCC loans
  l5a = (): number => this.data.cccLoans

  // Line 6: Crop insurance proceeds
  l6 = (): number => this.data.cropInsurance

  // Line 7: Custom hire (machine work) income
  l7 = (): number => this.data.customHireIncome ?? 0

  // Line 8: Other farm income
  l8 = (): number => this.data.otherFarmIncome

  // Line 9: Gross farm income
  l9 = (): number =>
    sumFields([
      this.l1c(),
      this.l2(),
      this.l3a(),
      this.l4a(),
      this.l5a(),
      this.l6(),
      this.l7(),
      this.l8()
    ])

  // --- Part II: Farm Expenses ---

  l10 = (): number => this.data.carAndTruck
  l11 = (): number => this.data.chemicals ?? 0
  l12 = (): number => this.data.conservation
  l13 = (): number => this.data.customHire
  l14 = (): number => this.data.depreciation ?? 0
  l15 = (): number => this.data.employeeBenefits
  l16 = (): number => this.data.feed
  l17 = (): number => this.data.fertilizers
  l18 = (): number => this.data.freight
  l19 = (): number => this.data.fuel
  l20 = (): number => this.data.insurance
  l21a = (): number => this.data.interestMortgage ?? 0
  l21b = (): number => this.data.interestOther ?? 0
  l22 = (): number => this.data.labor
  l23 = (): number => this.data.pensionProfitSharing
  l24a = (): number => this.data.rentVehicles
  l24b = (): number => this.data.rentOther
  l25 = (): number => this.data.repairs
  l26 = (): number => this.data.seeds
  l27 = (): number => this.data.storage
  l28 = (): number => this.data.supplies ?? 0
  l29 = (): number => this.data.taxes ?? 0
  l30 = (): number => this.data.utilities ?? 0
  l31 = (): number => this.data.veterinary
  l32 = (): number => this.data.otherExpenses ?? 0

  // Line 33: Total expenses
  l33 = (): number =>
    sumFields([
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
      this.l32()
    ])

  // Line 34: Net farm profit or (loss)
  l34 = (): number => this.l9() - this.l33()

  // Net profit/loss for Schedule 1
  netProfitOrLoss = (): number => this.l34()

  fields = (): Field[] => [
    // Page 1 — 71 fields (indices 0-70)
    this.f1040.namesString(),                           // 0: f1_1 name
    this.f1040.info.taxPayer.primaryPerson.ssid,        // 1: f1_2 SSN
    this.data.farmName,                                 // 2: f1_3 principal crop/activity (A)
    this.data.ein ?? '',                                // 3: f1_4 EIN (B)
    this.data.accountingMethod === 'Cash',              // 4: c1_1[0] Cash method
    this.data.accountingMethod === 'Accrual',           // 5: c1_1[1] Accrual method
    undefined,                                          // 6: f1_5 (Line D employer ID)
    false,                                              // 7: c1_2[0] (Line E/F checkbox)
    false,                                              // 8: c1_2[1] (Line E/F checkbox)
    false,                                              // 9: c1_3[0] (checkbox)
    false,                                              // 10: c1_3[1] (checkbox)
    false,                                              // 11: c1_4[0] (checkbox)
    false,                                              // 12: c1_4[1] (checkbox)
    // Part I: Income
    this.l1a(),                                         // 13: f1_6 line 1a
    this.l1b(),                                         // 14: f1_7 line 1b
    this.l1c(),                                         // 15: f1_8 line 1c
    this.l2(),                                          // 16: f1_9 line 2
    this.l3a(),                                         // 17: f1_10 line 3a
    undefined,                                          // 18: f1_11 line 3b
    this.l4a(),                                         // 19: f1_12 line 4a
    undefined,                                          // 20: f1_13 line 4b
    this.l5a(),                                         // 21: f1_14 line 5a
    undefined,                                          // 22: f1_15 line 5b/5c
    this.l6(),                                          // 23: f1_16 line 6a
    undefined,                                          // 24: f1_17 line 6b amount
    undefined,                                          // 25: f1_18 line 6c/6d
    false,                                              // 26: c1_5 line 6b checkbox
    this.l7(),                                          // 27: f1_19 line 7
    this.l8(),                                          // 28: f1_20 line 8
    this.l9(),                                          // 29: f1_21 line 9
    undefined,                                          // 30: f1_22 (reserved)
    // Part II: Expenses (lines 10-32)
    this.l10(),                                         // 31: f1_23 line 10
    this.l11(),                                         // 32: f1_24 line 11
    this.l12(),                                         // 33: f1_25 line 12
    this.l13(),                                         // 34: f1_26 line 13
    this.l14(),                                         // 35: f1_27 line 14
    this.l15(),                                         // 36: f1_28 line 15
    this.l16(),                                         // 37: f1_29 line 16
    this.l17(),                                         // 38: f1_30 line 17
    this.l18(),                                         // 39: f1_31 line 18
    this.l19(),                                         // 40: f1_32 line 19
    this.l20(),                                         // 41: f1_33 line 20
    this.l21a(),                                        // 42: f1_34 line 21a
    this.l21b(),                                        // 43: f1_35 line 21b
    this.l22(),                                         // 44: f1_36 line 22
    this.l23(),                                         // 45: f1_37 line 23
    this.l24a(),                                        // 46: f1_38 line 24a
    this.l24b(),                                        // 47: f1_39 line 24b
    this.l25(),                                         // 48: f1_40 line 25
    this.l26(),                                         // 49: f1_41 line 26
    this.l27(),                                         // 50: f1_42 line 27
    this.l28(),                                         // 51: f1_43 line 28
    this.l29(),                                         // 52: f1_44 line 29
    this.l30(),                                         // 53: f1_45 line 30
    this.l31(),                                         // 54: f1_46 line 31
    this.l32(),                                         // 55: f1_47 line 32 other expenses
    this.l33(),                                         // 56: f1_48 line 33 total expenses
    this.l34(),                                         // 57: f1_49 line 34 net profit/loss
    undefined,                                          // 58: f1_50
    undefined,                                          // 59: f1_51
    undefined,                                          // 60: f1_52
    undefined,                                          // 61: f1_53
    undefined,                                          // 62: f1_54
    undefined,                                          // 63: f1_55
    undefined,                                          // 64: f1_56
    undefined,                                          // 65: f1_57
    undefined,                                          // 66: f1_58
    undefined,                                          // 67: f1_59
    undefined,                                          // 68: f1_60
    false,                                              // 69: c1_6[0] (line 36a checkbox)
    false,                                              // 70: c1_6[1] (line 36b checkbox)
    // Page 2 — 18 fields (indices 71-88)
    undefined,                                          // 71: f2_1 line 37
    undefined,                                          // 72: f2_2 line 38a
    undefined,                                          // 73: f2_3 line 38b
    undefined,                                          // 74: f2_4 line 39a
    undefined,                                          // 75: f2_5 line 39b
    undefined,                                          // 76: f2_6 line 40a
    undefined,                                          // 77: f2_7 line 40b
    undefined,                                          // 78: f2_8 line 41
    undefined,                                          // 79: f2_9 line 42
    undefined,                                          // 80: f2_10 line 43
    undefined,                                          // 81: f2_11 line 44
    undefined,                                          // 82: f2_12 line 45a
    undefined,                                          // 83: f2_13 line 45b
    undefined,                                          // 84: f2_14 line 46
    undefined,                                          // 85: f2_15
    undefined,                                          // 86: f2_16
    undefined,                                          // 87: f2_17
    undefined                                           // 88: f2_18
  ]

  copies = (): ScheduleF[] => {
    const list = this.f1040._scheduleFList ?? []
    return list.slice(1)
  }
}
