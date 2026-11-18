import type { Rect } from './math'

/**
 * Uniform grid broadphase. Items are rectangles; queries return each item once.
 * Used for obstacles, which are static for a map apart from destruction.
 */
export class SpatialGrid<T extends Rect> {
  private cells = new Map<string, T[]>()

  constructor(private readonly cellSize = 64) {}

  private key(cx: number, cy: number): string {
    return `${cx},${cy}`
  }

  clear(): void {
    this.cells.clear()
  }

  rebuild(items: readonly T[]): void {
    this.clear()
    for (const item of items) this.insert(item)
  }

  insert(item: T): void {
    const minX = Math.floor(item.x / this.cellSize)
    const maxX = Math.floor((item.x + item.w) / this.cellSize)
    const minY = Math.floor(item.y / this.cellSize)
    const maxY = Math.floor((item.y + item.h) / this.cellSize)
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const key = this.key(cx, cy)
        let bucket = this.cells.get(key)
        if (!bucket) {
          bucket = []
          this.cells.set(key, bucket)
        }
        bucket.push(item)
      }
    }
  }

  queryRect(rect: Rect): T[] {
    const out = new Set<T>()
    const minX = Math.floor(rect.x / this.cellSize)
    const maxX = Math.floor((rect.x + rect.w) / this.cellSize)
    const minY = Math.floor(rect.y / this.cellSize)
    const maxY = Math.floor((rect.y + rect.h) / this.cellSize)
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const bucket = this.cells.get(this.key(cx, cy))
        if (!bucket) continue
        for (const item of bucket) out.add(item)
      }
    }
    return [...out]
  }

  queryCircle(x: number, y: number, radius: number): T[] {
    return this.queryRect({ x: x - radius, y: y - radius, w: radius * 2, h: radius * 2 })
  }
}