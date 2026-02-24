import { commonTests, testKit } from '.'
import Form from 'ustaxes/core/irsForms/Form'

jest.setTimeout(300000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('Integration tests', () => {
  it('should produce valid F1040 with all random forms', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f1040 = commonTests.findF1040OrFail(forms)

      // Basic sanity: total tax >= 0
      expect(f1040.l24()).toBeGreaterThanOrEqual(0)

      // Total payments >= 0
      expect(f1040.l33()).toBeGreaterThanOrEqual(0)

      // Either owes or gets refund (or breaks even)
      const owed = f1040.l37() ?? 0
      const refund = f1040.l34() ?? 0
      // Can't both owe and get a refund
      if (owed > 0) {
        expect(refund).toBe(0)
      }
    })
  })

  it('should produce fields array for all forms without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      for (const form of forms) {
        expect(() => form.fields()).not.toThrow()
      }
    })
  })

  it('should have forms sorted by sequence index', async () => {
    await testKit.with1040Assert(async (forms) => {
      const sorted = [...forms].sort(
        (a, b) => a.sequenceIndex - b.sequenceIndex
      )
      expect(forms.map((f) => f.tag)).toEqual(sorted.map((f) => f.tag))
    })
  })

  it('should generate PDFs for all forms without failing', async () => {
    await testKit.with1040Pdfs((pdfs) => {
      expect(pdfs.length).toBeGreaterThan(0)
    })
  })

  it('should have Schedule C when self-employment data present', async () => {
    await testKit.with1040Assert(
      async (forms, info) => {
        const hasSC = forms.some((f) => f.tag === 'f1040sc')
        expect(hasSC).toBe(true)
      },
      {},
      (info) =>
        info.scheduleCBusinesses !== undefined &&
        info.scheduleCBusinesses.length > 0
    )
  })

  it('should have Schedule F when farming data present', async () => {
    await testKit.with1040Assert(
      async (forms, info) => {
        const hasSF = forms.some((f) => f.tag === 'f1040sf')
        expect(hasSF).toBe(true)
      },
      {},
      (info) =>
        info.scheduleFData !== undefined && info.scheduleFData.length > 0
    )
  })
})
