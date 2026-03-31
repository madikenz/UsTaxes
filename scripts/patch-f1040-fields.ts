/**
 * Patch F1040.ts fields() method for 2025 IRS PDF alignment.
 *
 * The 2025 f1040.pdf has 199 fields (vs 141 in 2024).
 * This script replaces the fields() method with the corrected mapping.
 *
 * Usage: npx ts-node scripts/patch-f1040-fields.ts
 */

import fs from 'fs'
import path from 'path'

const FILE = path.join(__dirname, '../src/forms/Y2025/irsForms/F1040.ts')
let code = fs.readFileSync(FILE, 'utf-8')

// Find the start and end of the fields() method
const startMarker = '  fields = (): Field[] =>'
const endMarker = '    ].map((x) => (x === undefined ? \'\' : x))'

const startIdx = code.indexOf(startMarker)
const endIdx = code.indexOf(endMarker, startIdx)

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find fields() method boundaries')
  process.exit(1)
}

const endOfMethod = endIdx + endMarker.length

// Also need to add helper methods before fields()
// Find the _depFieldMappings method and add our new helpers after it
// Find the blank line right before "  fields = (): Field[]"
let depMappingsEnd = startIdx
// Walk backward to find the blank line
while (depMappingsEnd > 0 && code[depMappingsEnd - 1] !== '\n') depMappingsEnd--
depMappingsEnd-- // skip the newline itself

const helpers = `

  // 2025 dependent text fields: 4 deps × 4 text columns = 16 fields
  _depField2025 = (): Array<string> => {
    const deps = this.info.taxPayer.dependents
    const result: string[] = []
    for (let i = 0; i < 4; i++) {
      if (i < deps.length) {
        const dep = deps[i]
        result.push(
          \`\${dep.firstName} \${dep.lastName}\`,
          dep.ssid,
          dep.relationship,
          ''
        )
      } else {
        result.push('', '', '', '')
      }
    }
    return result
  }

  // 2025 dependent checkboxes: Row5 (4×2) + Row6 (4×2) + Row7 (4×2) = 24 checkboxes
  _depCheckboxes2025 = (): Array<boolean> => {
    const deps = this.info.taxPayer.dependents
    const result: boolean[] = []
    for (let row = 0; row < 3; row++) {
      for (let depIdx = 0; depIdx < 4; depIdx++) {
        if (depIdx < deps.length) {
          result.push(
            this.qualifyingDependents.qualifiesChild(deps[depIdx]),
            this.qualifyingDependents.qualifiesOther(deps[depIdx])
          )
        } else {
          result.push(false, false)
        }
      }
    }
    return result
  }
`

