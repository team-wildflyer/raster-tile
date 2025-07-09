import { BBox, FeatureCollectionWithProps } from 'geojson-classes'
import { LayoutRect, memoized } from 'ytil'
import { FeatureRenderer } from './FeatureRenderer'
import { LabelRenderer } from './LabelRenderer'
import { FeatureRendererDelegate, GeotilerRenderingContext, LabelRendererDelegate } from './types'

export class RasterTile<P extends GeoJSON.GeoJsonProperties> {

  constructor(
    public readonly bbox: BBox,
    public readonly features: FeatureCollectionWithProps<P>,
    public readonly width: number,
    public readonly height: number,
    public readonly options: RasterTileOptions = {},
  ) {}

  @memoized
  public get paddingInPx(): [number, number] {
    const {padding = 0, paddingUnit = 'px'} = this.options
    if (paddingUnit === 'px') { return [padding, padding] }

    const lonSpan = this.bbox.lon2 - this.bbox.lon1
    const latSpan = this.bbox.lat2 - this.bbox.lat1
    const pxPerLonDeg = this.width / lonSpan
    const pxPerLatDeg = this.height / latSpan
    return [
      padding * pxPerLonDeg,
      padding * pxPerLatDeg,
    ]
  }

  // #region Interface

  public drawFeatures(context: GeotilerRenderingContext, delegate: FeatureRendererDelegate<P>) {
    context.clearRect(0, 0, this.width, this.height)
    
    const sorted = [...this.features]
    const {zIndex} = delegate
    if (zIndex != null) {
      sorted.sort((a, b) => zIndex(a.properties, a) - zIndex(b.properties, b))
    }

    // First render all features.
    for (const feature of sorted) {
      const renderer = new FeatureRenderer(this, feature, delegate)
      renderer.render(context)
    }
  }

  public drawLabels(context: GeotilerRenderingContext, delegate: LabelRendererDelegate<P>) {
    for (const feature of this.features) {
      const renderer = new LabelRenderer(this, feature, delegate)
      renderer.render(context)
    }
  }
  
  // #region Projection
  
  public get outerBounds(): LayoutRect {
    const [paddingX, paddingY] = this.paddingInPx
    return {
      left:   0, 
      top:    0, 
      width:  this.width + 2 * paddingX,
      height: this.height + 2 * paddingY,
    }
  }

  public get innerBounds(): LayoutRect {
    const [paddingX, paddingY] = this.paddingInPx
    return {
      left:   paddingX,
      top:    paddingY,
      width:  this.width,
      height: this.height,
    }
  }

  @memoized private get y1() { return mercatorY(this.bbox.lat1) }
  @memoized private get y2() { return mercatorY(this.bbox.lat2) }

  public project(lon: number, lat: number): [number, number] {
    const bbox = this.bbox
    const innerBounds = this.innerBounds

    const x = innerBounds.left + (lon - bbox.lon1) / (bbox.lon2 - bbox.lon1) * innerBounds.width
    const y = innerBounds.top + (1 - (mercatorY(lat) - this.y1) / (this.y2 - this.y1)) * innerBounds.height

    return [x, y]
  }

  // #endregion

}

function mercatorY(lat: number): number {
  const rad = lat * Math.PI / 180
  return Math.log(Math.tan(Math.PI / 4 + rad / 2))
}

export interface RasterTileOptions {
  /**
   * A padding to apply to the image for debugging purposes.
   */
  padding?: number

  /**
   * The unit of the padding.
   */
  paddingUnit?: 'px' | 'deg'
}