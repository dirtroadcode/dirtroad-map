import { describe, it, expect } from 'vitest'
import { createDeck } from '../src/deck.js'

describe('createDeck', () => {
  it('visits every item exactly once before repeating', () => {
    const items = ['a', 'b', 'c', 'd', 'e']
    const deck = createDeck(items)

    const visited = []
    for (let i = 0; i < items.length; i++) {
      visited.push(deck.next())
    }

    expect(visited.sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('reshuffles when exhausted, making all items available again', () => {
    const items = ['a', 'b', 'c']
    const deck = createDeck(items)

    // drain first cycle
    const firstCycle = []
    for (let i = 0; i < items.length; i++) firstCycle.push(deck.next())
    expect(firstCycle.sort()).toEqual(['a', 'b', 'c'])

    // drain second cycle
    const secondCycle = []
    for (let i = 0; i < items.length; i++) secondCycle.push(deck.next())
    expect(secondCycle.sort()).toEqual(['a', 'b', 'c'])
  })

  it('continues cycling indefinitely through reshuffles', () => {
    const items = ['x', 'y']
    const deck = createDeck(items)

    // drain 5 full cycles
    for (let cycle = 0; cycle < 5; cycle++) {
      const visited = [deck.next(), deck.next()]
      expect(visited.sort()).toEqual(['x', 'y'])
    }
  })

  it('peek returns the next item without consuming it', () => {
    const items = ['a', 'b', 'c']
    const deck = createDeck(items)

    const peeked = deck.peek()
    const next = deck.next()

    expect(peeked).toBe(next)
    // peek doesn't advance
    expect(deck.peek()).not.toBe(next)
    expect(deck.next()).not.toBe(next)
  })
})
