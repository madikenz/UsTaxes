import { commonTests, testKit } from '.'
import ScheduleR from '../irsForms/ScheduleR'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('ScheduleR', () => {
  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const schedR = forms.find((f) => f.tag === 'f1040sr') as
        | ScheduleR
        | undefined
      if (schedR) {
        expect(() => schedR.fields()).not.toThrow()
      }
    })
  })
})
