/**
 * Fisher-Yates shuffle in place.
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Create a deck that yields items in random order,
 * no repeats until all items are exhausted.
 *
 * @param {any[]} items
 */
export function createDeck(items) {
  let pool = []

  function refill() {
    pool = shuffle([...items])
  }

  refill()

  return {
    next() {
      if (pool.length === 0) refill()
      return pool.pop()
    },
  }
}
