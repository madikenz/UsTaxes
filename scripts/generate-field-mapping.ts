/**
 * Generate Field Mapping Template
 *
 * For each form, extracts all PDF field names with their types and indices,
 * and outputs a template that can be used to build the correct fields() array.
 *
 * Usage: npx ts-node scripts/generate-field-mapping.ts [form_tag]
 * Example: npx ts-node scripts/generate-field-mapping.ts f1040s1
 * Without args: generates for all forms
 */

import { PDFDocument, PDFTextField, PDFCheckBox, PDFRadioGroup } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const FORMS_DIR = path.join(__dirname, '../public/forms/Y2025/irs')

const FORMS = [
  'f1040', 'f1040s1', 'f1040s2', 'f1040s3',
  'f1040sa', 'f1040sb', 'f1040sd', 'f1040se',
  'f1040sse', 'f8889', 'f8949', 'f8959',
  'f8960', 'f1116', 'f6251', 'f8995', 'f8995a',
]

async function generateMapping(formTag: string) {
  const pdfPath = path.join(FORMS_DIR, `${formTag}.pdf`)
  if (!fs.existsSync(pdfPath)) {
    console.log(`PDF not found: ${pdfPath}`)
    return
  }

  const bytes = fs.readFileSync(pdfPath)
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  const fields = form.getFields()

  console.log(`\n// ═══════════════════════════════════════════════════════════`)
  console.log(`// ${formTag}.pdf — ${fields.length} fields`)
  console.log(`// Generated from 2025 IRS PDF template`)
  console.log(`// ═══════════════════════════════════════════════════════════`)
  console.log(`// fields = (): Field[] => [`)

  let currentPage = ''

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const name = field.getName()
    const isCheckbox = field instanceof PDFCheckBox
    const isText = field instanceof PDFTextField
    const isRadio = field instanceof PDFRadioGroup

    // Detect page transitions
    const pageMatch = name.match(/Page(\d+)/)
    if (pageMatch && pageMatch[0] !== currentPage) {
      currentPage = pageMatch[0]
      console.log(`  // ── ${currentPage} ──`)
    }

    // Short name for readability
    const shortName = name
      .replace(/form1\[0\]\./g, '')
      .replace(/topmostSubform\[0\]\./g, '')
      .replace(/\[0\]/g, '')

    const type = isCheckbox ? 'CHECKBOX' : isText ? 'TEXT' : isRadio ? 'RADIO' : 'OTHER'
    const placeholder = isCheckbox ? 'false' : 'undefined'

    console.log(`  ${placeholder},`.padEnd(30) + `// [${String(i).padStart(3)}] ${type.padEnd(8)} ${shortName}`)
  }

  console.log(`// ]`)
  console.log(`// Total: ${fields.length} fields`)
}

async function main() {
  const targetForm = process.argv[2]

  if (targetForm) {
    await generateMapping(targetForm)
  } else {
    for (const form of FORMS) {
      await generateMapping(form)
    }
  }
}

main().catch(console.error)