import { commonTests, testKit } from '.'
import F8962 from '../irsForms/F8962'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8962', () => {
  it('should not have both net PTC and excess advance PTC', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f8962 = forms.find((f) => f.tag === 'f8962') as F8962 | undefined
      if (f8962 && info.form8962) {
        // Can't owe money and get a credit at the same time
        if (f8962.l26() > 0) {
          expect(f8962.l27()).toBe(0)
        }
        if (f8962.l27() > 0) {
          expect(f8962.l26()).toBe(0)
        }
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8962 = forms.find((f) => f.tag === 'f8962') as F8962 | undefined
      if (f8962) {
        expect(() => f8962.fields()).not.toThrow()
      }
    })
  })
})
