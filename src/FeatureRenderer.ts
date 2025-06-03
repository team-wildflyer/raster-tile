import { Position } from 'geojson'
import { FeatureWithProps } from 'geojson-classes'
import { memoized } from 'ytil'
import { Paint } from './Paint'
import { Path } from './Path'
import { RasterTile } from './RasterTile'
import { FeatureRendererDelegate, GeotilerRenderingContext } from './types'

export class FeatureRenderer<P extends GeoJSON.GeoJsonProperties> {

  constructor(
    public readonly tile: RasterTile<P>,
    public readonly feature: FeatureWithProps<P>,
    public readonly delegate: FeatureRendererDelegate<P>,
  ) {}

  @memoized
  private get paint() {
    const paintInit = this.delegate.paint(this.feature.properties, this.feature)
    return new Paint(paintInit)
  }

  // #region Rendering
  
  public render(context: GeotilerRenderingContext) {
    if (this.feature.isPoint()) {
      this.renderPoint(context, this.feature.coordinates)
    } else if (this.feature.isPolygon()) {
      this.renderPolygon(context, this.feature.coordinates)
    } else if (this.feature.isMultiPolygon()) {
      this.renderMultiPolygon(context, this.feature.coordinates)
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

  // #endregion

}