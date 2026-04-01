/**
 * Extract Field Map from IRS PDF Templates
 *
 * Opens each blank IRS PDF, fills every field with its own field name,
 * and saves the result. This creates a "self-labeling" PDF where you can
 * see which field ID maps to which visual location on the form.
 *
 * Also generates a JSON field map template for each form.
 *
 * Usage: npx ts-node scripts/extract-field-map.ts [form_tag]
 * Example: npx ts-node scripts/extract-field-map.ts f1040
 */

import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib'
import fs from 'fs'
import path from 'path'

const FORMS_DIR = path.join(__dirname, '../public/forms/Y2025/irs')
const OUTPUT_DIR = path.join(__dirname, '../public/forms/Y2025/labeled')
const MAPS_DIR = path.join(__dirname, '../field-maps')

const FORMS = [
  'f1040', 'f1040s1', 'f1040s2', 'f1040s3',
  'f1040sa', 'f1040sb', 'f1040sd',
  'f8889', 'f8949', 'f8959', 'f8960', 'f1116',
]

async function extractAndLabel(formTag: string) {
  const pdfPath = path.join(FORMS_DIR, `${formTag}.pdf`)
  if (!fs.existsSync(pdfPath)) {
    console.log(`  Skipped: ${pdfPath} not found`)
    return
  }

  const bytes = fs.readFileSync(pdfPath)
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  const fields = form.getFields()

  console.log(`\n${formTag}: ${fields.length} fields`)

  // Build field map JSON
  const fieldMap: Record<string, { index: number; type: string; name: string }> = {}

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i]
    const fullName = field.getName()
    // Short name: strip form1[0].Page1[0]. prefix and [0] suffixes
    const shortName = fullName
      .replace(/^(form1|topmostSubform)\[0\]\./g, '')
      .replace(/\[0\]/g, '')
    const type = field instanceof PDFCheckBox ? 'checkbox'
      : field instanceof PDFTextField ? 'text'
      : 'other'

    // Extract the field ID (f1_XX or c1_XX)
    const idMatch = shortName.match(/(f\d+_\d+|c\d+_\d+)(?:\[(\d+)\])?$/)
    const fieldId = idMatch ? idMatch[0] : shortName

    fieldMap[fieldId] = { index: i, type, name: shortName }

    // Fill text fields with their own ID for visual labeling
    if (field instanceof PDFTextField) {
      try {
        field.setMaxLength(undefined)
        field.setText(fieldId)
      } catch {
        // Some fields fail
      }
    } else if (field instanceof PDFCheckBox) {
      // Check all checkboxes so they're visible
      try { field.check() } catch { /* skip */ }
    }
  }

  // Save labeled PDF
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  const labeledBytes = await doc.save()
  const labeledPath = path.join(OUTPUT_DIR, `${formTag}-labeled.pdf`)
  fs.writeFileSync(labeledPath, labeledBytes)
  console.log(`  Labeled PDF: ${labeledPath}`)

  // Save field map JSON
  fs.mkdirSync(MAPS_DIR, { recursive: true })
  const mapPath = path.join(MAPS_DIR, `${formTag}-2025.json`)
  fs.writeFileSync(mapPath, JSON.stringify({
    form: formTag,
    year: 2025,
    template: `${formTag}.pdf`,
    totalFields: fields.length,
    generated: new Date().toISOString(),
    fields: fieldMap,
  }, null, 2))
  console.log(`  Field map: ${mapPath} (${Object.keys(fieldMap).length} fields)`)
}

async function main() {
  const target = process.argv[2]
  const forms = target ? [target] : FORMS

  console.log('Extracting field maps from 2025 IRS PDFs...')
  for (const form of forms) {
    await extractAndLabel(form)
  }
  console.log('\nDone! Open labeled PDFs to see field IDs on the form.')
}

main().catch(console.error)
