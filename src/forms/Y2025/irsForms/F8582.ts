import { MatrixRow } from './ScheduleE'
import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form8582Data, PassiveActivity } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'

/**
 * Form 8582 — Passive Activity Loss Limitations
 *
 * Limits the amount of losses from passive activities that can be
 * deducted against nonpassive income. Special $25,000 allowance
 * for active participation in rental real estate activities,
 * phased out for MAGI > $100,000 (fully at $150,000).
 *
 * Referenced from Schedule E line 22.
 * Reference: 2024 Form 8582 instructions (191 Excel formulas)
 */
export default class F8582 extends F1040Attachment {
  tag: FormTag = 'f8582'
  sequenceIndex = 53

  readonly data?: Form8582Data

  constructor(f1040: F1040) {
    super(f1040)
    this.data = f1040.info.form8582
  }

  isNeeded = (): boolean => {
    // Need 8582 if there are rental properties with losses
    // or if form8582 data explicitly provided
    if (this.data !== undefined) return true
    return this.f1040.info.realEstate.some(
      (p) => p.rentReceived < this.totalExpenses(p)
    )
  }

  private totalExpenses = (p: { expenses: Record<string, number> }): number =>
    Object.values(p.expenses).reduce((s, v) => s + v, 0)

  // --- Part I: 2024 Passive Activity Loss ---

  // Rental real estate activities with active participation (Worksheet 1)
  // Line 1a: Net income from all rental real estate with active participation
  l1a = (): number => {
    if (this.data === undefined) {
      // Use Schedule E rental data
      const nets = this.f1040.scheduleE.rentalNet()
      return sumFields(nets.filter((v) => v !== undefined && v > 0))
    }
    return this.data.activities
      .filter((a) => a.isRentalRealEstate && a.activeParticipation)
      .reduce((sum, a) => sum + a.currentYearIncome, 0)
  }

  // Line 1b: Net loss from all rental real estate with active participation
  l1b = (): number => {
    if (this.data === undefined) {
      const nets = this.f1040.scheduleE.rentalNet()
      return Math.abs(
        sumFields(nets.filter((v) => v !== undefined && v < 0))
      )
    }
    return this.data.activities
      .filter((a) => a.isRentalRealEstate && a.activeParticipation)
      .reduce((sum, a) => sum + a.currentYearLoss, 0)
  }

  // Line 1c: Prior year unallowed losses
  l1c = (): number => {
    if (this.data === undefined) return 0
    return this.data.activities
      .filter((a) => a.isRentalRealEstate && a.activeParticipation)
      .reduce((sum, a) => sum + a.priorYearUnallowedLoss, 0)
  }

  // Line 1d: Combine lines 1a, 1b, and 1c
  l1d = (): number => this.l1a() - this.l1b() - this.l1c()

  // Line 2a-2d: All other passive activities (commercial rental, etc.)
  l2a = (): number => {
    if (this.data === undefined) return 0
    return this.data.activities
      .filter((a) => !(a.isRentalRealEstate && a.activeParticipation))
      .reduce((sum, a) => sum + a.currentYearIncome, 0)
  }

  l2b = (): number => {
    if (this.data === undefined) return 0
    return this.data.activities
      .filter((a) => !(a.isRentalRealEstate && a.activeParticipation))
      .reduce((sum, a) => sum + a.currentYearLoss, 0)
  }

  l2c = (): number => {
    if (this.data === undefined) return 0
    return this.data.activities
      .filter((a) => !(a.isRentalRealEstate && a.activeParticipation))
      .reduce((sum, a) => sum + a.priorYearUnallowedLoss, 0)
  }

  l2d = (): number => this.l2a() - this.l2b() - this.l2c()

  // Line 3: Combine lines 1d and 2d. If >= 0, all losses are allowed.
  l3 = (): number => this.l1d() + this.l2d()

  // --- Part II: Special Allowance for Rental Real Estate ($25,000) ---

