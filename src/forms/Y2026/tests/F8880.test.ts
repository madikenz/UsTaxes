import { commonTests, testKit } from '.'
import F8880 from '../irsForms/F8880'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8880', () => {
  it('should have credit rate of 0, 10, 20, or 50 percent', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f8880 = forms.find((f) => f.tag === 'f8880') as F8880 | undefined
      if (f8880 && info.form8880) {
        expect([0, 0.1, 0.2, 0.5]).toContain(f8880.l9())
      }
    })
  })

  it('should produce credit >= 0', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f8880 = forms.find((f) => f.tag === 'f8880') as F8880 | undefined
      if (f8880 && info.form8880) {
        expect(f8880.l12()).toBeGreaterThanOrEqual(0)
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8880 = forms.find((f) => f.tag === 'f8880') as F8880 | undefined
      if (f8880) {
        expect(() => f8880.fields()).not.toThrow()
      }
    })
  })
})
