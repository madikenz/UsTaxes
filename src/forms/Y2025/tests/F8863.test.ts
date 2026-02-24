import { commonTests, testKit } from '.'
import F8863 from '../irsForms/F8863'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8863', () => {
  it('should have AOTC per student <= $2,500', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f8863 = forms.find((f) => f.tag === 'f8863') as F8863 | undefined
      if (f8863 && info.form8863) {
        for (const s of info.form8863.students) {
          expect(f8863.studentAOTC(s)).toBeLessThanOrEqual(2500)
        }
      }
    })
  })

  it('should have refundable portion = 40% of tentative AOTC after phaseout', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f8863 = forms.find((f) => f.tag === 'f8863') as F8863 | undefined
      if (f8863 && info.form8863) {
        const l7 = f8863.l7()
        const l8 = f8863.l8() ?? 0
        const expected = Math.round(l7 * 0.4 * 100) / 100
        expect(l8).toBeCloseTo(expected, 2)
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8863 = forms.find((f) => f.tag === 'f8863') as F8863 | undefined
      if (f8863) {
        expect(() => f8863.fields()).not.toThrow()
      }
    })
  })
})
