import { CanvasRenderingContext2D as NodeCanvasRenderingContext2D } from 'canvas'
import { FeatureWithProps } from 'geojson-classes'
import { PaintInit } from './Paint'

export type GeotilerRenderingContext = CanvasRenderingContext2D | NodeCanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

export interface LabelPlacement {
  x:           number
  y:           number
  rotation:    number
  insideIsUp?: boolean
}

export enum LabelAccessory {
  ArrowUp = '↑',
  ArrowDown = '↓',
}

export interface FeatureRendererDelegate<P extends GeoJSON.GeoJsonProperties> {
  paint:   (properties: P, feature: FeatureWithProps<P>) => PaintInit
  zIndex?: (properties: P, feature: FeatureWithProps<P>) => number
}

export interface LabelRendererDelegate<P extends GeoJSON.GeoJsonProperties> {
  label:  (properties: P, placement: LabelPlacement, feature: FeatureWithProps<P>) => string | undefined
  paint?: (properties: P, feature: FeatureWithProps<P>) => PaintInit
}

export interface LabelPlacementDelegate {

}