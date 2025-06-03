import { range } from 'lodash'
import { memoized } from 'ytil'
import { LabelPosition } from './Paint'
import { Subpath } from './Path'
import { LabelPlacement } from './types'

export interface LabelPlacer {
  place(count: number): LabelPlacement[]
}

export const LabelPlacer = {
  create(subpath: Subpath, position: LabelPosition): LabelPlacer {
    switch (position) {
    case LabelPosition.Center:
      return new CenterLabelPlacer(subpath)
    case LabelPosition.Outline:
      return new OutlineLabelPlacer(subpath)
    }
  },
}

export class CenterLabelPlacer implements LabelPlacer {

  constructor(
    private readonly subpath: Subpath,
  ) {}

  public place(): LabelPlacement[] {
    const minX = Math.min(...this.subpath.map(p => p[0]))
    const minY = Math.min(...this.subpath.map(p => p[1]))
    const maxX = Math.max(...this.subpath.map(p => p[0]))
    const maxY = Math.max(...this.subpath.map(p => p[1]))
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2
    return [{x: midX, y: midY, rotation: 0}]
  }

}

export class OutlineLabelPlacer implements LabelPlacer {

  constructor(
    private readonly subpath: Subpath,
  ) {}

  private prevSegmentIndexes: number[] = []

  public place(count: number): LabelPlacement[] {
    const minX = Math.min(...this.subpath.map(p => p[0]))
    const minY = Math.min(...this.subpath.map(p => p[1]))
    const maxX = Math.max(...this.subpath.map(p => p[0]))
    const maxY = Math.max(...this.subpath.map(p => p[1]))
    if (Math.abs(maxX - minX) < 30 || Math.abs(maxY - minY) < 30) {
      // If the subpath is too small, place a single in the center.
      return new CenterLabelPlacer(this.subpath).place()
    }

    this.prevSegmentIndexes = []
    return range(count).flatMap(() => this.placeSingle())
  }

  private placeSingle(): LabelPlacement[] {
    const segmentIndex = this.findLongestSegmentIndex()
    if (segmentIndex === -1) { return [] }

    this.prevSegmentIndexes.push(segmentIndex)

    const p1 = this.subpath[segmentIndex]
    const p2 = this.subpath[(segmentIndex + 1) % this.subpath.length]
    const x = (p1[0] + p2[0]) / 2
    const y = (p1[1] + p2[1]) / 2

    let rotation = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI
    while (rotation < 0) { rotation += 360 }

    if (rotation < 90 || rotation > 270) {
      return [{x, y, rotation, insideIsUp: this.windingOrder === WindingOrder.CCW}]
    } else {
      return [{x, y, rotation: (rotation + 180) % 360, insideIsUp: this.windingOrder === WindingOrder.CW}]
    }
  }

  private findLongestSegmentIndex(): number {
    let maxDistanceSquared: number = -Infinity
    let segmentIndex: number = -1

    const {subpath, prevSegmentIndexes} = this
    function *searchIndexes() {
      if (prevSegmentIndexes.length === 0) {
        // Search every segment if no previous segments are placed.
        for (let i = 0; i < subpath.length; i++) {
          yield i
        }
      } else if (prevSegmentIndexes.length === 1) {
      // Try to place the label as far away from the previous segments as possible.
        const oppositeIndex = (prevSegmentIndexes[0] + Math.floor(subpath.length / 2)) % subpath.length
        yield oppositeIndex
        if (subpath.length > 2) {
          yield clampWrap(oppositeIndex - 1, 0, subpath.length)
          yield clampWrap(oppositeIndex + 1, 0, subpath.length)
        }
        if (subpath.length > 4) {
          yield clampWrap(oppositeIndex - 2, 0, subpath.length)
          yield clampWrap(oppositeIndex + 2, 0, subpath.length)
        }
      }
    }

    for (const idx of searchIndexes()) {
      const p1 = this.subpath[idx]
      const p2 = this.subpath[(idx + 1) % this.subpath.length]
      if (p1[0] < 0 || p1[0] > 512) { continue }
      if (p1[1] < 0 || p1[1] > 512) { continue }

      const distanceSquared = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
      if (distanceSquared >= maxDistanceSquared) {
        maxDistanceSquared = distanceSquared
        segmentIndex = idx
      }
    }

    return segmentIndex
  }

  @memoized
  private get windingOrder(): WindingOrder {
    // Calculate the signed area of the polygon
    let area = 0
    for (let i = 0, j = this.subpath.length - 1; i < this.subpath.length; j = i++) {
      const [x1, y1] = this.subpath[i]
      const [x2, y2] = this.subpath[j]
      area += (x2 - x1) * (y2 + y1)
    }
    return area > 0 ? WindingOrder.CW : WindingOrder.CCW
  }

}

function clampWrap(value: number, min: number, max: number): number {
  const relval = value - min
  const range = max - min
  while (relval < 0) { value += 10 * range }
  return relval % range + min
}

enum WindingOrder {
  CW,
  CCW,
}