  // Line 5: Net loss from active rental real estate = smaller of loss or line 3 (abs)
  l5 = (): number => {
    if (this.l3() >= 0) return 0 // No net loss
    if (this.l1d() >= 0) return 0 // No rental loss
    return Math.min(Math.abs(this.l1d()), Math.abs(this.l3()))
  }

  // Line 6: Modified AGI for phaseout
  // Note: avoid calling f1040.l11() here to prevent circular dependency,
  // since F8582 results may feed back into F1040 income via Schedule E.
  // Approximate MAGI from non-passive income sources when not explicitly provided.
  l6 = (): number => {
    if (this.data?.modifiedAGI !== undefined) return this.data.modifiedAGI
    // Approximate MAGI without triggering circular dependency through Schedule E.
    // Sum wages, interest, dividends, pensions, IRA, capital gains,
    // Schedule C/F net, and taxable Social Security.
    return sumFields([
      this.f1040.wages(),
      this.f1040.l2b(),
      this.f1040.l3b(),
      this.f1040.l4b(),
      this.f1040.l5b(),
      this.f1040.l6b(),
      this.f1040.l7(),
      this.f1040.scheduleCNetProfit(),
      this.f1040.scheduleFNetProfit()
    ])
  }

  // Line 7: $150,000 ($75,000 if MFS)
  l7 = (): number =>
    this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS ? 75000 : 150000

  // Line 8: Subtract line 6 from line 7. If >= $100,000, special allowance = 0
  l8 = (): number => Math.max(0, this.l7() - this.l6())

  // Line 9: Multiply line 8 by 50%
  l9 = (): number => Math.round(this.l8() * 0.5 * 100) / 100

  // Line 10: Maximum special allowance ($25,000)
  l10 = (): number => 25000

  // Line 11: Smaller of line 9 or line 10
  l11 = (): number => Math.min(this.l9(), this.l10())

  // Line 12: Allowed rental real estate loss (smaller of line 5 or line 11)
  l12 = (): number => Math.min(this.l5(), this.l11())

  // --- Part III: Total Allowed Losses ---

  // Line 15: Total loss allowed = line 12 (from special allowance)
  // plus any net passive income offsetting losses
  l15 = (): number => {
    if (this.l3() >= 0) return Math.abs(this.l3()) // All losses allowed
    return this.l12()
  }

  // Line 16: Total loss from line 3 (absolute value)
  l16 = (): number => Math.abs(Math.min(0, this.l3()))

  // Deductible rental real estate loss for Schedule E line 22
  // Returns the allowed rental losses as a MatrixRow (negative values)
  deductibleRealEstateLossAfterLimitation = (): MatrixRow => {
    const nets = this.f1040.scheduleE.rentalNet()
    const totalLoss = sumFields(
      nets.filter((v) => v !== undefined && v < 0)
    )

    if (totalLoss >= 0) {
      return [undefined, undefined, undefined]
    }

    const absTotalLoss = Math.abs(totalLoss)
    const allowedLoss = this.l15()

    // Proportionally allocate allowed loss across properties
    return nets.map((v) => {
      if (v === undefined || v >= 0) return undefined
      if (absTotalLoss === 0) return undefined
      // Proportional share of allowed loss
      const proportion = Math.abs(v) / absTotalLoss
      return -Math.round(allowedLoss * proportion * 100) / 100
    }) as MatrixRow
  }

  // Helper: get rental real estate activities with active participation (Part IV)
  private rentalActiveActivities = (): PassiveActivity[] =>
    this.data?.activities.filter(
      (a) => a.isRentalRealEstate && a.activeParticipation
    ) ?? []

  // Helper: get all other passive activities (Part V)
  private otherPassiveActivities = (): PassiveActivity[] =>
    this.data?.activities.filter(
      (a) => !(a.isRentalRealEstate && a.activeParticipation)
    ) ?? []

  // Helper: net income/loss for a single activity
  private activityNet = (a: PassiveActivity): number =>
    a.currentYearIncome - a.currentYearLoss - a.priorYearUnallowedLoss

  // Helper: form reference for the activity
  private activityFormRef = (a: PassiveActivity): string =>
    a.isRentalRealEstate ? 'Sch E' : 'Sch E'

