import { Position } from 'geojson'
import { FeatureWithProps } from 'geojson-classes'
import { memoized } from 'ytil'

import { LabelPosition, Paint, PaintInit } from './Paint'
import { LabelPlacement, Path } from './Path'
import { RasterTile } from './RasterTile'
import { GeotilerRenderingContext } from './types'

export class LabelRenderer<P extends GeoJSON.GeoJsonProperties> {

  constructor(
    public readonly tile: RasterTile<P>,
    public readonly feature: FeatureWithProps<P>,
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

    for (const {x, y, rotation, accessory} of this.placeLabels()) {
      const label = accessory == null ? this.label : `${this.label} ${accessory}`
      this.paint.drawText(context, label, x, y, rotation)
    }
  }
  
  // #endregion

  // #region Placement

  private *placeLabels(): Generator<LabelPlacement> {
    if (this.feature.isPoint()) {
      yield *this.placeForPoint(this.feature.coordinates)
    } else if (this.feature.isPolygon()) {
      yield *this.placeForPolygon(this.feature.coordinates)
    } else if (this.feature.isMultiPolygon()) {
      for (const coords of this.feature.coordinates) {
        yield *this.placeForPolygon(coords)
      }
    }
  }

  private *placeForPoint(coordinates: Position): Generator<LabelPlacement> {
    const [cx, cy] = this.tile.project(coordinates[0], coordinates[1])
    const rotation = 0

    yield {
      x: cx,
      y: cy + this.paint.fontSize(),
      rotation,
      accessory: null,
    }
  }

  private *placeForPolygon(coordinates: Position[][]): Generator<LabelPlacement> {
    const points = coordinates.map(ring => ring.map(([lng, lat]) => this.tile.project(lng, lat)))
    const path = new Path(points)

    for (const placement of path.placeLabels(this.paint.labelPosition(), this.paint.labelCount())) {
      yield placement
    }
    for (const placement of path.placeLabels(LabelPosition.Center, this.paint.labelCount())) {
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

export interface LabelRendererDelegate<P extends GeoJSON.GeoJsonProperties> {
  label:  (properties: P, feature: FeatureWithProps<P>) => string | undefined
  paint?: (properties: P, feature: FeatureWithProps<P>) => PaintInit
}
