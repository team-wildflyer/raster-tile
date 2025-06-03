import { curveCatmullRom, curveCatmullRomClosed } from 'd3-shape'
import { isEqual } from 'lodash'

import { LabelPosition } from './Paint'
import { GeotilerRenderingContext } from './types'

export class Path {

  constructor(
    public readonly subpaths: Subpath[],
  ) {
    for (const [index, subpath] of subpaths.entries()) {
      if (subpath.length < 3) {
        throw new TypeError(`Subpath ${index} must have at least 3 points`)
      }
    }
  }

  public coordinateAt(subpathIndex: number, index: number) {
    if (subpathIndex < 0 || subpathIndex >= this.subpaths.length) {
      throw new RangeError(`Subpath index ${subpathIndex} is out of bounds`)
    }

    const subpath = this.subpaths[subpathIndex]
    while (index < 0) { index += subpath.length }
    while (index >= subpath.length) { index -= subpath.length }
    return subpath[index]
  }

  public placeLabels(position: LabelPosition, _count: number = 2): LabelPlacement[] {
    const placeOnSubpath = (subpath: Subpath): LabelPlacement[] => {
        const minX = Math.min(...subpath.map(p => p[0]))
        const minY = Math.min(...subpath.map(p => p[1]))
        const maxX = Math.max(...subpath.map(p => p[0]))
        const maxY = Math.max(...subpath.map(p => p[1]))
        const midX = (minX + maxX) / 2
        const midY = (minY + maxY) / 2

      if (position === LabelPosition.Center) {
        return [{x: midX, y: midY, rotation: 0, accessory: null}]
      } else {
        // Find the ${count} most distant points on the path, and place the label inbetween them.
        let maxDistanceSquared: number = -Infinity
        let maxDistanceIndex: number = -1

        for (const [i, p1] of subpath.entries()) {
          const p2 = subpath[(i + 1) % subpath.length]
          if (p1[0] < 0 || p1[0] > 512) { continue }
          if (p1[1] < 0 || p1[1] > 512) { continue }

          const distanceSquared = Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
          if (distanceSquared >= maxDistanceSquared) {
            maxDistanceSquared = distanceSquared
            maxDistanceIndex = i
          }
        }

        if (maxDistanceIndex === -1) {
          return []
        }

        const p1 = subpath[maxDistanceIndex]
        const p2 = subpath[(maxDistanceIndex + 1) % subpath.length]
        const x = (p1[0] + p2[0]) / 2
        const y = (p1[1] + p2[1]) / 2

        const angleTowardsCenter = Math.atan2(midY - y, midX - x)
        const accessory = angleTowardsCenter < 0 ? LabelAccessory.ArrowUp : LabelAccessory.ArrowDown
  
        let rotation = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI
        while (rotation < 0) { rotation += 360 }

        if (rotation < 90 || rotation > 270) {
          return [{x, y, rotation, accessory}]
        } else {
          return [{x, y, rotation, accessory}]
        }
      }
    }

    return this.subpaths.flatMap(placeOnSubpath)
  }

  public drawLinear(context: GeotilerRenderingContext) {
    const drawSubpath = (subpath: Subpath) => {
      for (const [idx, [x, y]] of subpath.entries()) {
        if (idx === 0) {
          context.moveTo(x, y)
        } else {
          context.lineTo(x, y)
        }
      }
    }

    this.subpaths.forEach(drawSubpath)
  }

  public drawCatmullRom(context: GeotilerRenderingContext) {
    const closed = isEqual(this.subpaths[0][0], this.subpaths[0][this.subpaths[0].length - 1])
    const curve = closed ? curveCatmullRomClosed(context) : curveCatmullRom(context)

    const drawSubpath = (subpath: Subpath) => {
      const coordinates = closed ? subpath.slice(0, -1) : subpath

      curve.lineStart()
      coordinates.forEach(it => curve.point(it[0], it[1]))
      curve.lineEnd()
    }

    this.subpaths.forEach(drawSubpath)
  }

}

export type Subpath = Point[]
export type Point = [number, number]

export interface LabelPlacement {
  x:        number
  y:        number
  rotation: number
  accessory: LabelAccessory | null
}

export enum LabelAccessory {
  ArrowUp = '⏶',
  ArrowDown = '⏷',
}