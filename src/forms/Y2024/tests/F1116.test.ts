import { commonTests, testKit } from '.'
import F1116 from '../irsForms/F1116'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F1116', () => {
  it('should have credit >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f1116s = forms.filter((f) => f.tag === 'f1116') as F1116[]
      for (const f of f1116s) {
        const credit = f.credit()
        if (credit !== undefined) {
          expect(credit).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f1116s = forms.filter((f) => f.tag === 'f1116') as F1116[]
      for (const f of f1116s) {
        expect(() => f.fields()).not.toThrow()
      }
    })
  })
})
