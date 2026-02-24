import { commonTests, testKit } from '.'
import F2555 from '../irsForms/F2555'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F2555', () => {
  it('should have exclusion <= $130,000', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f2555s = forms.filter((f) => f.tag === 'f2555') as F2555[]
      for (const f of f2555s) {
        const exclusion = f.l42()
        if (exclusion !== undefined) {
          expect(exclusion).toBeLessThanOrEqual(130000)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f2555s = forms.filter((f) => f.tag === 'f2555') as F2555[]
      for (const f of f2555s) {
        expect(() => f.fields()).not.toThrow()
      }
    })
  })
})
