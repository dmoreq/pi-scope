import { describe, expect, it } from 'vitest'
import { mapLimit } from '../../shared/concurrency.js'

describe('mapLimit', () => {
  it('preserves input order while running with bounded concurrency', async () => {
    let active = 0
    let maxActive = 0

    const result = await mapLimit([1, 2, 3, 4, 5], 2, async value => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise(resolve => setTimeout(resolve, 5 * (6 - value)))
      active--
      return value * 10
    })

    expect(result).toEqual([10, 20, 30, 40, 50])
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it('treats invalid limits as serial execution', async () => {
    const seen: number[] = []
    const result = await mapLimit([1, 2, 3], 0, async value => {
      seen.push(value)
      return value
    })

    expect(result).toEqual([1, 2, 3])
    expect(seen).toEqual([1, 2, 3])
  })
})