  // Part VI (Worksheet 5): Allocate special allowance among rental RE activities
  // with losses. 5 rows × 6 cols + 4 totals = 34 fields.
  // Cols: (a) name, (b) form, (c) net loss, (d) ratio, (e) unallowed, (f) allowed
  private partVIFields = (): Field[] => {
    const losers = this.rentalActiveActivities().filter(
      (a) => this.activityNet(a) < 0
    )
    const totalLoss = losers.reduce(
      (s, a) => s + Math.abs(this.activityNet(a)),
      0
    )
    const specialAllowance = this.l12()
    const unallowedTotal = Math.max(0, totalLoss - specialAllowance)

    const rows: Field[] = []
    for (let i = 0; i < 5; i++) {
      const a = losers[i]
      if (a) {
        const loss = Math.abs(this.activityNet(a))
        const ratio =
          totalLoss > 0
            ? Math.round((loss / totalLoss) * 10000) / 10000
            : 0
        const unallowed = Math.round(unallowedTotal * ratio * 100) / 100
        const allowed = Math.round((loss - unallowed) * 100) / 100
        rows.push(
          a.name,
          this.activityFormRef(a),
          loss,
          ratio,
          unallowed,
          allowed
        )
      } else {
        rows.push(undefined, undefined, undefined, undefined, undefined, undefined)
      }
    }
    const allowedTotal = Math.min(specialAllowance, totalLoss)
    rows.push(
      totalLoss > 0 ? totalLoss : undefined,
      losers.length > 0 ? 1.0 : undefined,
      unallowedTotal > 0 ? unallowedTotal : undefined,
      allowedTotal > 0 ? allowedTotal : undefined
    )
    return rows
  }

  // Part VII (Worksheet 6): Allocate unallowed losses among ALL passive activities
  // 5 rows × 5 cols + 3 totals = 28 fields.
  // Cols: (a) name, (b) form, (c) loss, (d) ratio, (e) unallowed
  private partVIIFields = (): Field[] => {
    const allActivities = [
      ...this.rentalActiveActivities(),
      ...this.otherPassiveActivities()
    ]
    const losers = allActivities.filter((a) => this.activityNet(a) < 0)
    const totalLoss = losers.reduce(
      (s, a) => s + Math.abs(this.activityNet(a)),
      0
    )
    const totalAllowed = this.l15()
    const totalUnallowed = Math.max(0, totalLoss - totalAllowed)

    const rows: Field[] = []
    for (let i = 0; i < 5; i++) {
      const a = losers[i]
      if (a) {
        const loss = Math.abs(this.activityNet(a))
        const ratio =
          totalLoss > 0
            ? Math.round((loss / totalLoss) * 10000) / 10000
            : 0
        const unallowed = Math.round(totalUnallowed * ratio * 100) / 100
        rows.push(a.name, this.activityFormRef(a), loss, ratio, unallowed)
      } else {
        rows.push(undefined, undefined, undefined, undefined, undefined)
      }
    }
    rows.push(
      totalLoss > 0 ? totalLoss : undefined,
      losers.length > 0 ? 1.0 : undefined,
      totalUnallowed > 0 ? totalUnallowed : undefined
    )
    return rows
  }

  // Part VIII (Worksheet 7): Allowed losses per activity
  // 5 rows × 5 cols + 3 totals = 28 fields.
  // Cols: (a) name, (b) form, (c) loss, (d) ratio, (e) allowed
  private partVIIIFields = (): Field[] => {
    const allActivities = [
      ...this.rentalActiveActivities(),
      ...this.otherPassiveActivities()
    ]
    const losers = allActivities.filter((a) => this.activityNet(a) < 0)
    const totalLoss = losers.reduce(
      (s, a) => s + Math.abs(this.activityNet(a)),
      0
    )
    const totalAllowed = this.l15()
    const totalUnallowed = Math.max(0, totalLoss - totalAllowed)

    const rows: Field[] = []
    for (let i = 0; i < 5; i++) {
      const a = losers[i]
      if (a) {
        const loss = Math.abs(this.activityNet(a))
        const ratio =
          totalLoss > 0
            ? Math.round((loss / totalLoss) * 10000) / 10000
            : 0
        const unallowed = Math.round(totalUnallowed * ratio * 100) / 100
        const allowed = Math.round((loss - unallowed) * 100) / 100
        rows.push(a.name, this.activityFormRef(a), loss, ratio, allowed)
      } else {
        rows.push(undefined, undefined, undefined, undefined, undefined)
      }
    }
    const totalAllowedCapped = Math.min(totalAllowed, totalLoss)
    rows.push(
      totalLoss > 0 ? totalLoss : undefined,
      losers.length > 0 ? 1.0 : undefined,
      totalAllowedCapped > 0 ? totalAllowedCapped : undefined
    )
    return rows
  }

