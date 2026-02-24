import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8283Data } from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Form 8283 — Noncash Charitable Contributions
 *
 * Required when noncash contributions exceed $500.
 * Section A: Items valued at $5,000 or less (or publicly traded securities)
 * Section B: Items valued at more than $5,000 (requires appraisal)
 *
 * The total noncash contributions feed Schedule A line 12.
 * This form is primarily informational — the deduction is on Schedule A.
 *
 * Reference: 2024 Form 8283 instructions
 */
export default class F8283 extends F1040Attachment {
  tag: FormTag = 'f8283'
  sequenceIndex = 55

  readonly data: Form8283Data

  constructor(f1040: F1040, data: Form8283Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form8283 !== undefined &&
    this.f1040.info.form8283.contributions.length > 0

  // Total fair market value of all noncash contributions
  totalFMV = (): number =>
    this.data.contributions.reduce((sum, c) => sum + c.fairMarketValue, 0)

  // Total donor cost basis
  totalCostBasis = (): number =>
    this.data.contributions.reduce((sum, c) => sum + c.donorCost, 0)

  // Section A items (FMV <= $5,000 or publicly traded securities)
  sectionATotal = (): number =>
    this.data.contributions
      .filter((c) => c.fairMarketValue <= 5000)
      .reduce((sum, c) => sum + c.fairMarketValue, 0)

  // Section B items (FMV > $5,000, requires appraisal)
  // Uses dedicated Section B data if available, otherwise filters Section A contributions
  sectionBTotal = (): number => {
    const secBTotal = (this.data.contributionsSectionB ?? []).reduce(
      (sum, c) => sum + c.fairMarketValue,
      0
    )
    if (secBTotal > 0) return secBTotal
    return this.data.contributions
      .filter((c) => c.fairMarketValue > 5000)
      .reduce((sum, c) => sum + c.fairMarketValue, 0)
  }

  private sectionBItems = () =>
    (this.data.contributionsSectionB ?? []).slice(0, 3)

  private sectionBTopRows = (): Field[] => {
    const items = this.sectionBItems()
    const rows: Field[] = []
    for (let i = 0; i < 3; i++) {
      const item = items[i]
      rows.push(
        item ? item.description : undefined,
        item ? item.condition : undefined,
        item ? item.fairMarketValue : undefined
      )
    }
    return rows
  }

  private sectionBBottomRows = (): Field[] => {
    const items = this.sectionBItems()
    const rows: Field[] = []
    for (let i = 0; i < 3; i++) {
      const item = items[i]
      rows.push(
        item ? item.dateAcquired : undefined,
        item ? item.howAcquired : undefined,
        item ? item.donorCost : undefined,
        undefined, // bargain sale amount
        undefined, // qualified conservation basis
        item ? item.fairMarketValue : undefined // amount claimed
      )
    }
    return rows
  }

  // Appraiser declaration fields for Section B
  private appraiserFields = (): Field[] => {
    const items = this.sectionBItems()
    if (items.length === 0) {
      return [undefined, undefined, undefined, undefined, undefined, undefined]
    }
    const first = items[0]
    return [
      first.appraisalDate,
      first.appraiserName,
      undefined, // title
      undefined, // business address
      first.appraiserTIN,
      undefined // city, state, ZIP
    ]
  }

  fields = (): Field[] => {
    // Section A items (FMV <= $5,000 or publicly traded securities), up to 4 rows
    const sectionAItems = this.data.contributions
      .filter((c) => c.fairMarketValue <= 5000)
      .slice(0, 4)

    // Build Section A top grid rows A-D: columns (a), (b) checkbox, (b) VIN, (c)
    const sectionATopRows: Field[] = []
    for (let i = 0; i < 4; i++) {
      const item = sectionAItems[i]
      sectionATopRows.push(
        item
          ? `${item.doneeOrganization}\n${item.doneeAddress}`
          : undefined, // (a) Name and address of donee
        item ? false : undefined, // (b) Vehicle checkbox
        undefined, // (b) VIN
        item ? item.description : undefined // (c) Description and condition
      )
    }

    // Build Section A bottom grid rows A-D: columns (d)-(i)
    const sectionABottomRows: Field[] = []
    for (let i = 0; i < 4; i++) {
      const item = sectionAItems[i]
      sectionABottomRows.push(
        item ? item.dateOfContribution : undefined, // (d) Date of contribution
        item ? item.dateAcquired : undefined, // (e) Date acquired
        item ? item.howAcquired : undefined, // (f) How acquired
        item ? item.donorCost : undefined, // (g) Donor's cost or adjusted basis
        item ? item.fairMarketValue : undefined, // (h) Fair market value
        item ? item.methodOfFMV : undefined // (i) Method used to determine FMV
      )
    }

    return [
      // ── Page 1 Header ──────────────────────────────────────────
      this.f1040.namesString(), // 0: Name(s) shown on return
      this.f1040.info.taxPayer.primaryPerson.ssid, // 1: Identifying number
      undefined, // 2: Entity name (pass-through)
      undefined, // 3: Entity identifying number (pass-through)
      undefined, // 4: Family pass-through entity checkbox

      // ── Section A, Line 1, Columns (a)(b)(c) — Rows A-D ───────
      // Each row: donee name/address, vehicle checkbox, VIN, description
      ...sectionATopRows, // 5-20 (4 rows x 4 fields)

      // ── Section A, Line 1, Columns (d)-(i) — Rows A-D ─────────
      // Each row: date contributed, date acquired, how acquired,
      //           donor's cost, FMV, method of FMV
      ...sectionABottomRows, // 21-44 (4 rows x 6 fields)

      // ── Section B, Part I, Line 2 — Property type checkboxes ──
      undefined, // 45: 2a Art ($20,000 or more)
      undefined, // 46: 2b Qualified conservation contribution
      undefined, // 47: 2b(1) Certified historic structure
      undefined, // 48: NPS #
      undefined, // 49: 2c Art (less than $20,000)
      undefined, // 50: 2d Other real estate
      undefined, // 51: 2e Equipment
      undefined, // 52: 2f Securities
      undefined, // 53: 2g Collectibles
      undefined, // 54: 2h Intellectual property
      undefined, // 55: 2i Vehicles
      undefined, // 56: 2j Clothing and household items
      undefined, // 57: 2k Digital assets
      undefined, // 58: 2l Other

      // ── Section B, Part I, Line 3, Columns (a)(b)(c) — Rows A-C
      // Each row: description, physical condition, appraised FMV
      ...this.sectionBTopRows(),

      // ── Section B, Part I, Line 3, Columns (d)-(i) — Rows A-C ─
      // Each row: date acquired, how acquired, donor's cost,
      //           bargain sale amount, qualified conservation basis,
      //           amount claimed as deduction
      ...this.sectionBBottomRows(),

      // ── Page 2 Header ──────────────────────────────────────────
      this.f1040.namesString(), // 86: Name(s) shown on return
      this.f1040.info.taxPayer.primaryPerson.ssid, // 87: Identifying number

      // ── Part II, Lines 4a-4e — Partial Interests ───────────────
      undefined, // 88: 4a Letter identifying property
      undefined, // 89: 4b(1) Deduction for this tax year
      undefined, // 90: 4b(2) Deduction for prior tax years
      undefined, // 91: 4c Donee name
      undefined, // 92: 4c Address
      undefined, // 93: 4c City, state, ZIP
      undefined, // 94: 4d Location of tangible property
      undefined, // 95: 4e Person with actual possession

      // ── Part II, Lines 5a-5c — Yes/No checkboxes ───────────────
      undefined, // 96: 5a Yes (restriction on donee's right)
      undefined, // 97: 5a No
      undefined, // 98: 5b Yes (right to income given to others)
      undefined, // 99: 5b No
      undefined, // 100: 5c Yes (restriction limiting use)
      undefined, // 101: 5c No

      // ── Part III — Taxpayer (Donor) Statement ──────────────────
      undefined, // 102: Statement text (items with appraised value <= $500)

      // ── Part IV — Declaration of Appraiser ─────────────────────
      ...this.appraiserFields(), // 103-108: Appraiser info

      // ── Part V — Donee Acknowledgment ──────────────────────────
      undefined, // 109: Date property received
      undefined, // 110: Unrelated use — Yes checkbox
      undefined, // 111: Unrelated use — No checkbox
      undefined, // 112: Name of charitable organization (donee)
      undefined, // 113: Employer identification number
      undefined, // 114: Address
      undefined, // 115: City, town, state, ZIP
      undefined // 116: Authorized signature date
    ]
  }
}
