import { commonTests, testKit } from '.'
import F8829 from '../irsForms/F8829'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8829', () => {
  it('should have business percentage <= 100%', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8829s = forms.filter((f) => f.tag === 'f8829') as F8829[]
      for (const f of f8829s) {
        expect(f.l3()).toBeLessThanOrEqual(1)
        expect(f.l3()).toBeGreaterThanOrEqual(0)
      }
    })
  })

  it('should have deduction >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8829s = forms.filter((f) => f.tag === 'f8829') as F8829[]
      for (const f of f8829s) {
        const deduction = f.deduction()
        if (deduction !== undefined) {
          expect(deduction).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8829s = forms.filter((f) => f.tag === 'f8829') as F8829[]
      for (const f of f8829s) {
        expect(() => f.fields()).not.toThrow()
      }
    })
  })
})
