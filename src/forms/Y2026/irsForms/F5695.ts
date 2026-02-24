import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form5695Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 5695 — Residential Energy Credits (2025 revision)
 *
 * Part I: Residential Clean Energy Credit (Section 25D)
 *   30% credit on qualified solar, wind, geothermal, fuel cell, and battery
 *   storage property.
 *   PDF lines 1-4, 5a/5b, 6a/6b, 7a-7c, 8-16.
 *
 * Part II: Energy Efficient Home Improvement Credit (Section 25C)
 *   Section A — Qualified Energy Efficiency Improvements (lines 17-20)
 *   Section B — Residential Energy Property Expenditures (lines 21-32)
 *   30% credit on building envelope components, energy property, and home
 *   energy audits. Annual cap of $3,200 with sub-limits.
 *
 * Line 15 (Part I credit) feeds Schedule 3 line 5a.
 * Line 32 (Part II credit) feeds Schedule 3 line 5b.
 *
 * PDF field count: 167 fields across 4 pages.
 */
export default class F5695 extends F1040Attachment {
  tag: FormTag = 'f5695'
  sequenceIndex = 75

  readonly data: Form5695Data

  constructor(f1040: F1040, data: Form5695Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form5695 !== undefined

  // ──────────────────────────────────────────────
  // Part I — Residential Clean Energy Credit
  // ──────────────────────────────────────────────

  // PDF Line 1: Qualified solar electric property costs
  pdfL1 = (): number => this.data.solarElectric

  // PDF Line 2: Qualified solar water heating property costs
  pdfL2 = (): number => this.data.solarWaterHeating

  // PDF Line 3: Qualified small wind energy property costs
  pdfL3 = (): number => this.data.smallWindEnergy

  // PDF Line 4: Qualified geothermal heat pump property costs
  pdfL4 = (): number => this.data.geothermalHeatPump

  // PDF Line 5a: Battery storage yes/no (boolean)
  pdfL5aYes = (): boolean => this.data.batteryStorage > 0

  // PDF Line 5b: Qualified battery storage technology costs
  pdfL5b = (): number | undefined =>
    this.data.batteryStorage > 0 ? this.data.batteryStorage : undefined

  // PDF Line 6a: Add lines 1 through 5b
  pdfL6a = (): number =>
    sumFields([
      this.pdfL1(),
      this.pdfL2(),
      this.pdfL3(),
      this.pdfL4(),
      this.pdfL5b()
    ])

  // PDF Line 6b: Multiply line 6a by 30% (0.30)
  pdfL6b = (): number => Math.round(this.pdfL6a() * 0.3 * 100) / 100

  // PDF Line 8: Qualified fuel cell property costs
  pdfL8 = (): number | undefined =>
    this.data.fuelCell > 0 ? this.data.fuelCell : undefined

  // PDF Line 9: Multiply line 8 by 30%
  pdfL9 = (): number | undefined => {
    const fc = this.pdfL8()
    return fc !== undefined ? Math.round(fc * 0.3 * 100) / 100 : undefined
  }

  // PDF Line 10: Kilowatt capacity * $1,000 (not computed — no kW in data)
  pdfL10 = (): number | undefined => undefined

  // PDF Line 11: Smaller of line 9 or line 10
  pdfL11 = (): number | undefined => {
    const l9 = this.pdfL9()
    const l10 = this.pdfL10()
    if (l9 === undefined) return undefined
    if (l10 === undefined) return l9
    return Math.min(l9, l10)
  }

  // PDF Line 12: Credit carryforward from prior year (not in data model)
  pdfL12 = (): number | undefined => undefined

  // PDF Line 13: Add lines 6b, 11, and 12
  pdfL13 = (): number =>
    sumFields([this.pdfL6b(), this.pdfL11(), this.pdfL12()])

  // PDF Line 14: Tax liability limit (Residential Energy Credit Limit Worksheet)
  // Form 1040 line 18 minus nonrefundable credits that come before this credit
  pdfL14 = (): number => {
    const tax = this.f1040.l18()
    const sch3 = this.f1040.schedule3
    const priorCredits = sumFields([
      sch3.l1(), // Foreign tax credit
      sch3.l2(), // Child/dependent care
      sch3.l3(), // Education credits
      sch3.l4(), // Saver's credit
    ])
    return Math.max(0, tax - priorCredits)
  }

  // PDF Line 15: Residential clean energy credit = smaller of 13 or 14
  pdfL15 = (): number | undefined => {
    const credit = Math.min(this.pdfL13(), this.pdfL14())
    return credit > 0 ? credit : undefined
  }

  // PDF Line 16: Credit carryforward to next year (13 - 15)
  pdfL16 = (): number | undefined => {
    const carryforward = this.pdfL13() - (this.pdfL15() ?? 0)
    return carryforward > 0 ? carryforward : undefined
  }

  // ──────────────────────────────────────────────
  // Part II — Energy Efficient Home Improvement Credit
  // ──────────────────────────────────────────────

  // Section A — Qualified Energy Efficiency Improvements

  // PDF Line 18a: Insulation material/system cost
  pdfL18a = (): number | undefined =>
    this.data.insulationMaterials > 0
      ? this.data.insulationMaterials
      : undefined

  // PDF Line 18b: 18a * 30%, max $1,200
  pdfL18b = (): number | undefined => {
    const cost = this.pdfL18a()
    if (cost === undefined) return undefined
    return Math.min(1200, Math.round(cost * 0.3 * 100) / 100)
  }

  // PDF Line 19a: Most expensive door cost
  // Simplified — we put the total doors/windows cost here
  pdfL19a = (): number | undefined =>
    this.data.exteriorDoorsWindows > 0
      ? this.data.exteriorDoorsWindows
      : undefined

  // PDF Line 19c: 19a * 30%, max $250
  pdfL19c = (): number | undefined => {
    const cost = this.pdfL19a()
    if (cost === undefined) return undefined
    return Math.min(250, Math.round(cost * 0.3 * 100) / 100)
  }

  // PDF Line 19h: Total doors credit = 19c + 19g, max $500
  // Simplified — only using 19c since we don't track individual doors
  pdfL19h = (): number | undefined => {
    const c = this.pdfL19c()
    if (c === undefined) return undefined
    return Math.min(500, c)
  }

  // PDF Line 20d: Windows/skylights credit = 20c * 30%, max $600
  // Not separately tracked in data model (exteriorDoorsWindows combines both)
  pdfL20d = (): number | undefined => undefined

  // Section B — Residential Energy Property Expenditures

  // PDF Line 22a cost: Central AC cost
  pdfL22aCost = (): number | undefined =>
    this.data.centralAC > 0 ? this.data.centralAC : undefined

  // PDF Line 22c: Total central AC (22a + 22b)
  pdfL22c = (): number | undefined => this.pdfL22aCost()

  // PDF Line 22d: 22c * 30%, max $600
  pdfL22d = (): number | undefined => {
    const cost = this.pdfL22c()
    if (cost === undefined) return undefined
    return Math.min(600, Math.round(cost * 0.3 * 100) / 100)
  }

  // PDF Line 23d: Water heater credit = 23c * 30%, max $600
  // Not separately tracked — naturalGasFurnace data covers furnace/boiler
  pdfL23d = (): number | undefined => undefined

  // PDF Line 24a cost: Furnace/boiler cost
  pdfL24aCost = (): number | undefined =>
    this.data.naturalGasFurnace > 0 ? this.data.naturalGasFurnace : undefined

  // PDF Line 24c: Total furnace (24a + 24b)
  pdfL24c = (): number | undefined => this.pdfL24aCost()

  // PDF Line 24d: 24c * 30%, max $600
  pdfL24d = (): number | undefined => {
    const cost = this.pdfL24c()
    if (cost === undefined) return undefined
    return Math.min(600, Math.round(cost * 0.3 * 100) / 100)
  }

  // PDF Line 25c: Enabling property (panelboards) cost
  pdfL25c = (): number | undefined =>
    this.data.panelboards > 0 ? this.data.panelboards : undefined

  // PDF Line 25e: 25c * 30%, max $600
  pdfL25e = (): number | undefined => {
    const cost = this.pdfL25c()
    if (cost === undefined) return undefined
    return Math.min(600, Math.round(cost * 0.3 * 100) / 100)
  }

  // PDF Line 26b: Home energy audit cost
  pdfL26b = (): number | undefined =>
    this.data.homeEnergyAudit > 0 ? this.data.homeEnergyAudit : undefined

  // PDF Line 26c: 26b * 30%, max $150
  pdfL26c = (): number | undefined => {
    const cost = this.pdfL26b()
    if (cost === undefined) return undefined
    return Math.min(150, Math.round(cost * 0.3 * 100) / 100)
  }

  // PDF Line 27: Sum of 18b, 19h, 20d, 22d, 23d, 24d, 25e, 26c
  pdfL27 = (): number =>
    sumFields([
      this.pdfL18b(),
      this.pdfL19h(),
      this.pdfL20d(),
      this.pdfL22d(),
      this.pdfL23d(),
      this.pdfL24d(),
      this.pdfL25e(),
      this.pdfL26c()
    ])

  // PDF Line 28: Smaller of line 27 or $1,200
  pdfL28 = (): number => Math.min(1200, this.pdfL27())

  // PDF Line 29a cost: Heat pump cost
  pdfL29aCost = (): number | undefined =>
    this.data.heatPumps > 0 ? this.data.heatPumps : undefined

  // PDF Line 29c cost: Heat pump water heater cost
  pdfL29cCost = (): number | undefined =>
    this.data.heatPumpWaterHeaters > 0
      ? this.data.heatPumpWaterHeaters
      : undefined

  // PDF Line 29e cost: Biomass stove/boiler cost
  pdfL29eCost = (): number | undefined =>
    this.data.biomassStoves > 0 ? this.data.biomassStoves : undefined

  // PDF Line 29g: Sum of 29a through 29f
  pdfL29g = (): number =>
    sumFields([this.pdfL29aCost(), this.pdfL29cCost(), this.pdfL29eCost()])

  // PDF Line 29h: 29g * 30%, max $2,000
  pdfL29h = (): number | undefined => {
    const total = this.pdfL29g()
    if (total <= 0) return undefined
    return Math.min(2000, Math.round(total * 0.3 * 100) / 100)
  }

  // PDF Line 30: Add lines 28 and 29h
  pdfL30 = (): number => sumFields([this.pdfL28(), this.pdfL29h()])

  // PDF Line 31: Tax liability limitation
  // Same as pdfL14 but also subtract the Part I credit (line 15)
  pdfL31 = (): number => {
    const partILimit = this.pdfL14()
    const partICredit = this.pdfL15() ?? 0
    return Math.max(0, partILimit - partICredit)
  }

  // PDF Line 32: Energy efficient home improvement credit
  // = smaller of line 30 or line 31
  pdfL32 = (): number | undefined => {
    const credit = Math.min(this.pdfL30(), this.pdfL31())
    return credit > 0 ? credit : undefined
  }

  // ──────────────────────────────────────────────
  // Legacy methods for backward compatibility
  // (used by Schedule 3, Schedule 8812, etc.)
  // ──────────────────────────────────────────────

  // Legacy l1-l6 kept for any internal references
  l1 = (): number => this.data.solarElectric
  l2 = (): number => this.data.solarWaterHeating
  l3 = (): number => this.data.fuelCell
  l4 = (): number => this.data.smallWindEnergy
  l5 = (): number => this.data.geothermalHeatPump
  l6 = (): number => this.data.batteryStorage
  l7 = (): number =>
    sumFields([this.l1(), this.l2(), this.l3(), this.l4(), this.l5(), this.l6()])
  l8 = (): number => Math.round(this.l7() * 0.3 * 100) / 100
  l12 = (): number => this.pdfL15() ?? 0

  // Part II legacy
  l13a = (): number => this.data.insulationMaterials
  l13b = (): number => this.data.exteriorDoorsWindows
  l13c = (): number => this.data.roofingSurfaces
  l13d = (): number =>
    Math.min(1200, sumFields([this.l13a(), this.l13b(), this.l13c()]))
  l14a = (): number => this.data.heatPumps
  l14b = (): number => this.data.heatPumpWaterHeaters
  l14c = (): number => this.data.biomassStoves
  l14d = (): number => this.data.centralAC
  l14e = (): number => this.data.naturalGasFurnace
  l14f = (): number => this.data.panelboards
  l14g = (): number =>
    sumFields([
      this.l14a(),
      this.l14b(),
      this.l14c(),
      this.l14d(),
      this.l14e(),
      this.l14f()
    ])
  l15 = (): number => Math.min(150, this.data.homeEnergyAudit)
  l24 = (): number => this.pdfL32() ?? 0

  // Line 30: Total residential energy credits = Part I + Part II
  l30 = (): number | undefined => {
    const total = this.l12() + this.l24()
    return total > 0 ? total : undefined
  }

  // Convenience method for Schedule 3
  credit = (): number | undefined => this.l30()

  // ──────────────────────────────────────────────
  // PDF fields — 167 entries matching the 2025 Form 5695 PDF
  //
  // Each index corresponds to a PDF form field in order.
  // Fields we do not compute are set to undefined (skipped
  // by the PDF filler). Checkboxes use boolean values.
  // ──────────────────────────────────────────────

  fields = (): Field[] => [
    // ============================================================
    // PAGE 1 — Part I: Residential Clean Energy Credit
    // 167 fields total. Checkboxes at: 11,12,16,17,23,37-42,48,49,
    // 83-86,129,130,142,143,165,166
    // ============================================================

    // 0: f1_01 — Name(s) shown on return
    this.f1040.namesString(),
    // 1: f1_02 — SSN
    this.f1040.info.taxPayer.primaryPerson.ssid,

    // Property address
    // 2: f1_03 — Number and street
    undefined,
    // 3: f1_04 — Unit no.
    undefined,
    // 4: f1_05 — City or town
    undefined,
    // 5: f1_06 — State
    undefined,
    // 6: f1_07 — ZIP code
    undefined,

    // 7: f1_08 — Line 1: Solar electric costs
    this.pdfL1(),
    // 8: f1_09 — Line 2: Solar water heating costs
    this.pdfL2(),
    // 9: f1_10 — Line 3: Small wind energy costs
    this.pdfL3(),
    // 10: f1_11 — Line 4: Geothermal heat pump costs
    this.pdfL4(),

    // 11: c1_1[0] — Line 5a: Battery storage? Yes
    this.pdfL5aYes(),
    // 12: c1_1[1] — Line 5a: Battery storage? No
    !this.pdfL5aYes(),

    // 13: f1_12 — Line 5b: Battery storage costs
    this.pdfL5b(),
    // 14: f1_13 — Line 6a: Add lines 1-5b
    this.pdfL6a(),
    // 15: f1_14 — Line 6b: Multiply line 6a by 30%
    this.pdfL6b(),

    // 16: c1_2[0] — Line 7a: Fuel cell on main home? Yes
    this.data.fuelCell > 0,
    // 17: c1_2[1] — Line 7a: No
    !(this.data.fuelCell > 0),

    // Fuel cell main home address (line 7b)
    // 18: f1_15 — Number and street
    undefined,
    // 19: f1_16 — Unit no.
    undefined,
    // 20: f1_17 — City or town
    undefined,
    // 21: f1_18 — State
    undefined,
    // 22: f1_19 — ZIP code
    undefined,

    // 23: c1_3[0] — Line 7c: Joint occupants checkbox
    false,

    // 24: f1_20 — Line 8: Fuel cell property costs
    this.pdfL8(),
    // 25: f1_21 — Line 9: Line 8 * 30%
    this.pdfL9(),
    // 26: f1_22 — Line 10: kW capacity * $1,000
    this.pdfL10(),
    // 27: f1_23 — Line 11: Smaller of line 9 or 10
    this.pdfL11(),
    // 28: f1_24 — Line 12: Credit carryforward
    this.pdfL12(),
    // 29: f1_25 — Line 13: Add lines 6b, 11, 12
    this.pdfL13(),
    // 30: f1_26 — Line 14: Tax liability limitation
    this.pdfL14(),
    // 31: f1_27 — Line 15: Clean energy credit
    this.pdfL15(),
    // 32: f1_28 — Line 16: Credit carryforward to next year
    this.pdfL16(),

    // Part I additional fields
    // 33: f1_29 — Additional Part I field
    undefined,
    // 34: f1_30 — Additional Part I field
    undefined,

    // ============================================================
    // PAGE 2 — Part II, Section A
    // ============================================================

    // 35: f2_01 — Name(s) (page 2 header)
    this.f1040.namesString(),
    // 36: f2_02 — SSN (page 2 header)
    this.f1040.info.taxPayer.primaryPerson.ssid,

    // 37: c2_1[0] — Line 17a: Improvements on main home? Yes
    undefined,
    // 38: c2_1[1] — Line 17a: No
    undefined,
    // 39: c2_2[0] — Line 17b: Original user? Yes
    undefined,
    // 40: c2_2[1] — Line 17b: No
    undefined,
    // 41: c2_3[0] — Line 17c: Expected to remain 5+ years? Yes
    undefined,
    // 42: c2_3[1] — Line 17c: No
    undefined,

    // Line 17d — Main home address
    // 43: f2_03 — Number and street
    undefined,
    // 44: f2_04 — Unit no.
    undefined,
    // 45: f2_05 — City or town
    undefined,
    // 46: f2_06 — State
    undefined,
    // 47: f2_07 — ZIP code
    undefined,

    // 48: c2_4[0] — Line 17e: Related to construction? Yes
    undefined,
    // 49: c2_4[1] — Line 17e: No
    undefined,

    // Line 18 — Insulation
    // 50: f2_08 — Line 18a: Insulation cost
    this.pdfL18a(),
    // 51: f2_09 — Line 18b: 18a * 30%, max $1,200
    this.pdfL18b(),

    // Line 19 — Exterior doors
    // 52: f2_10 — Line 19a QMID
    undefined,
    // 53: f2_11 — Line 19a: Most expensive door cost
    this.pdfL19a(),
    // 54: f2_12 — Line 19b QMID
    undefined,
    // 55: f2_13 — Line 19c: 19a * 30%, max $250
    this.pdfL19c(),

    // 56: f2_14 — Line 19d: Other door costs
    undefined,
    // 57: f2_15 — Line 19d(i) QMID
    undefined,
    // 58: f2_16 — Line 19d(i) cost
    undefined,
    // 59: f2_17 — Line 19d(ii) cost
    undefined,
    // 60: f2_18 — Line 19e: Cost of other qualifying doors
    undefined,
    // 61: f2_19 — Line 19f: Add 19d and 19e
    undefined,
    // 62: f2_20 — Line 19g: 19f * 30%
    undefined,
    // 63: f2_21 — Line 19h: 19c + 19g, max $500
    this.pdfL19h(),

    // Line 20 — Windows/skylights
    // 64: f2_22 — Line 20a cost/QMID
    undefined,
    // 65: f2_23 — Line 20a(i) QMID
    undefined,
    // 66: f2_24 — Line 20a(i) cost
    undefined,
    // 67: f2_25 — Line 20a(ii) QMID
    undefined,
    // 68: f2_26 — Line 20a(ii) cost
    undefined,
    // 69: f2_27 — Line 20a(iii) QMID
    undefined,
    // 70: f2_28 — Line 20a(iii) cost
    undefined,
    // 71: f2_29 — Line 20a(iv) QMID
    undefined,
    // 72: f2_30 — Line 20a(iv) cost
    undefined,
    // 73: f2_31 — Line 20b: Other windows/skylights
    undefined,
    // 74: f2_32 — Line 20c: Add 20a and 20b
    undefined,
    // 75: f2_33 — Line 20c(ii)
    undefined,
    // 76: f2_34 — Line 20d: 20c * 30%, max $600
    this.pdfL20d(),
    // 77: f2_35 — Additional field
    undefined,
    // 78: f2_36 — Additional field
    undefined,
    // 79: f2_37 — Additional field
    undefined,
    // 80: f2_38 — Additional field
    undefined,
    // 81: f2_39 — Additional field
    undefined,
    // 82: f2_40 — Additional field
    undefined,

    // ============================================================
    // PAGE 3 — Part II, Section B
    // ============================================================

    // 83: c3_1[0] — Line 21a: Qualified energy property? Yes
    undefined,
    // 84: c3_1[1] — Line 21a: No
    undefined,
    // 85: c3_2[0] — Line 21b: Originally placed in service? Yes
    undefined,
    // 86: c3_2[1] — Line 21b: No
    undefined,

    // Line 21c — Address rows (4 rows x 5 fields)
    // Row 1
    undefined, undefined, undefined, undefined, undefined,  // 87-91
    // Row 2
    undefined, undefined, undefined, undefined, undefined,  // 92-96
    // Row 3
    undefined, undefined, undefined, undefined, undefined,  // 97-101
    // Row 4
    undefined, undefined, undefined, undefined, undefined,  // 102-106

    // Line 22 — Central AC
    // 107: f3_21 — Line 22a QMID
    undefined,
    // 108: f3_22 — Line 22a cost
    this.pdfL22aCost(),
    // 109: f3_23 — Line 22a QMID (second field)
    undefined,
    // 110: f3_24 — Line 22b: Other AC cost
    undefined,
    // 111: f3_25 — Line 22c: 22a + 22b
    this.pdfL22c(),
    // 112: f3_26 — Line 22d: 22c * 30%, max $600
    this.pdfL22d(),

    // Line 23 — Water heaters
    // 113: f3_27 — Line 23a QMID
    undefined,
    // 114: f3_28 — Line 23a(i) QMID
    undefined,
    // 115: f3_29 — Line 23a(i) cost
    undefined,
    // 116: f3_30 — Line 23a(ii) QMID
    undefined,
    // 117: f3_30 — Line 23a(ii) cost
    undefined,
    // 118: f3_31 — Line 23a(ii) QMID (continued)
    undefined,
    // 119: f3_32 — Line 23b: Other water heaters
    undefined,
    // 120: f3_33 — Line 23c: 23a + 23b
    undefined,
    // 121: f3_34 — Line 23d: 23c * 30%, max $600
    this.pdfL23d(),

    // Line 24 — Furnace/hot water boiler
    // 122: f3_35 — Line 24a QMID
    undefined,
    // 123: f3_36 — Line 24a cost
    this.pdfL24aCost(),
    // 124: f3_37 — Line 24a QMID (second)
    undefined,
    // 125: f3_38 — Line 24b: Other furnace cost
    undefined,
    // 126: f3_39 — Line 24c: 24a + 24b
    this.pdfL24c(),
    // 127: f3_40 — Line 24d: 24c * 30%, max $600
    this.pdfL24d(),
    // 128: f3_41 — Line 24d (additional)
    undefined,

    // Line 25 — Enabling property (panelboards)
    // 129: c3_4[0] — Line 25a: Yes
    undefined,
    // 130: c3_4[1] — Line 25a: No
    undefined,

    // 131-137: f3_42-f3_48 — Line 25b: Code(s) fields (maxLen=3 each)
    undefined, undefined, undefined, undefined, undefined, undefined, undefined,
    // 138: f3_49 — Line 25c: Cost of enabling property
    this.pdfL25c(),
    // 139: f3_50 — Line 25d(i) QMID (maxLen=4)
    undefined,
    // 140: f3_51 — Line 25d(ii) QMID (maxLen=4)
    undefined,
    // 141: f3_52 — Line 25e: 25c * 30%, max $600
    this.pdfL25e(),

    // ============================================================
    // PAGE 4 — Part II, Section B (continued)
    // ============================================================

    // 142: c4_1[0] — Line 26a: Home energy audit? Yes
    undefined,
    // 143: c4_1[1] — Line 26a: No
    undefined,

    // 144: f4_01 — Line 26b: Cost of home energy audits
    this.pdfL26b(),
    // 145: f4_02 — Line 26c: 26b * 30%, max $150
    this.pdfL26c(),

    // 146: f4_03 — Line 27: Sum of credits
    this.pdfL27(),
    // 147: f4_04 — Line 28: Smaller of line 27 or $1,200
    this.pdfL28(),

    // Line 29 — Heat pumps, water heaters, biomass
    // 148: f4_05 — Line 29a: Heat pump cost
    this.pdfL29aCost(),
    // 149: f4_06 — Line 29a QMID
    undefined,
    // 150: f4_07 — Line 29a QMID (continued)
    undefined,
    // 151: f4_08 — Line 29b: Other heat pump cost
    undefined,
    // 152: f4_09 — Line 29c: Heat pump water heater cost
    this.pdfL29cCost(),
    // 153: f4_10 — Line 29c QMID
    undefined,
    // 154: f4_11 — Line 29c QMID (continued)
    undefined,
    // 155: f4_12 — Line 29d: Other heat pump water heater cost
    undefined,
    // 156: f4_13 — Line 29e: Biomass stove/boiler cost
    this.pdfL29eCost(),
    // 157: f4_14 — Line 29e QMID
    undefined,
    // 158: f4_15 — Line 29e QMID (continued)
    undefined,
    // 159: f4_16 — Line 29f: Other biomass cost
    undefined,
    // 160: f4_17 — Line 29g: Add lines 29a-29f
    this.pdfL29g(),
    // 161: f4_18 — Line 29h: 29g * 30%, max $2,000
    this.pdfL29h(),

    // 162: f4_19 — Line 30: Add lines 28 and 29h
    this.pdfL30(),
    // 163: f4_20 — Line 31: Tax liability limitation
    this.pdfL31(),
    // 164: f4_21 — Line 32: Energy efficient home improvement credit
    this.pdfL32(),

    // 165: c4_2 — Line 32a: Joint occupants checkbox
    undefined,
    // 166: c4_3 — Line 32b: Condo/cooperative checkbox
    undefined
  ]
}
