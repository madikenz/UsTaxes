/**
 * UsTaxes Form Field Audit
 *
 * Compares the fields() array in each TypeScript form class against
 * the actual PDF form fields. Reports misalignments, missing fields,
 * and type mismatches (boolean vs text).
 *
 * Usage: npx ts-node scripts/audit-form-fields.ts
 */

import { PDFDocument, PDFField, PDFTextField, PDFCheckBox, PDFRadioGroup } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const FORMS_DIR = path.join(__dirname, '../public/forms/Y2025/irs')
const CODE_DIR = path.join(__dirname, '../src/forms/Y2025/irsForms')

// Map form tags to code file names and PDF file names
const FORM_MAP: Array<{
  tag: string
  codeFile: string
  pdfFile: string
  label: string
}> = [
  { tag: 'f1040', codeFile: 'F1040.ts', pdfFile: 'f1040.pdf', label: 'Form 1040' },
  { tag: 'f1040s1', codeFile: 'Schedule1.ts', pdfFile: 'f1040s1.pdf', label: 'Schedule 1' },
  { tag: 'f1040s2', codeFile: 'Schedule2.ts', pdfFile: 'f1040s2.pdf', label: 'Schedule 2' },
  { tag: 'f1040s3', codeFile: 'Schedule3.ts', pdfFile: 'f1040s3.pdf', label: 'Schedule 3' },
  { tag: 'f1040sa', codeFile: 'ScheduleA.ts', pdfFile: 'f1040sa.pdf', label: 'Schedule A' },
  { tag: 'f1040sb', codeFile: 'ScheduleB.ts', pdfFile: 'f1040sb.pdf', label: 'Schedule B' },
  { tag: 'f1040sd', codeFile: 'ScheduleD.ts', pdfFile: 'f1040sd.pdf', label: 'Schedule D' },
  { tag: 'f1040se', codeFile: 'ScheduleE.ts', pdfFile: 'f1040se.pdf', label: 'Schedule E' },
  { tag: 'f1040sse', codeFile: 'ScheduleSE.ts', pdfFile: 'f1040sse.pdf', label: 'Schedule SE' },
  { tag: 'f8889', codeFile: 'F8889.ts', pdfFile: 'f8889.pdf', label: 'Form 8889 (HSA)' },
  { tag: 'f8959', codeFile: 'F8959.ts', pdfFile: 'f8959.pdf', label: 'Form 8959 (Addl Medicare)' },
  { tag: 'f8960', codeFile: 'F8960.ts', pdfFile: 'f8960.pdf', label: 'Form 8960 (NIIT)' },
  { tag: 'f1116', codeFile: 'F1116.ts', pdfFile: 'f1116.pdf', label: 'Form 1116 (FTC)' },
  { tag: 'f6251', codeFile: 'F6251.ts', pdfFile: 'f6251.pdf', label: 'Form 6251 (AMT)' },
  { tag: 'f8949', codeFile: 'F8949.ts', pdfFile: 'f8949.pdf', label: 'Form 8949 (Cap Gains)' },
  { tag: 'f8995', codeFile: 'F8995.ts', pdfFile: 'f8995.pdf', label: 'Form 8995 (QBI)' },
]

interface PdfFieldInfo {
  index: number
  name: string
  type: 'text' | 'checkbox' | 'radio' | 'other'
  fullName: string
}

interface CodeFieldInfo {
  index: number
  comment: string | null
  isBoolean: boolean
  isString: boolean
  isNumber: boolean
  isUndefined: boolean
  rawLine: string
}

async function getPdfFields(pdfPath: string): Promise<PdfFieldInfo[]> {
  const bytes = fs.readFileSync(pdfPath)
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  return form.getFields().map((field: PDFField, index: number) => ({
    index,
    name: field.getName().replace(/form1\[0\]\.(Page\d+)\[0\]\./, '$1.'),
    type: field instanceof PDFTextField ? 'text'
      : field instanceof PDFCheckBox ? 'checkbox'
      : field instanceof PDFRadioGroup ? 'radio'
      : 'other',
    fullName: field.getName(),
  }))
}

function getCodeFieldCount(codePath: string): { total: number; fields: CodeFieldInfo[] } {
  if (!fs.existsSync(codePath)) return { total: 0, fields: [] }

  const code = fs.readFileSync(codePath, 'utf-8')

  // Find the fields() method and extract its array
  const fieldsMatch = code.match(/fields\s*=\s*\(\):\s*Field\[\]\s*=>\s*\[([\s\S]*?)\n\s*\]/m)
    || code.match(/fields\s*\(\):\s*Field\[\]\s*\{[\s\S]*?return\s*\[([\s\S]*?)\n\s*\]/m)

  if (!fieldsMatch) return { total: -1, fields: [] }

  const arrayContent = fieldsMatch[1]
  const lines = arrayContent.split('\n')

  const fields: CodeFieldInfo[] = []
  let index = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === '//' || trimmed.startsWith('//') && !trimmed.includes(',')) continue

    // Check if this line has an actual value (not just a comment)
    const hasValue = trimmed.includes('this.') || trimmed.includes('undefined')
      || trimmed.includes('false') || trimmed.includes('true')
      || trimmed.includes("''") || trimmed.includes('""')
      || /^\d/.test(trimmed) || trimmed.startsWith("'") || trimmed.startsWith('"')

    if (!hasValue) continue

    const comment = trimmed.match(/\/\/\s*(.*)$/)?.[1] || null
    const isBoolean = trimmed.includes('false') || trimmed.includes('true')
      || trimmed.includes('?? false') || trimmed.includes('.isNeeded()')
    const isString = trimmed.includes('.ssid') || trimmed.includes('namesString')
      || trimmed.includes("'") || trimmed.includes('"')
    const isUndefined = trimmed.startsWith('undefined')

    fields.push({
      index,
      comment,
      isBoolean: isBoolean && !isString,
      isString,
      isNumber: !isBoolean && !isString && !isUndefined,
      isUndefined,
      rawLine: trimmed.substring(0, 80),
    })
    index++
  }

  return { total: index, fields }
}

