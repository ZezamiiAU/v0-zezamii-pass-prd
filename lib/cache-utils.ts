export class LRUCache<K, V> {
  private cache = new Map<K, V>()
  private maxSize: number

  constructor(maxSize = 50) {
    this.maxSize = maxSize
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key)
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key)
      this.cache.set(key, value)
    }
    return value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    this.cache.set(key, value)

    // Remove oldest if over limit
    if (this.cache.size > this.maxSize) {
      const iter = this.cache.keys().next()
      if (!iter.done) {
        this.cache.delete(iter.value)
      }
    }
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

export function idleImport<T>(loader: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null

  return () => {
    if (promise) return promise

    promise = new Promise((resolve) => {
      const callback = () => {
        loader().then(resolve)
      }

      if ("requestIdleCallback" in window) {
        requestIdleCallback(callback)
      } else {
        setTimeout(callback, 1)
      }
    })

    return promise
  }
}
