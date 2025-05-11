import { Feature, Geometry, Position } from 'geojson'
import { memoized } from 'ytil'
import { Paint, PaintInit } from './Paint'
import { LabelPlacement, Path } from './Path'
import { RasterTile } from './RasterTile'
import { GeotilerRenderingContext } from './types'

export class LabelRenderer<P> {

  constructor(
    public readonly tile: RasterTile<P>,
    public readonly feature: Feature<Geometry, P>,
    public readonly delegate: LabelRendererDelegate<P>,
  ) {}

  @memoized
  private get label() {
    return this.delegate.label(this.feature.properties, this.feature)
  }

  @memoized
  private get paint() {
    const paintInit = this.delegate.paint?.(this.feature.properties, this.feature)

    return new Paint({
      fill: '#000000',
      ...paintInit,
    })
  }

  // #region Rendering
  
  public render(context: GeotilerRenderingContext) {
    if (this.label == null) { return }

    for (const {x, y, rotation} of this.placeLabels()) {
      this.paint.drawText(context, this.label, x, y, rotation)
    }
  }
  
  // #endregion

  // #region Placement

  private *placeLabels(): Generator<LabelPlacement> {
    switch (this.feature.geometry.type) {
    case 'Point':
      yield *this.placeForPoint(this.feature.geometry.coordinates)
      break
    case 'MultiPoint':
      for (const coords of this.feature.geometry.coordinates) {
        yield *this.placeForPoint(coords)
      }
      break
    case 'Polygon':
      yield *this.placeForPolygon(this.feature.geometry.coordinates)
      break
    case 'MultiPolygon':
      for (const coords of this.feature.geometry.coordinates) {
        yield *this.placeForPolygon(coords)
      }
      break
    case 'LineString':
      yield *this.placeForLineString(this.feature.geometry.coordinates)
      break
    case 'MultiLineString':
      for (const coords of this.feature.geometry.coordinates) {
        yield *this.placeForLineString(coords)
      }
      break
    }
  }

  private *placeForPoint(coordinates: Position): Generator<LabelPlacement> {
    const [cx, cy] = this.tile.project(coordinates[0], coordinates[1])
    const rotation = 0

    yield {x: cx, y: cy + this.paint.fontSize(), rotation}
  }

  private *placeForPolygon(coordinates: Position[][]): Generator<LabelPlacement> {
    const points = coordinates.map(ring => ring.map(([lng, lat]) => this.tile.project(lng, lat)))
    const path = new Path(points)

    for (const placement of path.placeLabels(this.paint.labelPosition(), this.paint.labelCount())) {
      yield placement
    }
  }

  private *placeForLineString(coordinates: Position[]): Generator<LabelPlacement> {
    const points = coordinates.map(([lng, lat]) => this.tile.project(lng, lat))
    const path = new Path([points])

    for (const placement of path.placeLabels(this.paint.labelPosition(), this.paint.labelCount())) {
      yield placement
    }
  }

  // #endregion

}

export interface LabelRendererDelegate<P> {
  label:  (properties: P, feature: Feature<Geometry, P>) => string | undefined
  paint?: (properties: P, feature: Feature<Geometry, P>) => PaintInit
}