const newFields = `  // 2025 F1040 PDF — 199 fields aligned to IRS f1040.pdf 2025
  fields = (): Field[] =>
    [
      // ══ PAGE 1 (128 fields, 0-127) ══
      // Header
      '',                                                  // [  0] f1_01
      '',                                                  // [  1] f1_02
      '',                                                  // [  2] f1_03
      false,                                               // [  3] c1_1
      false,                                               // [  4] c1_2
      this.info.taxPayer.primaryPerson.firstName,           // [  5] f1_04 first name
      false,                                               // [  6] c1_3
      this.info.taxPayer.primaryPerson.lastName,            // [  7] f1_05 last name
      this.info.taxPayer.primaryPerson.ssid,                // [  8] f1_06 SSN
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.firstName ?? '' : '',  // [  9] f1_07 spouse first
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.lastName ?? '' : '',   // [ 10] f1_08 spouse last
      this.info.taxPayer.spouse?.ssid ?? '',                // [ 11] f1_09 spouse SSN
      this.info.taxPayer.primaryPerson.address.address,     // [ 12] f1_10 address
      false,                                               // [ 13] c1_4  PO box
      this.info.taxPayer.primaryPerson.address.aptNo ?? '', // [ 14] f1_11 apt
      this.info.taxPayer.primaryPerson.address.city,        // [ 15] f1_12 city
      this.info.taxPayer.primaryPerson.address.state,       // [ 16] f1_13 state
      this.info.taxPayer.primaryPerson.address.zip,         // [ 17] f1_14 zip
      '',                                                  // [ 18] f1_15 foreign country
      '',                                                  // [ 19] f1_16 foreign province
      '',                                                  // [ 20] f1_17 foreign postal
      '',                                                  // [ 21] f1_18
      '',                                                  // [ 22] f1_19
      '',                                                  // [ 23] f1_20
      '',                                                  // [ 24] f1_21
      '',                                                  // [ 25] f1_22
      '',                                                  // [ 26] f1_23
      '',                                                  // [ 27] f1_24
      '',                                                  // [ 28] f1_25
      '',                                                  // [ 29] f1_26
      '',                                                  // [ 30] f1_27
      false,                                               // [ 31] c1_5  campaign you
      false,                                               // [ 32] c1_6  campaign spouse
      this.info.taxPayer.filingStatus === FilingStatus.S,   // [ 33] c1_7  Single
      this.info.taxPayer.filingStatus === FilingStatus.MFJ, // [ 34] c1_8  MFJ
      this.info.taxPayer.filingStatus === FilingStatus.MFS, // [ 35] c1_8[1] MFS
      this.info.taxPayer.filingStatus === FilingStatus.HOH, // [ 36] c1_8[2] HOH
      this.info.taxPayer.filingStatus === FilingStatus.MFS
        ? this.spouseFullName() : '',                      // [ 37] f1_28 MFS spouse name
      this.info.taxPayer.filingStatus === FilingStatus.W,   // [ 38] c1_8  QSS
      false,                                               // [ 39] c1_8[1] nonresident
      '',                                                  // [ 40] f1_29 QSS deceased
      this.info.questions.CRYPTO ?? false,                  // [ 41] c1_9  digital assets yes
      '',                                                  // [ 42] f1_30
      !(this.info.questions.CRYPTO ?? true),                // [ 43] c1_10 digital assets no
      false,                                               // [ 44] c1_10[1]
      this.info.taxPayer.primaryPerson.isTaxpayerDependent, // [ 45] c1_11 you as dependent
      // Dependent text fields (4 deps × 4 cols = 16)       // [46-61]
      ...this._depField2025(),
      // Dependent checkboxes (3 rows × 4 deps × 2 = 24)   // [62-85]
      ...this._depCheckboxes2025(),
      this.info.taxPayer.dependents.length > 4,             // [ 86] c1_32 more dependents
      // Income
      this.l1a(),                                          // [ 87] f1_47 line 1a
      this.l1b(),                                          // [ 88] f1_48
      this.l1c(),                                          // [ 89] f1_49
      this.l1d(),                                          // [ 90] f1_50
      this.l1e(),                                          // [ 91] f1_51
      this.l1f(),                                          // [ 92] f1_52
      this.l1g(),                                          // [ 93] f1_53
      this.l1h(),                                          // [ 94] f1_54
      this.l1i(),                                          // [ 95] f1_55
      this.l1z(),                                          // [ 96] f1_56
      this.l2a(),                                          // [ 97] f1_57
      this.l2b(),                                          // [ 98] f1_58
      this.l3a(),                                          // [ 99] f1_59
      this.l3b(),                                          // [100] f1_60
      this.l4a(),                                          // [101] f1_61
      this.bornBeforeDate(),                               // [102] c1_33
      this.blind(),                                        // [103] c1_34
      this.l4b(),                                          // [104] f1_62
      this.l5a(),                                          // [105] f1_63
      this.spouseBeforeDate(),                             // [106] c1_35
      this.spouseBlind(),                                  // [107] c1_36
      false,                                               // [108] c1_37 spouse itemizes
      this.l5b(),                                          // [109] f1_64
      this.l6a(),                                          // [110] f1_65
      this.l6b(),                                          // [111] f1_66
      this.l6c(),                                          // [112] c1_38
      this.l7Box(),                                        // [113] c1_39
      false,                                               // [114] c1_40
      this.l7(),                                           // [115] f1_67
      this.l8(),                                           // [116] f1_68
      this.l9(),                                           // [117] f1_69
      false,                                               // [118] c1_41
      false,                                               // [119] c1_42
      this.l10(),                                          // [120] f1_70
      false,                                               // [121] c1_43
      false,                                               // [122] c1_44
      this.l11(),                                          // [123] f1_71 AGI
      this.l12(),                                          // [124] f1_72 deductions
      this.l13(),                                          // [125] f1_73 QBI
      this.l14(),                                          // [126] f1_74
      this.l15(),                                          // [127] f1_75 taxable income
      // ══ PAGE 2 (71 fields, 128-198) ══
      '',                                                  // [128] f2_01 name header
      this.f8814Box(),                                     // [129] c2_1
      this.f4972Box(),                                     // [130] c2_2
      this.otherFormBox(),                                 // [131] c2_3
      false,                                               // [132] c2_4
      false,                                               // [133] c2_5
      false,                                               // [134] c2_6
      false,                                               // [135] c2_7
      false,                                               // [136] c2_8
      this.l16(),                                          // [137] f2_02 tax
      this.l17(),                                          // [138] f2_03
      this.l18(),                                          // [139] f2_04
      this.l19(),                                          // [140] f2_05
      this.l20(),                                          // [141] f2_06
      false,                                               // [142] c2_9
      false,                                               // [143] c2_10
      false,                                               // [144] c2_11
      this.l21(),                                          // [145] f2_07
      this.l22(),                                          // [146] f2_08
      this.l23(),                                          // [147] f2_09
      this.l24(),                                          // [148] f2_10 total tax
      this.l25a(),                                         // [149] f2_11
      this.l25b(),                                         // [150] f2_12
      this.l25c(),                                         // [151] f2_13
      this.l25d(),                                         // [152] f2_14
      this.l26(),                                          // [153] f2_15
      this.l27(),                                          // [154] f2_16
      this.l28(),                                          // [155] f2_17
      this.l29(),                                          // [156] f2_18
      undefined,                                           // [157] f2_19 line 30
      this.l31(),                                          // [158] f2_20
      this.l32(),                                          // [159] f2_21
      this.l33(),                                          // [160] f2_22
      this.l34(),                                          // [161] f2_23
      this.f8888 !== undefined,                            // [162] c2_12 form 8888
      false,                                               // [163] c2_13
      false,                                               // [164] c2_14
      this.l35a(),                                         // [165] f2_24 refund
      this.info.refund?.routingNumber ?? '',                // [166] f2_25 routing
      this.l36(),                                          // [167] f2_26
      this.l37(),                                          // [168] f2_27 owed
      this.l38(),                                          // [169] f2_28 penalty
      '',                                                  // [170] f2_29
      '',                                                  // [171] f2_30
      this.info.refund?.accountType === AccountType.checking, // [172] c2_15 checking
      this.info.refund?.accountNumber ?? '',                // [173] f2_31 account
      this.info.refund?.routingNumber ?? '',                // [174] f2_32 routing dup
      this.info.refund?.accountType === AccountType.checking, // [175] c2_16 checking
      this.info.refund?.accountType === AccountType.savings,  // [176] c2_16[1] savings
      this.info.refund?.accountNumber ?? '',                // [177] f2_33 account dup
      '',                                                  // [178] f2_34 third party name
      '',                                                  // [179] f2_35 phone
      '',                                                  // [180] f2_36 pin
      false,                                               // [181] c2_17 third party yes
      false,                                               // [182] c2_17[1] no
      this.occupation(PersonRole.PRIMARY),                  // [183] f2_37 occupation
      '',                                                  // [184] f2_38 identity pin
      this.occupation(PersonRole.SPOUSE),                   // [185] f2_39 spouse occ
      '',                                                  // [186] f2_40 spouse pin
      this.info.taxPayer.contactPhoneNumber ?? '',          // [187] f2_41 phone
      this.info.taxPayer.contactEmail ?? '',                // [188] f2_42 email
      '',                                                  // [189] f2_43
      '',                                                  // [190] f2_44
      '',                                                  // [191] f2_45
      '',                                                  // [192] f2_46
      '',                                                  // [193] f2_47 preparer name
      false,                                               // [194] c2_18 self-employed
      '',                                                  // [195] f2_48 PTIN
      '',                                                  // [196] f2_49 firm name
      '',                                                  // [197] f2_50 firm EIN
      ''                                                   // [198] f2_51 firm address
    ].map((x) => (x === undefined ? '' : x))`

// Replace: insert helpers before fields, then new fields method
const before = code.substring(0, depMappingsEnd)
const after = code.substring(endOfMethod)

code = before + '\n' + helpers + '\n' + newFields + after

fs.writeFileSync(FILE, code)
console.log('✅ F1040.ts fields() patched for 2025 PDF (199 fields)')
console.log('   Added _depField2025() and _depCheckboxes2025() helpers')
