import { GeotilerRenderingContext } from './types'

export class Paint {

  constructor(init: PaintInit = {}) {
    this.props = {
      fill:      null,
      stroke:    null,
      lineWidth: 1,

      fontSize:       12,
      textPadding:    2,
      labelPosition:  LabelPosition.Center,
      labelCount:     1, // This is for some reason not working for N > 1.
      labelClearRect: false,

      bezier: false,
      ...init,
    }
  }

  private props: Required<PaintInit>

  public fill() { return this.props.fill }
  public stroke() { return this.props.stroke }
  public lineWidth() { return this.props.lineWidth }
  public fontSize() { return this.props.fontSize }
  public textPadding() { return this.props.textPadding }
  public labelPosition() { return this.props.labelPosition }
  public labelCount() { return this.props.labelCount }
  public bezier() { return this.props.bezier }

  public draw(context: GeotilerRenderingContext) {
    context.save()
    try {
      if (this.props.fill != null) {
        context.fillStyle = this.props.fill
        context.fill()
      }
      if (this.props.stroke != null && this.props.lineWidth > 0) {
        context.strokeStyle = this.props.stroke
        context.lineWidth = this.props.lineWidth
        context.stroke()
      }
    } finally {
      context.restore()
    }
  }

  public drawText(context: GeotilerRenderingContext, text: string, cx: number, cy: number, rotation: number) {
    context.save()
    try {
      context.fillStyle = this.props.fill ?? 'black'
      context.textAlign = 'center'
      context.textBaseline = 'top'
      context.strokeStyle = 'transparent'
      context.lineWidth = 0
      context.font = `${this.props.fontSize}px sans-serif`

      const metrics = context.measureText(text)
      const width = metrics.width + 2 * this.textPadding()
      const height = (metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent) + 2 * this.textPadding()

      const rect = {
        x: cx - width / 2,
        y: cy - height / 2,

        width, height,
      }

      context.translate(cx, cy)
      context.rotate(rotation * Math.PI / 180)
      context.translate(-cx, -cy)

      if (this.props.labelClearRect) {
        context.clearRect(rect.x, rect.y, rect.width, rect.height)
      }
      context.fillText(text, cx, rect.y + this.textPadding() + metrics.actualBoundingBoxAscent)
    } finally {
      context.restore()
    }
  }


}

export interface PaintInit {
  fill?:      string | null
  stroke?:    string | null
  lineWidth?: number

  fontSize?:    number
  textPadding?: number

  labelPosition?:  LabelPosition
  labelCount?:     number
  labelClearRect?: boolean

  bezier?: boolean
}

export enum LabelPosition {
  Center,
  Outline,
}