import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form4952Data } from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Form 4952 — Investment Interest Expense Deduction
 *
 * Limits the deduction for investment interest expense to the amount
 * of net investment income. Excess investment interest expense is
 * carried forward to the next tax year.
 *
 * The deductible amount (line 8) flows to Schedule A, line 9.
 * The election to include capital gains (line 4g) affects
 * Schedule D and the Qualified Dividends and Capital Gains worksheet.
 *
 * PDF field order (17 fields):
 *   0: Name(s) shown on return
 *   1: Identifying number (SSN)
 *   2: Line 1  — Investment interest expense
 *   3: Line 2  — Disallowed from prior year
 *   4: Line 3  — Total (1 + 2)
 *   5: Line 4a — Gross income from property held for investment
 *   6: Line 4b — Qualified dividends included on 4a
 *   7: Line 4c — 4a minus 4b
 *   8: Line 4d — Net gain from disposition of investment property
 *   9: Line 4e — Smaller of 4d or net capital gain
 *  10: Line 4f — 4d minus 4e
 *  11: Line 4g — Election to include in investment income
 *  12: Line 4h — Investment income (4c + 4f + 4g)
 *  13: Line 5  — Investment expenses
 *  14: Line 6  — Net investment income (4h - 5)
 *  15: Line 7  — Disallowed carried forward (3 - 6)
 *  16: Line 8  — Investment interest expense deduction
 *
 * Reference: 2024 Form 4952 instructions
 */
export default class F4952 extends F1040Attachment {
  tag: FormTag = 'f4952'
  sequenceIndex = 51

  readonly data: Form4952Data

  constructor(f1040: F1040, data: Form4952Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.f1040.info.form4952 !== undefined

  // Line 1: Investment interest expense paid or accrued during the year
  l1 = (): number => this.data.investmentInterestExpense

  // Line 2: Disallowed investment interest expense from prior year
  l2 = (): number => this.data.disallowedPriorYear

  // Line 3: Total investment interest expense (line 1 + line 2)
  l3 = (): number => this.l1() + this.l2()

  // Line 4a: Gross income from property held for investment
  // (interest, ordinary dividends, annuities, royalties NOT derived from
  // a trade or business — excludes net gain from disposition)
  l4a = (): number => this.data.netInvestmentIncome

  // Line 4b: Qualified dividends included on line 4a (simplified: 0)
  l4b = (): number => 0

  // Line 4c: Subtract line 4b from line 4a
  l4c = (): number => Math.max(0, this.l4a() - this.l4b())

  // Line 4d: Net gain from the disposition of property held for investment
  // (from Schedule D, if applicable — simplified to 0)
  l4d = (): number => 0

  // Line 4e: Enter the smaller of line 4d or your net capital gain from
  // the disposition of property held for investment
  l4e = (): number | undefined => undefined

  // Line 4f: Subtract line 4e from line 4d
  l4f = (): number => this.l4d() - (this.l4e() ?? 0)

  // Line 4g: Enter the amount from lines 4b and 4e that you elect to
  // include in investment income (election amount)
  l4g = (): number | undefined => {
    if (!this.data.electToIncludeCapGains) return undefined
    return this.data.electedCapGainsAmount ?? 0
  }

  // Line 4h: Investment income. Add lines 4c, 4f, and 4g
  l4h = (): number => this.l4c() + this.l4f() + (this.l4g() ?? 0)

  // Line 5: Investment expenses
  l5 = (): number => 0

  // Line 6: Net investment income. Subtract line 5 from line 4h.
  // If zero or less, enter 0.
  l6 = (): number => Math.max(0, this.l4h() - this.l5())

  // Line 7: Disallowed investment interest expense to be carried forward.
  // Subtract line 6 from line 3. If zero or less, enter 0.
  l7 = (): number => Math.max(0, this.l3() - this.l6())

  // Line 8: Investment interest expense deduction.
  // Enter the smaller of line 3 or line 6.
  l8 = (): number | undefined => {
    const totalExpense = this.l3()
    if (totalExpense <= 0) return undefined
    return Math.min(totalExpense, this.l6())
  }

  // Alias for carryforward logic
  carryforward = (): number => this.l7()

  fields = (): Field[] => [
    this.f1040.namesString(),                         // 0: Name
    this.f1040.info.taxPayer.primaryPerson.ssid,      // 1: SSN
    this.l1(),                                        // 2: Line 1
    this.l2(),                                        // 3: Line 2
    this.l3(),                                        // 4: Line 3
    this.l4a(),                                       // 5: Line 4a
    this.l4b(),                                       // 6: Line 4b
    this.l4c(),                                       // 7: Line 4c
    this.l4d(),                                       // 8: Line 4d
    this.l4e(),                                       // 9: Line 4e
    this.l4f(),                                       // 10: Line 4f
    this.l4g(),                                       // 11: Line 4g
    this.l4h(),                                       // 12: Line 4h
    this.l5(),                                        // 13: Line 5
    this.l6(),                                        // 14: Line 6
    this.l7(),                                        // 15: Line 7
    this.l8()                                         // 16: Line 8
  ]
}
