import { FeatureCollection, Geometry } from 'geojson'
import { BBox } from 'geojson-classes'
import { memoized } from 'ytil'
import { FeatureRenderer, FeatureRendererDelegate } from './FeatureRenderer'
import { LabelRenderer, LabelRendererDelegate } from './LabelRenderer'
import { GeotilerRenderingContext } from './types'

export class TileRenderer<P> {

  constructor(
    public readonly bbox: BBox,
    public readonly features: FeatureCollection<Geometry, P>,
    public readonly width: number,
    public readonly height: number,
    public readonly options: GeotileOptions = {},
  ) {}

  @memoized
  private get paddingX() {
    const {padding = 0, paddingUnit = 'px'} = this.options
    if (paddingUnit === 'px') { return padding }

    const lonSpan = this.bbox.lon2 - this.bbox.lon1
    const pxPerLonDeg = this.width / lonSpan
    return padding * pxPerLonDeg
  }

  @memoized
  private get paddingY() {
    const {padding = 0, paddingUnit = 'px'} = this.options
    if (paddingUnit === 'px') { return padding }

    const latSpan = this.bbox.lat2 - this.bbox.lat1
    const pxPerLatDeg = this.height / latSpan
    return padding * pxPerLatDeg
  }

  // #region Interface

  public drawFeatures(context: GeotilerRenderingContext, delegate: FeatureRendererDelegate<P>, options: DrawFeaturesOptions = {}) {
    context.clearRect(0, 0, this.width, this.height)

    if (options.blur) {
      context.filter = `blur(${options.blur}px)`
    }

    // First render all features.
    for (const feature of this.features.features) {
      const renderer = new FeatureRenderer(this, feature, delegate)
      renderer.render(context)
    }
  }

  public drawLabels(context: GeotilerRenderingContext, delegate: LabelRendererDelegate<P>) {
    for (const feature of this.features.features) {
      const renderer = new LabelRenderer(this, feature, delegate)
      renderer.render(context)
    }
  }

  public drawDebugInfo(context: GeotilerRenderingContext, z: number, x: number, y: number) {

    // Render a border around the tile.
    context.save()
    context.strokeStyle = '#0000ff'
    context.lineWidth = 1
    context.setLineDash([5, 5])
    context.strokeRect(this.paddingX, this.paddingY, this.width, this.height)
    context.restore()

    // Render the tile's coordinates.
    context.save()
    context.fillStyle = '#000000'
    context.font = '12px sans-serif'
    context.fillText(
      `[${z},${x},${y}]`,
      this.paddingX + 5,
      this.paddingY + 15,
    )
    context.restore()
  }
  
  // #region Projection
  
  public project(lon: number, lat: number): [number, number] {
    const bbox = this.bbox
    const x = (lon - bbox.lon1) / (bbox.lon2 - bbox.lon1) * this.width
    const y = (1 - (lat - bbox.lat1) / (bbox.lat2 - bbox.lat1)) * this.height

    return [
      (x + this.paddingX),
      (y + this.paddingY),
    ]
  }

  // #endregion

  // #endregion

}

export interface GeotileOptions {
  /**
   * Whether to colorize the tile.
   */
  color?: boolean

  /**
   * Whether or not to include labels.
   */
  labels?: boolean

  /**
   * A padding to apply to the image for debugging purposes.
   */
  padding?: number

  /**
   * The unit of the padding.
   */
  paddingUnit?: 'px' | 'deg'
}

export interface DrawFeaturesOptions {
  blur?: number
}