import { PDFDocument, PDFCheckBox, PDFTextField, PDFName } from 'pdf-lib'
import { Field } from '.'
import { displayRound } from '../irsForms/util'
import _ from 'lodash'

/**
 * Fill a PDF by FIELD NAME (not by array index).
 *
 * This is the preferred method for Y2025+ forms. It decouples the code
 * from the PDF field ordering, so IRS can add/remove fields without
 * breaking all downstream mappings.
 *
 * @param pdf - The PDF document to fill
 * @param namedValues - Record of field name → value
 * @param formName - Form name for error messages
 */
export function fillPDFByName(
  pdf: PDFDocument,
  namedValues: Record<string, Field>,
  formName: string
): PDFDocument {
  const form = pdf.getForm()

  for (const [fieldName, value] of Object.entries(namedValues)) {
    if (value === undefined || value === null) continue

    try {
      // Try to find the field by name — pdf-lib uses the full path
      // IRS fields are like: form1[0].Page1[0].f1_14[0]
      // We search for a field ending with the given name
      const allFields = form.getFields()
      const pdfField = allFields.find(f => {
        const name = f.getName()
        return name === fieldName ||
          name.endsWith(`.${fieldName}[0]`) ||
          name.endsWith(`.${fieldName}`) ||
          name.includes(`${fieldName}[0]`)
      })

      if (!pdfField) {
        // Field not found — skip silently (may not exist in this year's form)
        continue
      }

      if (_.isObject(value) && 'select' in value) {
        // Radio group
        const children = pdfField.acroField.getWidgets()
        if (value.select < children.length) {
          const setValue = children[value.select].getOnValue()
          if (setValue !== undefined) {
            pdfField.acroField.dict.set(PDFName.of('V'), setValue)
            children[value.select].setAppearanceState(setValue)
          }
        }
      } else if (pdfField instanceof PDFCheckBox) {
        if (value === true) {
          pdfField.check()
        }
        // false/undefined = don't check (default)
      } else if (pdfField instanceof PDFTextField) {
        pdfField.setMaxLength(undefined)
        if (typeof value === 'boolean') {
          // Boolean going to text field — skip (type mismatch)
          continue
        }
        const showValue =
          !isNaN(value as number) &&
          value &&
          Array.from(value as string)[0] !== '0'
            ? displayRound(value as number)?.toString()
            : value?.toString()
        pdfField.setText(showValue)
      }

      pdfField.enableReadOnly()
    } catch (err) {
      console.warn(
        `${formName} field "${fieldName}": ${err instanceof Error ? err.message : err}`
      )
    }
  }

  return pdf
}

/**
 * Legacy: Fill a PDF by positional array index.
 * Used by Y2020-Y2024 forms. Y2025+ should use fillPDFByName.
 *
 * TOLERANT MODE: Instead of throwing on type mismatches
 * (boolean→text, number→checkbox), it skips the field with a warning.
 * This prevents PDF generation failures from minor mapping errors.
 */
export function fillPDF(
  pdf: PDFDocument,
  fieldValues: Field[],
  formName: string
): PDFDocument {
  const formFields = pdf.getForm().getFields()

  formFields.forEach((pdfField, index) => {
    const value: Field = fieldValues[index]

    // First handle radio groups
    if (_.isObject(value)) {
      const children = pdfField.acroField.getWidgets()
      if (value.select >= children.length) {
        console.warn(
          `${formName} Field ${index}: radio select ${value.select} exceeds ${children.length} children`
        )
        return
      }
      const setValue = children[value.select].getOnValue()
      if (setValue !== undefined) {
        pdfField.acroField.dict.set(PDFName.of('V'), setValue)
        children[value.select].setAppearanceState(setValue)
      }
    } else if (pdfField instanceof PDFCheckBox) {
      if (value === true) {
        pdfField.check()
      } else if (value !== false && value !== undefined) {
        // TOLERANT: non-boolean for checkbox — skip instead of throwing
        console.warn(
          `${formName} Field ${index} (${pdfField.getName()}): expected boolean for checkbox, got ${typeof value} — skipped`
        )
        return
      }
    } else if (pdfField instanceof PDFTextField) {
      try {
        pdfField.setMaxLength(undefined)

        // TOLERANT: skip booleans going to text fields
        if (typeof value === 'boolean') {
          return
        }

        const showValue =
          !isNaN(value as number) &&
          value &&
          Array.from(value as string)[0] !== '0'
            ? displayRound(value as number)?.toString()
            : value?.toString()
        pdfField.setText(showValue)
      } catch (err) {
        console.warn(
          `${formName} Field ${index} (${pdfField.getName()}): skipped – ${err instanceof Error ? err.message : err}`
        )
      }
    } else if (value !== undefined) {
      // TOLERANT: unknown field type — warn instead of throwing
      console.warn(
        `${formName} Field ${index} (${pdfField.getName()}): unknown field type — skipped`
      )
      return
    }
    pdfField.enableReadOnly()
  })

  return pdf
}
