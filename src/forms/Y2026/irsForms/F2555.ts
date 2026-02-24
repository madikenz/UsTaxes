import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form2555Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 2555 — Foreign Earned Income Exclusion
 *
 * Used by US citizens or resident aliens living abroad to exclude
 * foreign earned income from US taxation. The taxpayer must meet
 * either the bona fide residence test or the physical presence test.
 *
 * Part IV:  Foreign Earned Income
 * Part V:   Foreign Earned Income Exclusion (max $130,000 for 2025)
 * Part VI:  Housing Exclusion / Deduction
 * Part VIII: Summary — total exclusion flows to Schedule 1 line 8d
 *
 * Impacts: EIC, 1040 instructions L27 step 1 question 4
 *
 * Reference: 2025 Form 2555 instructions
 */

// 2025 maximum foreign earned income exclusion
const MAX_EXCLUSION_2025 = 130000

// Housing: 30% of max exclusion cap
const HOUSING_CAP_PERCENT = 0.3

// Housing: base amount is 16% of max exclusion
const HOUSING_BASE_PERCENT = 0.16

export default class F2555 extends F1040Attachment {
  tag: FormTag = 'f2555'
  sequenceIndex = 34

  readonly data: Form2555Data

  constructor(f1040: F1040, data: Form2555Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form2555s !== undefined &&
    this.f1040.info.form2555s.length > 0

  // --- Part I: General Information ---

  // Line 3: Foreign earned income (also used by SDCapitalGainWorksheet)
  l3 = (): number | undefined => this.data.foreignEarnedIncome

  // --- Part IV: Foreign Earned Income ---

  // Line 19: Wages, salaries, bonuses, etc. earned abroad
  l19 = (): number => this.data.foreignEarnedIncome

  // Line 21: Total foreign earned income (simplified: same as l19)
  l21 = (): number => this.l19()

  // --- Part V: Foreign Earned Income Exclusion ---

  // Line 27: Maximum foreign earned income exclusion for 2024
  l27 = (): number => MAX_EXCLUSION_2025

  /**
   * Line 28: Prorated exclusion based on qualifying period.
   *
   * Physical presence test: prorate by days present / 365
   * Bona fide residence test: full year = full exclusion
   */
  l28 = (): number => {
    if (this.data.qualifyingTest === 'physicalPresence') {
      const days = this.data.physicalPresenceDays ?? 0
      // Prorate: days in qualifying period / 365
      const ratio = Math.min(days / 365, 1)
      return Math.round(this.l27() * ratio)
    }
    // Bona fide residence test — full year qualifies for full exclusion
    return this.l27()
  }

  /**
   * Line 36: Foreign earned income exclusion.
   * The lesser of foreign earned income (l21) or the prorated
   * maximum exclusion (l28).
   * Referenced by F6251.
   */
  l36 = (): number => Math.min(this.l21(), this.l28())

  // --- Part VI: Housing Exclusion or Deduction ---

  /**
   * Housing amount calculation:
   * - Housing expenses are capped at 30% of max exclusion ($39,000 for 2025)
   * - Base housing amount = 16% of max exclusion ($20,800 for 2025)
   * - Housing exclusion = max(0, capped housing expenses - base amount)
   */

  // Qualified housing expenses (capped at 30% of max exclusion)
  housingAmount = (): number => {
    const cap = Math.round(MAX_EXCLUSION_2025 * HOUSING_CAP_PERCENT)
    return Math.min(this.data.housingExpenses, cap)
  }

  // Base housing amount = 16% of max exclusion
  baseHousingAmount = (): number =>
    Math.round(MAX_EXCLUSION_2025 * HOUSING_BASE_PERCENT)

  /**
   * Line 42: Housing exclusion or deduction.
   * Referenced by F6251.
   */
  l42 = (): number =>
    Math.max(0, this.housingAmount() - this.baseHousingAmount())

  // --- Part VIII: Summary ---

  /**
   * Line 45: Total housing deduction or exclusion.
   * Referenced by Schedule8812.
   */
  l45 = (): number => this.l42()

  /**
   * Line 50: Total foreign earned income exclusion plus housing exclusion.
   * This is the combined exclusion that flows to Schedule 1 line 8d.
   * Referenced by F6251 and Schedule8812.
   */
  l50 = (): number => sumFields([this.l36(), this.l45()])

  fields = (): Field[] => [
    // ===== PAGE 1 (160 fields total, checkboxes at 7-11,14-16,19-20,26-31,33-36,72-75,132-133) =====

    // 0: f1_1 — Name shown on Form 1040
    this.f1040.namesString(),
    // 1: f1_2 — Your social security number
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // 2: f1_3 — Line 1: Tax home country
    this.data.foreignCountry,
    // 3: f1_4 — Line 2: Foreign address line 1
    this.data.foreignAddress,
    // 4: f1_5 — Line 2: Foreign address line 2
    undefined,
    // 5: f1_6 — Line 3: Employer's name
    this.data.employerName,
    // 6: f1_7 — Line 4a: Employer's US address
    this.data.employerAddress,

    // 7: c1_1 — Line 6a employer type checkbox 1
    undefined,
    // 8: c1_2 — Line 6a employer type checkbox 2
    undefined,
    // 9: c1_3 — Line 6a employer type checkbox 3
    undefined,
    // 10: c1_4 — Line 6a employer type checkbox 4 (foreign gov)
    undefined,
    // 11: c1_5 — Line 6a employer type checkbox 5 (other)
    undefined,

    // 12: f1_8 — Line 4b: Employer address line 2
    undefined,
    // 13: f1_9 — Line 6a: Other employer type description
    undefined,

    // 14: c1_6 — Line 5a: Foreign entity? Yes
    this.data.employerIsForeign,
    // 15: c1_7[0] — Line 7a: Joint return? Yes
    undefined,
    // 16: c1_7[1] — Line 7a: Joint return? No
    undefined,

    // 17: f1_10 — Line 5b: Employer foreign address line 1
    undefined,
    // 18: f1_11 — Line 5b: Employer foreign address line 2
    undefined,

    // 19: c1_9[0] — Line 7b: Spouse qualifies? Yes
    undefined,
    // 20: c1_9[1] — Line 7b: Spouse qualifies? No
    undefined,

    // 21: f1_12 — Line 5b: Employer foreign country
    undefined,
    // 22: f1_13 — Line 6b: Self-employed description
    undefined,
    // 23: f1_14 — Line 7c: Spouse's name
    undefined,
    // 24: f1_15 — Line 7c: Spouse's SSN
    undefined,
    // 25: f1_16 — Line 9/10: Date field

    undefined,
    // 26: c1_11[0] — Line 8: Bona fide residence test
    this.data.qualifyingTest === 'bonafide',
    // 27: c1_11[1] — Line 8: Physical presence test
    this.data.qualifyingTest === 'physicalPresence',
    // 28: c1_11[2] — Line 8: Both tests
    false,
    // 29: c1_11[3] — Line 8: Additional checkbox
    false,

    // 30: c1_15[0] — Line 5a: Foreign entity? No
    !this.data.employerIsForeign,
    // 31: c1_15[1] — Additional checkbox
    false,

    // 32: f1_17 — Line 9: Date bona fide residence began
    this.data.residenceStartDate,

    // 33: c1_17[0] — Line 13a: Subjected to foreign tax? Yes
    undefined,
    // 34: c1_17[1] — Line 13a: No
    undefined,
    // 35: c1_19[0] — Line 14b: Visa limit employment? Yes
    undefined,
    // 36: c1_19[1] — Line 14b: No
    undefined,

    // 37-68: Table rows — Line 12/14 travel log (8 rows x 4 cols = 32 text fields)
    undefined, undefined, undefined, undefined,   // 37-40: row 1
    undefined, undefined, undefined, undefined,   // 41-44: row 2
    undefined, undefined, undefined, undefined,   // 45-48: row 3
    undefined, undefined, undefined, undefined,   // 49-52: row 4
    undefined, undefined, undefined, undefined,   // 53-56: row 5
    undefined, undefined, undefined, undefined,   // 57-60: row 6
    undefined, undefined, undefined, undefined,   // 61-64: row 7
    undefined, undefined, undefined, undefined,   // 65-68: row 8

    // 69: f1_50 — Line 10: Date bona fide residence ended
    this.data.residenceEndDate,
    // 70: f1_51 — Line 15: Physical presence period start
    this.data.presenceStartDate,
    // 71: f1_52 — Line 15: Physical presence period end
    this.data.presenceEndDate,

    // 72: c1_21[0] — Line 18a: Lump-sum distribution? Yes
    undefined,
    // 73: c1_21[1] — Line 18a: No
    undefined,
    // 74: c1_23[0] — Line 14d: Visa change refused? Yes
    undefined,
    // 75: c1_23[1] — Line 14d: No
    undefined,

    // 76: f1_53 — Line 17: Days in qualifying period in US
    undefined,
    // 77: f1_54 — Line 14e: Explanation
    undefined,

    // ===== PAGE 2 =====
    // 78: f2_1 — Name (page 2)
    this.f1040.namesString(),
    // 79: f2_2 — SSN (page 2)
    this.f1040.info.taxPayer.primaryPerson.ssid,
    // 80: f2_3 — Line 11a: Date residence began
    undefined,

    // 81-104: Table — Line 16 travel log (4 rows x 6 cols = 24 text fields)
    undefined, undefined, undefined, undefined, undefined, undefined,  // 81-86: row 1
    undefined, undefined, undefined, undefined, undefined, undefined,  // 87-92: row 2
    undefined, undefined, undefined, undefined, undefined, undefined,  // 93-98: row 3
    undefined, undefined, undefined, undefined, undefined, undefined,  // 99-104: row 4

    // 105: f2_28 — Line 11a: Date residence ended
    undefined,
    // 106: f2_29 — Line 11b: Rented, purchased, etc.
    undefined,
    // 107: f2_30 — Line 11c: Foreign country name
    this.data.foreignCountry,
    // 108: f2_31 — Line 11d(2): Where family lived
    undefined,
    // 109: f2_32 — Line 13b: Foreign country taxed in
    undefined,
    // 110: f2_33 — Line 14a: Type of visa
    undefined,
    // 111: f2_34 — Line 14c: Other entry stamp type
    undefined,
    // 112: f2_35 — Line 18b: Days in US on business
    undefined,
    // 113: f2_36 — Line 18c: Nature of business
    undefined,

    // --- Part IV: Foreign Earned Income ---
    // 114: f2_37 — Line 19: Wages, salaries
    this.l19(),
    // 115: f2_38 — Line 20a: Employer-provided amounts
    undefined,
    // 116: f2_39 — Line 20b: Sec 911(d)(6) exception
    undefined,
    // 117: f2_40 — Line 21: Foreign earned income
    this.l21(),
    // 118: f2_41 — Line 22: Self-employment income
    undefined,
    // 119: f2_42 — Line 23: Noncash income
    undefined,
    // 120: f2_43 — Line 23 type description
    undefined,
    // 121: f2_44 — Line 24: Total foreign earned income
    this.l21(),

    // --- Part V: Foreign Earned Income Exclusion ---
    // 122: f2_45 — Line 25: Max exclusion (bona fide)
    this.data.qualifyingTest === 'bonafide' ? this.l27() : undefined,
    // 123: f2_46 — Line 26: Days (physical presence)
    this.data.qualifyingTest === 'physicalPresence'
      ? (this.data.physicalPresenceDays ?? 0)
      : undefined,
    // 124: f2_47 — Line 27: Max exclusion ($130,000)
    this.l27(),
    // 125: f2_48 — Line 28: Prorated exclusion
    this.l28(),
    // 126: f2_49 — Line 29: Smaller of line 25 or 28
    this.l28(),
    // 127: f2_50 — Line 30: Community property worksheet
    undefined,
    // 128: f2_51 — Line 31: Community property exclusion
    undefined,
    // 129: f2_52 — Line 32: Prior year Form 2555
    undefined,
    // 130: f2_53 — Line 33: Subtract line 32 from 29
    undefined,

    // ===== PAGE 3 =====
    // 131: f3_1 — Line 34: Subtract line 33 from line 24
    undefined,

    // 132: c3_1[0] — Qualifying test checkbox (bona fide)
    this.data.qualifyingTest === 'bonafide',
    // 133: c3_1[1] — Qualifying test checkbox (physical presence)
    this.data.qualifyingTest === 'physicalPresence',

    // 134: f3_2 — Line 35: Housing exclusion (line 42)
    this.l42() > 0 ? this.l42() : undefined,
    // 135: f3_3 — Line 36: Foreign earned income exclusion
    this.l36(),

    // --- Part VI: Housing Exclusion/Deduction ---
    // 136: f3_4 — Line 37: Qualified housing expenses
    this.data.housingExpenses,
    // 137: f3_5 — Line 38: Employer-provided housing
    this.data.employerProvidedHousing,
    // 138: f3_6 — Line 39: Subtract line 38 from 37
    Math.max(0, this.data.housingExpenses - this.data.employerProvidedHousing),
    // 139: f3_7 — Line 40: Housing limit (30% of max)
    Math.round(MAX_EXCLUSION_2025 * HOUSING_CAP_PERCENT),
    // 140: f3_8 — Line 41: Smaller of line 39 or 40
    this.housingAmount(),
    // 141: f3_9 — Line 42: Base housing amount (16%)
    this.baseHousingAmount(),
    // 142: f3_10 — Line 43: Housing exclusion/deduction
    this.l42(),
    // 143: f3_11 — Line 44a: Housing exclusion (employees)
    this.l42(),
    // 144: f3_12 — Line 44b: Housing deduction (self-employed)
    undefined,
    // 145: f3_13 — Line 44c: Total housing exclusion/deduction
    this.l42(),

    // --- Housing Deduction Carryover ---
    // 146: f3_14 — Line 45: Carryover from prior year
    undefined,
    // 147: f3_15 — Line 46: Housing deduction
    undefined,
    // 148: f3_16 — Line 47: Income from line 21/22
    this.l21(),
    // 149: f3_17 — Line 48: Amount from line 36
    this.l36(),
    // 150: f3_18 — Line 49: Subtract line 48 from 47
    Math.max(0, this.l21() - this.l36()),
    // 151: f3_19 — Line 50: Housing deduction
    undefined,
    // 152: f3_20 — Line 51: Carryover to next year
    undefined,

    // --- Part VII: Tax Computation ---
    // 153: f3_21 — Line 52: Subtract line 36 from 21
    Math.max(0, this.l21() - this.l36()),
    // 154: f3_22 — Line 53: Subtract housing exclusion
    undefined,
    // 155: f3_23 — Line 54
    undefined,
    // 156: f3_24 — Line 55: Tax on line 54
    undefined,
    // 157: f3_25 — Line 56: Tax on line 53
    undefined,
    // 158: f3_26 — Line 57: Subtract line 56 from 55
    undefined,
    // 159: f3_27 — Line 58/total exclusion
    this.l50()
  ]
}
