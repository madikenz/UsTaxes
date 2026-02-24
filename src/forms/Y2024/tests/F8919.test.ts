import { commonTests, testKit } from '.'
import F8919 from '../irsForms/F8919'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8919', () => {
  it('should have total tax >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8919 = forms.find((f) => f.tag === 'f8919') as F8919 | undefined
      if (f8919) {
        const tax = f8919.l6()
        if (tax !== undefined) {
          expect(tax).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8919 = forms.find((f) => f.tag === 'f8919') as F8919 | undefined
      if (f8919) {
        expect(() => f8919.fields()).not.toThrow()
      }
    })
  })
})
