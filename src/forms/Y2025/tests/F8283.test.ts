import { commonTests, testKit } from '.'
import F8283 from '../irsForms/F8283'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8283', () => {
  it('should have total deduction >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8283 = forms.find((f) => f.tag === 'f8283') as F8283 | undefined
      if (f8283) {
        const deduction = f8283.totalFMV()
        if (deduction !== undefined) {
          expect(deduction).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8283 = forms.find((f) => f.tag === 'f8283') as F8283 | undefined
      if (f8283) {
        expect(() => f8283.fields()).not.toThrow()
      }
    })
  })
})
