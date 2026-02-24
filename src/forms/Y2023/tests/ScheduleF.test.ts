import { testKit } from '.'
import ScheduleF from '../irsForms/ScheduleF'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('ScheduleF', () => {
  it('should have net profit/loss defined', async () => {
    await testKit.with1040Assert(async (forms) => {
      const schedFs = forms.filter((f) => f.tag === 'f1040sf') as ScheduleF[]
      for (const f of schedFs) {
        expect(f.l34()).toBeDefined()
      }
    })
  })
})
