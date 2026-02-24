import { commonTests, testKit } from '.'
import F8582 from '../irsForms/F8582'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8582', () => {
  it('should have allowed loss >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8582 = forms.find((f) => f.tag === 'f8582') as F8582 | undefined
      if (f8582) {
        const allowed = f8582.l15()
        if (allowed !== undefined) {
          expect(allowed).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8582 = forms.find((f) => f.tag === 'f8582') as F8582 | undefined
      if (f8582) {
        expect(() => f8582.fields()).not.toThrow()
      }
    })
  })
})