  /**
   * PDF field layout (205 fields total):
   *
   * Page 1 (fields 0-53):
   *   0-1:   Name, SSN
   *   2-10:  Part I lines 1a-3
   *   11-16: Part II lines 4-9
   *   17-18: Part III lines 10-11
   *   19-53: Part IV table (5 activity rows x 6 cols + 1 total row x 5 cols)
   *
   * Page 2 (fields 54-178):
   *   54-88:   Part V table (5 activity rows x 6 cols + 1 total row x 5 cols)
   *   89-122:  Part VI table (5 rows x 6 cols + totals x 4)
   *   123-150: Part VII table (5 rows x 5 cols + totals x 3)
   *   151-178: Part VIII table (5 rows x 5 cols + totals x 3)
   *
   * Page 3 (fields 179-204):
   *   179:     Part IX activity name
   *   180-186: Part IX sub-form 1 (form/sched + 6 value fields)
   *   187-193: Part IX sub-form 2 (form/sched + 6 value fields)
   *   194-200: Part IX sub-form 3 (form/sched + 6 value fields)
   *   201-204: Part IX totals (4 fields)
   */
  fields = (): Field[] => {
    const rentalActivities = this.rentalActiveActivities()
    const otherActivities = this.otherPassiveActivities()

    // Build Part IV rows: rental real estate with active participation
    // Each row: name, col(a) net income, col(b) net loss,
    //           col(c) prior year unallowed, col(d) gain, col(e) loss
    const partIVRows: Field[] = []
    for (let i = 0; i < 5; i++) {
      const a = rentalActivities[i]
      if (a) {
        const net =
          a.currentYearIncome - a.currentYearLoss - a.priorYearUnallowedLoss
        partIVRows.push(
          a.name,                                     // name
          a.currentYearIncome > 0                     // col(a) net income
            ? a.currentYearIncome
            : undefined,
          a.currentYearLoss > 0                       // col(b) net loss
            ? a.currentYearLoss
            : undefined,
          a.priorYearUnallowedLoss > 0                // col(c) prior year unallowed
            ? a.priorYearUnallowedLoss
            : undefined,
          net > 0 ? net : undefined,                  // col(d) overall gain
          net < 0 ? Math.abs(net) : undefined         // col(e) overall loss
        )
      } else {
        partIVRows.push(
          undefined, undefined, undefined,
          undefined, undefined, undefined
        )
      }
    }

    // Part IV totals row: col(a), col(b), col(c), col(d), col(e)
    const partIVTotals: Field[] = [
      this.l1a() > 0 ? this.l1a() : undefined,       // col(a) total
      this.l1b() > 0 ? this.l1b() : undefined,       // col(b) total
      this.l1c() > 0 ? this.l1c() : undefined,       // col(c) total
      undefined,                                       // col(d) total gain
      undefined                                        // col(e) total loss
    ]

    // Build Part V rows: all other passive activities
    const partVRows: Field[] = []
    for (let i = 0; i < 5; i++) {
      const a = otherActivities[i]
      if (a) {
        const net =
          a.currentYearIncome - a.currentYearLoss - a.priorYearUnallowedLoss
        partVRows.push(
          a.name,
          a.currentYearIncome > 0
            ? a.currentYearIncome
            : undefined,
          a.currentYearLoss > 0
            ? a.currentYearLoss
            : undefined,
          a.priorYearUnallowedLoss > 0
            ? a.priorYearUnallowedLoss
            : undefined,
          net > 0 ? net : undefined,
          net < 0 ? Math.abs(net) : undefined
        )
      } else {
        partVRows.push(
          undefined, undefined, undefined,
          undefined, undefined, undefined
        )
      }
    }

    // Part V totals row: col(a), col(b), col(c), col(d), col(e)
    const partVTotals: Field[] = [
      this.l2a() > 0 ? this.l2a() : undefined,
      this.l2b() > 0 ? this.l2b() : undefined,
      this.l2c() > 0 ? this.l2c() : undefined,
      undefined,
      undefined
    ]

    // Part VI: Special Allowance Allocation (Worksheet 5)
    const partVI: Field[] = this.partVIFields()

    // Part VII: Unallowed Loss Allocation (Worksheet 6)
    const partVII: Field[] = this.partVIIFields()

    // Part VIII: Allowed Losses (Worksheet 7)
    const partVIII: Field[] = this.partVIIIFields()

    // Part IX: Activities on 2+ forms/schedules (Worksheets 8/9)
    // Requires knowing which activities span multiple forms — not modeled
    const partIX: Field[] = Array(1 + 3 * 7 + 4).fill(undefined)

    return [
      // --- Page 1 ---
      // 0-1: Header
      this.f1040.namesString(),                        // 0: Name
      this.f1040.info.taxPayer.primaryPerson.ssid,     // 1: SSN

      // 2-10: Part I — Passive Activity Loss
      this.l1a(),                                      // 2: Line 1a
      this.l1b(),                                      // 3: Line 1b
      this.l1c(),                                      // 4: Line 1c
      this.l1d(),                                      // 5: Line 1d
      this.l2a(),                                      // 6: Line 2a
      this.l2b(),                                      // 7: Line 2b
      this.l2c(),                                      // 8: Line 2c
      this.l2d(),                                      // 9: Line 2d
      this.l3(),                                       // 10: Line 3

      // 11-16: Part II — Special Allowance
      this.l5(),                                       // 11: Line 4 (smaller of 1d or 3 loss)
      this.l7(),                                       // 12: Line 5 ($150,000)
      this.l6(),                                       // 13: Line 6 (modified AGI)
      this.l8(),                                       // 14: Line 7 (line 5 minus line 6)
      Math.min(this.l9(), this.l10()),                 // 15: Line 8 (50% of line 7, max $25k)
      this.l12(),                                      // 16: Line 9 (smaller of line 4 or 8)

      // 17-18: Part III — Total Losses Allowed
      this.l1a() + this.l2a(),                         // 17: Line 10 (income from 1a + 2a)
      this.l15(),                                      // 18: Line 11 (total allowed losses)

      // 19-53: Part IV — Rental RE with Active Participation (5 rows + totals)
      ...partIVRows,                                   // 19-48: 5 activity rows x 6 cols
      ...partIVTotals,                                 // 49-53: totals row x 5 cols

      // --- Page 2 ---
      // 54-88: Part V — All Other Passive Activities (5 rows + totals)
      ...partVRows,                                    // 54-83: 5 activity rows x 6 cols
      ...partVTotals,                                  // 84-88: totals row x 5 cols

      // 89-122: Part VI — Special Allowance Allocation (Worksheet 5)
      ...partVI,                                       // 89-122: 5 rows x 6 + 4 totals

      // 123-150: Part VII — Unallowed Loss Allocation (Worksheet 6)
      ...partVII,                                      // 123-150: 5 rows x 5 + 3 totals

      // 151-178: Part VIII — Allowed Losses (Worksheet 7)
      ...partVIII,                                     // 151-178: 5 rows x 5 + 3 totals

      // --- Page 3 ---
      // 179-204: Part IX — Activities on Two+ Forms/Schedules (Worksheets 8/9)
      ...partIX                                        // 179-204: 1 + 3*7 + 4 = 26 fields
    ]
  }
}
