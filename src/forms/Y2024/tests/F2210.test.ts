import { commonTests, testKit } from '.'
import F2210 from '../irsForms/F2210'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F2210', () => {
  it('should have penalty >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f2210 = forms.find((f) => f.tag === 'f2210') as F2210 | undefined
      if (f2210) {
        const penalty = f2210.penalty()
        if (penalty !== undefined) {
          expect(penalty).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f2210 = forms.find((f) => f.tag === 'f2210') as F2210 | undefined
      if (f2210) {
        expect(() => f2210.fields()).not.toThrow()
      }
    })
  })
})
