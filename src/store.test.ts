import { describe, it, expect } from 'vitest'
import { useStore } from './store'

describe('store: hand-added grocery extras', () => {
  it('keeps extras while editing the menu but clears them on a new menu', () => {
    const s = useStore.getState()
    s.generate()
    s.addExtraItem('paper de cuina')
    s.addExtraItem('Paper de cuina') // case-insensitive duplicate is ignored
    expect(useStore.getState().extraItems).toEqual(['paper de cuina'])

    useStore.getState().generate()
    expect(useStore.getState().extraItems).toEqual([])
  })
})
