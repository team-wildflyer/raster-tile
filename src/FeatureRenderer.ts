import { Feature, Geometry, Position } from 'geojson'
import { memoized } from 'ytil'
import { Paint, PaintInit } from './Paint'
import { Path } from './Path'
import { RasterTile } from './RasterTile'
import { GeotilerRenderingContext } from './types'

export class FeatureRenderer<P> {

  constructor(
    public readonly tile: RasterTile<P>,
    public readonly feature: Feature<Geometry, P>,
    public readonly delegate: FeatureRendererDelegate<P>,
  ) {}

  @memoized
  private get paint() {
    const paintInit = this.delegate.paint(this.feature.properties, this.feature)
    return new Paint(paintInit)
  }

  // #region Rendering
  
  public render(context: GeotilerRenderingContext) {
    switch (this.feature.geometry.type) {
    case 'Point':
      this.renderPoint(context, this.feature.geometry.coordinates)
      break
    case 'MultiPoint':
      this.renderMultiPoint(context, this.feature.geometry.coordinates)
      break
    case 'Polygon':
      this.renderPolygon(context, this.feature.geometry.coordinates)
      break
    case 'MultiPolygon':
      this.renderMultiPolygon(context, this.feature.geometry.coordinates)
      break
    case 'LineString':
      this.renderLineString(context, this.feature.geometry.coordinates)
      break
    case 'MultiLineString':
      this.renderMultiLineString(context, this.feature.geometry.coordinates)
      break
    }
  }

  private renderMultiPoint(context: GeotilerRenderingContext, coordinates: Position[]) {
    for (const coords of coordinates) {
      this.renderPoint(context, coords)
    }
  }

  private renderPoint(context: GeotilerRenderingContext, coordinates: Position) {
    const [cx, cy] = this.tile.project(coordinates[0], coordinates[1])

    context.beginPath()
    context.ellipse(cx, cy, 2, 2, 0, 0, 2 * Math.PI)
    this.paint.draw(context)
  }
  
  private renderMultiPolygon(context: GeotilerRenderingContext, coordinates: Position[][][]) {
    for (const coords of coordinates) {
      this.renderPolygon(context, coords)
    }
  }

  private renderPolygon(context: GeotilerRenderingContext, coordinates: Position[][]) {
    const points = coordinates.map(ring => ring.map(([lng, lat]) => this.tile.project(lng, lat)))
    const path = new Path(points)

    context.beginPath()
    if (this.paint.bezier()) {
      path.drawCatmullRom(context)
    } else {
      path.drawLinear(context)
    }
    this.paint.draw(context)
  }

  private renderMultiLineString(context: GeotilerRenderingContext, coordinates: Position[][]) {
    for (const coords of coordinates) {
      this.renderLineString(context, coords)
    }
  }

  private renderLineString(context: GeotilerRenderingContext, coordinates: Position[]) {
    const points = coordinates.map(([lng, lat]) => this.tile.project(lng, lat))
    const path = new Path([points])

    if (this.paint.bezier()) {
      path.drawCatmullRom(context)
    } else {
      path.drawLinear(context)
    }
    this.paint.draw(context)
  }
  
  // #endregion

}

export interface FeatureRendererDelegate<P> {
  paint: (properties: P, feature: Feature<Geometry, P>) => PaintInit
}
