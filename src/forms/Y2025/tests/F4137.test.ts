import { commonTests, testKit } from '.'
import F4137 from '../irsForms/F4137'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F4137', () => {
  it('should have unreported tips >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f4137 = forms.find((f) => f.tag === 'f4137') as F4137 | undefined
      if (f4137) {
        expect(f4137.l6()).toBeGreaterThanOrEqual(0)
      }
    })
  })

  it('should have tax >= 0', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f4137 = forms.find((f) => f.tag === 'f4137') as F4137 | undefined
      if (f4137) {
        const tax = f4137.l13()
        if (tax !== undefined) {
          expect(tax).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f4137 = forms.find((f) => f.tag === 'f4137') as F4137 | undefined
      if (f4137) {
        expect(() => f4137.fields()).not.toThrow()
      }
    })
  })
})
