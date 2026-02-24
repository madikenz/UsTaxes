import { PDFDocument } from 'pdf-lib'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PDFDownloader } from 'ustaxes/core/pdfFiller/pdfHandler'
import { TaxYear } from 'ustaxes/core/data'

/**
 * PDF forms base directory. In the Docker image, these are
 * copied from public/forms/ into /app/forms/ during build.
 * Locally, they live in public/forms/.
 */
const FORMS_DIR = process.env.FORMS_DIR ?? join(__dirname, '../../public/forms')

/**
 * Creates a year-aware filesystem PDF downloader.
 *
 * When setDownloader() replaces the default downloader, it receives
 * just the relative part like `irs/f1040.pdf` (without the year prefix).
 * The default downloader in CreateForms prepends `/forms/{year}/`, but
 * setDownloader bypasses that. So we need to add the year prefix here.
 */
export function createPdfDownloader(taxYear: TaxYear): PDFDownloader {
  return async (url: string): Promise<PDFDocument> => {
    const filePath = join(FORMS_DIR, taxYear, url)
    const bytes = readFileSync(filePath)
    return PDFDocument.load(bytes)
  }
}
