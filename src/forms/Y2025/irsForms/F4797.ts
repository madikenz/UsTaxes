import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { BusinessPropertySale, Form4797Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 4797 — Sales of Business Property
 *
 * Reports gains and losses from:
 * - Part I: Sales or exchanges of property used in a trade or business
 *   and involuntary conversions (Section 1231)
 * - Part II: Ordinary gains and losses (depreciation recapture under
 *   Sections 1245 and 1250)
 * - Part III: Gain from disposition of property under Sections 1245,
 *   1250, 1252, 1254, and 1255
 * - Part IV: Recapture amounts under Sections 179 and 280F(b)(2)
 *
 * Impacts Schedule D, Schedule EIC (PUB 596 worksheet 1), and Form 1040.
 *
 * Reference: 2024 Form 4797 instructions
 *
 * PDF field count: 182
 */
export default class F4797 extends F1040Attachment {
  tag: FormTag = 'f4797'
  sequenceIndex = 27

  readonly data: Form4797Data

  constructor(f1040: F1040, data: Form4797Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form4797 !== undefined

  // --- Helper: gain or loss on a single sale ---
  private gainOrLoss = (sale: BusinessPropertySale): number =>
    sale.grossSalesPrice - sale.cost + sale.depreciationAllowed

  // --- Part I: Section 1231 gains and losses ---

  // Filter to section 1231 sales (property held more than 1 year)
  private section1231Sales = (): BusinessPropertySale[] =>
    this.data.sales.filter((s) => s.section1231)

  // Filter to ordinary (non-1231) sales (property held 1 year or less, etc.)
  private ordinarySales = (): BusinessPropertySale[] =>
    this.data.sales.filter((s) => !s.section1231)

  // Filter to sales that go through Part III (section 1245/1250 recapture)
  private partIIISales = (): BusinessPropertySale[] =>
    this.data.sales.filter((s) => s.section1245 || s.section1250)

  // Line 7: Combine lines 2 through 6
  l7 = (): number | undefined => {
    const sales = this.section1231Sales()
    if (sales.length === 0) return undefined

    const netGain = sales.reduce(
      (sum, sale) => sum + this.gainOrLoss(sale),
      0
    )
    return netGain
  }

  // --- Part II: Ordinary gains and losses ---

  // Section 1245 recapture: the lesser of depreciation allowed or gain
  private section1245Recapture = (): number =>
    this.data.sales
      .filter((s) => s.section1245)
      .reduce((sum, sale) => {
        const gain = this.gainOrLoss(sale)
        if (gain <= 0) return sum
        // Section 1245 recapture: lesser of depreciation or gain
        return sum + Math.min(sale.depreciationAllowed, gain)
      }, 0)

  // Section 1250 recapture: only "additional depreciation" (excess over
  // straight-line) is recaptured as ordinary income.  For post-1986 MACRS
  // real property the depreciation method IS straight-line, so additional
  // depreciation is always 0.  Until the data model adds an
  // additionalDepreciation field for pre-1987 property, this returns 0.
  private section1250Recapture = (): number => 0

  // Unrecaptured section 1250 gain: for section 1250 property (real property),
  // the gain attributable to depreciation that is NOT recaptured as ordinary
  // income. This is taxed at a max rate of 25%.
  // = min(depreciation allowed, gain) - section 1250 ordinary recapture
  unrecapturedSection1250Gain = (): number =>
    this.data.sales
      .filter((s) => s.section1250)
      .reduce((sum, sale) => {
        const gain = this.gainOrLoss(sale)
        if (gain <= 0) return sum
        const totalRecapturableGain = Math.min(sale.depreciationAllowed, gain)
        // Subtract ordinary recapture (section1250Recapture is currently 0
        // for post-1986 MACRS, so the full depreciation gain is unrecaptured)
        return sum + totalRecapturableGain
      }, 0)

  // Line 8: Nonrecaptured net section 1231 losses from prior years
  l8 = (): number | undefined => undefined

  // Line 9: Subtract line 8 from line 7
  l9 = (): number | undefined => {
    const l7 = this.l7()
    if (l7 === undefined) return undefined
    const l8 = this.l8() ?? 0
    return Math.max(0, l7 - l8)
  }

  // Line 11: Loss, if any, from line 7
  l11 = (): number | undefined => {
    const l7 = this.l7()
    if (l7 !== undefined && l7 < 0) return Math.abs(l7)
    return undefined
  }

  // Line 12: Gain, if any, from line 7 or amount from line 8
  l12 = (): number | undefined => {
    const l7 = this.l7()
    if (l7 === undefined || l7 <= 0) return undefined
    const l9 = this.l9()
    if (l9 !== undefined && l9 === 0) return l7
    return this.l8()
  }

  // Line 13: Gain, if any, from line 31 (Part III summary)
  l13 = (): number | undefined => {
    const l31 = this.l31()
    return l31 !== undefined && l31 > 0 ? l31 : undefined
  }

  // Line 17: Combine lines 10 through 16
  l17 = (): number | undefined => {
    const total = sumFields([
      this.ordinaryGainFromLine10(),
      this.l11() !== undefined ? -(this.l11() as number) : undefined,
      this.l12(),
      this.l13()
    ])
    return total !== 0 ? total : undefined
  }

  // Line 18b: Redetermine gain or loss on line 17 excluding line 18a
  l18b = (): number | undefined => this.l17()

  // Net ordinary gain from line 10 rows
  private ordinaryGainFromLine10 = (): number | undefined => {
    const sales = this.ordinarySales()
    if (sales.length === 0) return undefined
    return sales.reduce((sum, sale) => sum + this.gainOrLoss(sale), 0)
  }

  // --- Part III: Gain From Disposition of Property ---

  // Line 30: Total gains for all properties (sum of line 24, properties A-D)
  l30 = (): number | undefined => {
    const sales = this.partIIISales()
    if (sales.length === 0) return undefined
    return sales.reduce((sum, sale) => {
      const gain = this.gainOrLoss(sale)
      return sum + gain
    }, 0)
  }

  // Line 31: Sum of recapture amounts (lines 25b, 26g, 27c, 28b, 29b) for all properties
  l31 = (): number | undefined => {
    const recapture = this.section1245Recapture() + this.section1250Recapture()
    return recapture > 0 ? recapture : undefined
  }

  // Line 32: Line 30 minus line 31
  l32 = (): number | undefined => {
    const l30 = this.l30()
    const l31 = this.l31()
    if (l30 === undefined) return undefined
    return l30 - (l31 ?? 0)
  }

  // --- Field row helpers ---

  /**
   * Generate 4 rows x 7 columns of fields for Part I (line 2) or Part II (line 10).
   * Each row: (a) description, (b) date acquired, (c) date sold,
   *           (d) gross sales price, (e) depreciation, (f) cost, (g) gain or loss
   */
  private propertyFieldRows = (sales: BusinessPropertySale[]): Field[] => {
    const rows: Field[] = []
    for (let i = 0; i < 4; i++) {
      if (i < sales.length) {
        const sale = sales[i]
        rows.push(
          sale.description,
          sale.dateAcquired,
          sale.dateSold,
          sale.grossSalesPrice,
          sale.depreciationAllowed,
          sale.cost,
          this.gainOrLoss(sale)
        )
      } else {
        rows.push(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined
        )
      }
    }
    return rows
  }

  /**
   * Generate Part III fields for properties A-D.
   * Lines 19a-d (description), 19b (date acquired), 19c (date sold)
   * then lines 20-29b each with 4 property columns.
   */
  private partIIIFields = (): Field[] => {
    const sales = this.partIIISales()
    const fields: Field[] = []

    // Line 19: descriptions, dates acquired, dates sold (4 properties each)
    // 19 A-D descriptions
    for (let i = 0; i < 4; i++) {
      fields.push(i < sales.length ? sales[i].description : undefined)
    }
    // 19 A-D date acquired
    for (let i = 0; i < 4; i++) {
      fields.push(i < sales.length ? sales[i].dateAcquired : undefined)
    }
    // 19 A-D date sold
    for (let i = 0; i < 4; i++) {
      fields.push(i < sales.length ? sales[i].dateSold : undefined)
    }

    // Helper to get a value for property i, or undefined
    const propVal = (
      i: number,
      fn: (sale: BusinessPropertySale) => number | undefined
    ): number | undefined => (i < sales.length ? fn(sales[i]) : undefined)

    const gain = (sale: BusinessPropertySale): number =>
      this.gainOrLoss(sale)
    const adjustedBasis = (sale: BusinessPropertySale): number =>
      sale.cost - sale.depreciationAllowed

    // Lines 20-29b: each line has 4 property columns (A, B, C, D)
    const lineRow = (
      fn: (sale: BusinessPropertySale) => number | undefined
    ): void => {
      for (let i = 0; i < 4; i++) {
        fields.push(propVal(i, fn))
      }
    }

    // Line 20: Gross sales price
    lineRow((s) => s.grossSalesPrice)
    // Line 21: Cost or other basis plus expense of sale
    lineRow((s) => s.cost)
    // Line 22: Depreciation allowed or allowable
    lineRow((s) => s.depreciationAllowed)
    // Line 23: Adjusted basis (line 21 - line 22)
    lineRow((s) => adjustedBasis(s))
    // Line 24: Total gain (line 20 - line 23)
    lineRow((s) => gain(s))

    // Line 25a: Section 1245 — depreciation allowed or allowable from line 22
    lineRow((s) => (s.section1245 ? s.depreciationAllowed : undefined))
    // Line 25b: Section 1245 — smaller of line 24 or 25a
    lineRow((s) => {
      if (!s.section1245) return undefined
      const g = gain(s)
      return g > 0 ? Math.min(s.depreciationAllowed, g) : undefined
    })

    // Line 26a: Section 1250 — additional depreciation after 1975
    lineRow((s) => (s.section1250 ? s.depreciationAllowed : undefined))
    // Line 26b: Section 1250 — applicable percentage x smaller of line 24 or 26a
    lineRow((s) => {
      if (!s.section1250) return undefined
      const g = gain(s)
      return g > 0 ? Math.min(s.depreciationAllowed, g) : undefined
    })
    // Line 26c: Section 1250 — subtract line 26a from line 24
    lineRow((s) => {
      if (!s.section1250) return undefined
      const g = gain(s)
      return Math.max(0, g - s.depreciationAllowed)
    })
    // Line 26d: Section 1250 — additional depreciation after 1969 and before 1976
    lineRow(() => undefined)
    // Line 26e: Section 1250 — smaller of line 26c or 26d
    lineRow(() => undefined)
    // Line 26f: Section 1250 — section 291 amount (corporations only)
    lineRow(() => undefined)
    // Line 26g: Section 1250 — add lines 26b, 26e, and 26f
    lineRow((s) => {
      if (!s.section1250) return undefined
      const g = gain(s)
      return g > 0 ? Math.min(s.depreciationAllowed, g) : undefined
    })

    // Line 27a: Section 1252 — soil, water, and land clearing expenses
    lineRow(() => undefined)
    // Line 27b: Section 1252 — line 27a x applicable percentage
    lineRow(() => undefined)
    // Line 27c: Section 1252 — smaller of line 24 or 27b
    lineRow(() => undefined)

    // Line 28a: Section 1254 — intangible drilling costs, etc.
    lineRow(() => undefined)
    // Line 28b: Section 1254 — smaller of line 24 or 28a
    lineRow(() => undefined)

    // Line 29a: Section 1255 — applicable percentage of payments excluded
    lineRow(() => undefined)
    // Line 29b: Section 1255 — smaller of line 24 or 29a
    lineRow(() => undefined)

    return fields
  }

  // ---------------------------------------------------------------
  // PDF field output — 182 fields total
  // ---------------------------------------------------------------

  fields = (): Field[] => [
    // ============================================================
    // PAGE 1 (75 fields: indices 0-74)
    // ============================================================

    // --- Header ---
    this.f1040.namesString(), // [0] Name(s) shown on return
    this.f1040.info.taxPayer.primaryPerson.ssid, // [1] Identifying number

    // --- Lines 1a ---
    undefined, // [2] Line 1a: gross proceeds from 1099-B/1099-S

    // --- Part I: Section 1231 property (line 2, 4 rows x 7 cols = 28 fields) ---
    ...this.propertyFieldRows(this.section1231Sales()),
    // [3]  Row 1 col (a) description
    // [4]  Row 1 col (b) date acquired
    // [5]  Row 1 col (c) date sold
    // [6]  Row 1 col (d) gross sales price
    // [7]  Row 1 col (e) depreciation
    // [8]  Row 1 col (f) cost or other basis
    // [9]  Row 1 col (g) gain or (loss)
    // [10] Row 2 col (a) ... [16] Row 2 col (g)
    // [17] Row 3 col (a) ... [23] Row 3 col (g)
    // [24] Row 4 col (a) ... [30] Row 4 col (g)

    // --- Part I summary lines ---
    undefined, // [31] Line 3: Gain from Form 4684, line 39
    undefined, // [32] Line 4: Section 1231 gain from Form 6252
    undefined, // [33] Line 5: Section 1231 gain/loss from Form 8824
    undefined, // [34] Line 6: Gain from line 32 (Part III)
    this.l7(), // [35] Line 7: Combine lines 2 through 6
    this.l8(), // [36] Line 8: Nonrecaptured net section 1231 losses
    this.l9(), // [37] Line 9: Line 7 minus line 8

    // --- Part II: Ordinary gains and losses (line 10, 4 rows x 7 cols = 28 fields) ---
    ...this.propertyFieldRows(this.ordinarySales()),
    // [38] Row 1 col (a) ... [44] Row 1 col (g)
    // [45] Row 2 col (a) ... [51] Row 2 col (g)
    // [52] Row 3 col (a) ... [58] Row 3 col (g)
    // [59] Row 4 col (a) ... [65] Row 4 col (g)

    // --- Part II summary lines ---
    this.l11(), // [66] Line 11: Loss, if any, from line 7
    this.l12(), // [67] Line 12: Gain from line 7 or amount from line 8
    this.l13(), // [68] Line 13: Gain from line 31 (Part III)
    undefined, // [69] Line 14: Net gain or (loss) from Form 4684
    undefined, // [70] Line 15: Ordinary gain from Form 6252
    undefined, // [71] Line 16: Ordinary gain/loss from Form 8824
    this.l17(), // [72] Line 17: Combine lines 10 through 16
    undefined, // [73] Line 18a: Loss from income-producing property
    this.l18b(), // [74] Line 18b: Redetermined gain/loss (to Schedule 1)

    // ============================================================
    // PAGE 2 (107 fields: indices 75-181)
    // ============================================================

    // --- Header ---
    this.f1040.namesString(), // [75] Name (page 2)
    this.f1040.info.taxPayer.primaryPerson.ssid, // [76] SSN (page 2)

    // --- Part III: Lines 19-29b (96 fields) ---
    ...this.partIIIFields(),
    // [77-80]   Line 19 A-D descriptions
    // [81-84]   Line 19 A-D date acquired
    // [85-88]   Line 19 A-D date sold
    // [89-92]   Line 20 Properties A-D: gross sales price
    // [93-96]   Line 21 Properties A-D: cost or other basis
    // [97-100]  Line 22 Properties A-D: depreciation
    // [101-104] Line 23 Properties A-D: adjusted basis
    // [105-108] Line 24 Properties A-D: total gain
    // [109-112] Line 25a Properties A-D: sec 1245 depreciation
    // [113-116] Line 25b Properties A-D: sec 1245 recapture
    // [117-120] Line 26a Properties A-D: sec 1250 additional depreciation
    // [121-124] Line 26b Properties A-D: sec 1250 applicable %
    // [125-128] Line 26c Properties A-D: line 24 minus line 26a
    // [129-132] Line 26d Properties A-D: additional depreciation 1969-1976
    // [133-136] Line 26e Properties A-D: smaller of 26c or 26d
    // [137-140] Line 26f Properties A-D: section 291 (corps only)
    // [141-144] Line 26g Properties A-D: sum of 26b, 26e, 26f
    // [145-148] Line 27a Properties A-D: sec 1252 soil/water expenses
    // [149-152] Line 27b Properties A-D: sec 1252 applicable %
    // [153-156] Line 27c Properties A-D: sec 1252 recapture
    // [157-160] Line 28a Properties A-D: sec 1254 intangible drilling
    // [161-164] Line 28b Properties A-D: sec 1254 recapture
    // [165-168] Line 29a Properties A-D: sec 1255 applicable %
    // [169-172] Line 29b Properties A-D: sec 1255 recapture

    // --- Part III summary ---
    this.l30(), // [173] Line 30: Total gains (sum of line 24)
    this.l31(), // [174] Line 31: Total recapture (sum of 25b+26g+27c+28b+29b)
    this.l32(), // [175] Line 32: Line 30 minus line 31

    // --- Part IV: Recapture Amounts Under Sections 179 and 280F(b)(2) ---
    undefined, // [176] Line 33a: Section 179 expense deduction (prior years)
    undefined, // [177] Line 33b: Section 280F(b)(2) depreciation (prior years)
    undefined, // [178] Line 34a: Section 179 recomputed depreciation
    undefined, // [179] Line 34b: Section 280F(b)(2) recomputed depreciation
    undefined, // [180] Line 35a: Section 179 recapture (line 33a - line 34a)
    undefined // [181] Line 35b: Section 280F(b)(2) recapture (line 33b - line 34b)
  ]
}
