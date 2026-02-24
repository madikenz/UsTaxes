import { commonTests, testKit } from '.'
import ScheduleC from '../irsForms/ScheduleC'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('ScheduleC', () => {
  it('should produce total expenses >= 0', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f1040 = commonTests.findF1040OrFail(forms)
      const schedCs = forms.filter((f) => f.tag === 'f1040sc') as ScheduleC[]
      for (const sc of schedCs) {
        expect(sc.l28()).toBeGreaterThanOrEqual(0)
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const schedCs = forms.filter((f) => f.tag === 'f1040sc') as ScheduleC[]
      for (const sc of schedCs) {
        expect(() => sc.fields()).not.toThrow()
      }
    })
  })
})