async function auditForm(formInfo: typeof FORM_MAP[0]) {
  const pdfPath = path.join(FORMS_DIR, formInfo.pdfFile)
  const codePath = path.join(CODE_DIR, formInfo.codeFile)

  if (!fs.existsSync(pdfPath)) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`${formInfo.label} (${formInfo.tag})`)
    console.log(`${'═'.repeat(60)}`)
    console.log(`  ❌ PDF not found: ${formInfo.pdfFile}`)
    return { tag: formInfo.tag, status: 'missing_pdf', issues: 1 }
  }

  if (!fs.existsSync(codePath)) {
    console.log(`\n${'═'.repeat(60)}`)
    console.log(`${formInfo.label} (${formInfo.tag})`)
    console.log(`${'═'.repeat(60)}`)
    console.log(`  ❌ Code not found: ${formInfo.codeFile}`)
    return { tag: formInfo.tag, status: 'missing_code', issues: 1 }
  }

  const pdfFields = await getPdfFields(pdfPath)
  const codeFields = getCodeFieldCount(codePath)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`${formInfo.label} (${formInfo.tag})`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  PDF fields:  ${pdfFields.length}`)
  console.log(`  Code fields: ${codeFields.total}`)

  let issues = 0

  // Count mismatches
  if (codeFields.total === -1) {
    console.log(`  ⚠️  Could not parse fields() method from code`)
    issues++
  } else if (codeFields.total !== pdfFields.length) {
    console.log(`  ❌ FIELD COUNT MISMATCH: code has ${codeFields.total}, PDF has ${pdfFields.length} (diff: ${codeFields.total - pdfFields.length})`)
    issues++
  } else {
    console.log(`  ✅ Field count matches`)
  }

  // Check for type mismatches (boolean in code vs text in PDF)
  const pdfTextFields = pdfFields.filter(f => f.type === 'text').length
  const pdfCheckboxFields = pdfFields.filter(f => f.type === 'checkbox').length
  const codeBooleanFields = codeFields.fields.filter(f => f.isBoolean).length

  console.log(`  PDF types:   ${pdfTextFields} text, ${pdfCheckboxFields} checkbox`)
  console.log(`  Code types:  ${codeBooleanFields} boolean, ${codeFields.fields.filter(f => f.isNumber).length} number, ${codeFields.fields.filter(f => f.isString).length} string`)

  if (codeBooleanFields > 0 && pdfCheckboxFields === 0) {
    console.log(`  ❌ TYPE MISMATCH: code has ${codeBooleanFields} booleans but PDF has 0 checkboxes`)
    console.log(`     Booleans will render as "true"/"false" text on the PDF`)
    issues++

    // Show which fields are boolean in code
    const boolFields = codeFields.fields.filter(f => f.isBoolean)
    for (const bf of boolFields.slice(0, 5)) {
      const pdfField = pdfFields[bf.index]
      console.log(`     Index ${bf.index}: ${bf.rawLine.substring(0, 60)}`)
      if (pdfField) console.log(`       → PDF field: ${pdfField.name} (${pdfField.type})`)
    }
    if (boolFields.length > 5) console.log(`     ... and ${boolFields.length - 5} more`)
  }

  // Show field-by-field comparison for first 10 mismatches
  if (codeFields.total > 0 && codeFields.total !== pdfFields.length) {
    console.log(`\n  Field-by-field comparison (first misalignments):`)
    const max = Math.max(codeFields.total, pdfFields.length)
    let shown = 0
    for (let i = 0; i < max && shown < 8; i++) {
      const code = codeFields.fields[i]
      const pdf = pdfFields[i]
      if (!code && pdf) {
        console.log(`    [${i}] Code: MISSING  |  PDF: ${pdf.name}`)
        shown++
      } else if (code && !pdf) {
        console.log(`    [${i}] Code: ${code.rawLine.substring(0, 40)}  |  PDF: MISSING`)
        shown++
      }
    }
  }

  return { tag: formInfo.tag, status: issues === 0 ? 'ok' : 'issues', issues }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║     UsTaxes Y2025 Form Field Audit                         ║')
  console.log('║     Comparing code fields() arrays vs actual PDF fields     ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')

  const results: Array<{ tag: string; status: string; issues: number }> = []

  for (const form of FORM_MAP) {
    const result = await auditForm(form)
    if (result) results.push(result)
  }

  console.log(`\n${'═'.repeat(60)}`)
  console.log('SUMMARY')
  console.log(`${'═'.repeat(60)}`)

  let totalIssues = 0
  for (const r of results) {
    const icon = r.status === 'ok' ? '✅' : '❌'
    console.log(`  ${icon} ${r.tag.padEnd(12)} ${r.status === 'ok' ? 'OK' : `${r.issues} issue(s)`}`)
    totalIssues += r.issues
  }

  console.log(`\nTotal forms: ${results.length}, Issues: ${totalIssues}`)

  if (totalIssues > 0) {
    console.log(`\nTo fix: update each form's fields() array to match the PDF field count.`)
    console.log(`Booleans should be removed or converted to checkbox field handling.`)
  }
}

main().catch(console.error)