import { Information, Asset } from 'ustaxes/core/data'

/**
 * Converts ISO date strings in the incoming JSON payload
 * to JavaScript Date objects, as required by UsTaxes core.
 *
 * Also ensures all required array fields default to [] so
 * that callers don't need to pass every empty array.
 */

type DateStringInformation = Information<string>

const toDate = (s: string | undefined | null): Date | undefined => {
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawInfo = Record<string, any>

export function deserializeInformation(
  rawInput: DateStringInformation
): Information<Date> {
  // Cast to loose type to handle missing fields safely
  const raw = rawInput as RawInfo

  return {
    // Required array fields - default to [] if missing
    f1099s: raw.f1099s ?? [],
    w2s: raw.w2s ?? [],
    realEstate: raw.realEstate ?? [],
    estimatedTaxes: raw.estimatedTaxes ?? [],
    f1098es: raw.f1098es ?? [],
    f3921s: raw.f3921s ?? [],
    scheduleK1Form1065s: raw.scheduleK1Form1065s ?? [],
    credits: raw.credits ?? [],
    stateResidencies: raw.stateResidencies ?? [],
    individualRetirementArrangements: raw.individualRetirementArrangements ?? [],

    // Required non-array fields
    itemizedDeductions: raw.itemizedDeductions ?? undefined,
    questions: raw.questions ?? {},

    // TaxPayer - deserialize date fields
    taxPayer: {
      ...raw.taxPayer,
      dependents: (raw.taxPayer?.dependents ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (dep: any) => ({
          ...dep,
          dateOfBirth: toDate(dep.dateOfBirth) as Date
        })
      ),
      primaryPerson: raw.taxPayer?.primaryPerson
        ? {
            ...raw.taxPayer.primaryPerson,
            dateOfBirth: toDate(raw.taxPayer.primaryPerson.dateOfBirth) as Date
          }
        : undefined,
      spouse: raw.taxPayer?.spouse
        ? {
            ...raw.taxPayer.spouse,
            dateOfBirth: toDate(raw.taxPayer.spouse.dateOfBirth) as Date
          }
        : undefined
    },

    // Required array with Date fields
    healthSavingsAccounts: (raw.healthSavingsAccounts ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hsa: any) => ({
        ...hsa,
        startDate: toDate(hsa.startDate) as Date,
        endDate: toDate(hsa.endDate) as Date
      })
    ),

    // Optional array fields - pass through or default
    scheduleCBusinesses: raw.scheduleCBusinesses,
    f1099necs: raw.f1099necs,
    f1099miscs: raw.f1099miscs,
    f1099gs: raw.f1099gs,
    form1116s: raw.form1116s,
    form8606s: raw.form8606s,
    form8829s: raw.form8829s,
    form8863: raw.form8863,
    form2441: raw.form2441,
    form2210: raw.form2210,
    form5695: raw.form5695,
    form8880: raw.form8880,
    form4562s: raw.form4562s,
    scheduleFData: raw.scheduleFData,
    form2555s: raw.form2555s,
    form8582: raw.form8582,
    form4797: raw.form4797,
    form4952: raw.form4952,
    form8919: raw.form8919,
    form4137: raw.form4137,
    form8283: raw.form8283,
    form8962: raw.form8962,
    form8814s: raw.form8814s,
    scheduleRData: raw.scheduleRData,
    form8801: raw.form8801,
    schedule1AData: raw.schedule1AData,
    refund: raw.refund,

    // Optional scalar fields
    educatorExpenses: raw.educatorExpenses,
    selfEmploymentRetirementContributions: raw.selfEmploymentRetirementContributions,
    selfEmploymentHealthInsurance: raw.selfEmploymentHealthInsurance,
    iraDeduction: raw.iraDeduction,
    extensionPaymentAmount: raw.extensionPaymentAmount,
    gamblingIncome: raw.gamblingIncome,
    cancellationOfDebtIncome: raw.cancellationOfDebtIncome,
    scholarshipIncome: raw.scholarshipIncome,
    section529Distributions: raw.section529Distributions,
    householdEmployeeIncome: raw.householdEmployeeIncome,
    medicaidWaiverPayments: raw.medicaidWaiverPayments,
    strikeBenefits: raw.strikeBenefits,
    stockOptionIncome: raw.stockOptionIncome,
    shortTermCapitalLossCarryover: raw.shortTermCapitalLossCarryover,
    longTermCapitalLossCarryover: raw.longTermCapitalLossCarryover,
    rrtaCompensation: raw.rrtaCompensation,
    rrtaTax: raw.rrtaTax
  } as Information<Date>
}

export function deserializeAssets(
  raw: Array<Asset<string>>
): Asset<Date>[] {
  return (raw ?? []).map((asset) => ({
    ...asset,
    openDate: toDate(asset.openDate) as Date,
    closeDate: toDate(asset.closeDate),
    giftedDate: toDate(asset.giftedDate)
  }))
}
