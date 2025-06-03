import { curveCatmullRom, curveCatmullRomClosed } from 'd3-shape'
import { isEqual } from 'lodash'
import { LabelPlacer } from './LabelPlacer'
import { LabelPosition } from './Paint'
import { GeotilerRenderingContext, LabelPlacement } from './types'

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

  // #region Drawing

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

  // #endregion

  // #region Label placement

  public placeLabels(position: LabelPosition, count: number): LabelPlacement[] {
    return this.subpaths.flatMap(subpath => {
      const placer = LabelPlacer.create(subpath, position)
      return placer.place(count)
    })
  }

  // #endregion


}

export type Subpath = Point[]
export type Point = [number, number]