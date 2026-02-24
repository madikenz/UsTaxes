import { commonTests, testKit } from '.'
import F4797 from '../irsForms/F4797'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F4797', () => {
  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f4797 = forms.find((f) => f.tag === 'f4797') as F4797 | undefined
      if (f4797) {
        expect(() => f4797.fields()).not.toThrow()
      }
    })
  })
})
