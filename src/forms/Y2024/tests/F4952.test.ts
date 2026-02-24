import { commonTests, testKit } from '.'
import F4952 from '../irsForms/F4952'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F4952', () => {
  it('should have deduction >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f4952 = forms.find((f) => f.tag === 'f4952') as F4952 | undefined
      if (f4952) {
        const deduction = f4952.l8()
        if (deduction !== undefined) {
          expect(deduction).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f4952 = forms.find((f) => f.tag === 'f4952') as F4952 | undefined
      if (f4952) {
        expect(() => f4952.fields()).not.toThrow()
      }
    })
  })
})
