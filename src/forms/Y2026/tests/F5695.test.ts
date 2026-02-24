import { commonTests, testKit } from '.'
import F5695 from '../irsForms/F5695'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F5695', () => {
  it('should have clean energy credit = 30% of total expenses', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f5695 = forms.find((f) => f.tag === 'f5695') as F5695 | undefined
      if (f5695 && info.form5695) {
        const totalClean = f5695.pdfL6a()
        const credit = f5695.pdfL6b()
        expect(credit).toBeCloseTo(totalClean * 0.3, 0)
      }
    })
  })

  it('should have Part II credit <= $3,200', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f5695 = forms.find((f) => f.tag === 'f5695') as F5695 | undefined
      if (f5695 && info.form5695) {
        expect(f5695.pdfL30()).toBeLessThanOrEqual(3200)
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f5695 = forms.find((f) => f.tag === 'f5695') as F5695 | undefined
      if (f5695) {
        expect(() => f5695.fields()).not.toThrow()
      }
    })
  })
})
