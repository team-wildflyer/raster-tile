import {
  area,
  bbox,
  booleanPointInPolygon,
  explode,
  featureCollection,
  getCoords,
  multiPolygon,
  polygon,
} from '@turf/turf'
import {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiPolygon,
  Point,
  Polygon,
} from 'geojson'
import { sortBy } from 'lodash'
import { isoBands as marchingsquares_isobands } from 'marching-squares'
import { MapBuilder, sparse } from 'ytil'

export interface IsobandsOptions {
  commonProperties?: GeoJsonProperties
  breaksProperties?: GeoJsonProperties[]
}

export function isobands(points: FeatureCollection<Point>, property: string, breaks: number[], options: IsobandsOptions = {}): FeatureCollection<MultiPolygon> {
  const commonProperties = options.commonProperties ?? {}
  const breaksProperties = options.breaksProperties == null ? undefined : [...options.breaksProperties]

  if (breaks.length < 2) {
    return featureCollection([])
  }

  // 1. Convert to matrix to feed into marching squares.
  const matrix = valueMatrix(points, property)

  // 2. Find out the thresholds and bandwidths based on whether this is an increasing or decreasing classification.

  const increasing = breaks[breaks.length - 1] >= breaks[0]
  const valuesFlat = sparse(matrix.flat())
  const extreme = increasing ? Math.max(...valuesFlat) : Math.min(...valuesFlat)

  const thresholds = breaks.map(it => increasing ? it : extreme)
  const bandwidths = breaks.map(it => increasing ? extreme - it : it - extreme)

  const zeroIndexes = sparse(bandwidths.map((it, idx) => it <= 0 ? idx : null)).sort().reverse()
  for (const idx of zeroIndexes) {
    thresholds.splice(idx, 1)
    bandwidths.splice(idx, 1)
    breaksProperties?.splice(idx, 1)
  }

  // 3. Use marching square's isoBands to get the polygon rings.
  const rings = marchingsquares_isobands(matrix, thresholds, bandwidths).map(rings => {
    // In the past we would get a "ring" with two coordinates. Ditch those.
    const valid = rings.filter(it => it.length >= 3)
    
    // Order by area so that even-odd rule works.
    const ordered = sortBy(valid, it => -area(polygon([it])))

    // Group nested rings.
    return groupNestedRings(ordered)
  })

  // 4. Rescale the normalized rings back into the actual coordinates.
  const rescaled = rescaleContours(rings, matrix, points)

  // 5. Build multipolygons out of them.
  return featureCollection(sparse(rescaled.map((rings, index) => {
    if (rings.length === 0) { return null }
    if (rings.every(it => it.length === 0)) { return null }
    
    return multiPolygon(rings, {
      ...commonProperties,
      ...breaksProperties?.[index],
      [property]: breaks[index],
    })
  })))
}

// #region Utility functions

function valueMatrix(grid: FeatureCollection<Point>, property: string): number[][] {
  return pointMatrix(grid).map(row => row.map(point => point.properties?.[property]))
}

function pointMatrix(points: FeatureCollection<Point>): Feature<Point>[][] {
  const groupedByLatitude = MapBuilder.groupBy(points.features, point => getCoords(point)[1])
  const orderedByLatitude = sortBy(Array.from(groupedByLatitude.values()), it => getCoords(it[0])[1])
  return orderedByLatitude.map(row => sortBy(row, it => getCoords(it)[0]))
}

function rescaleContours(rings: Ring[][][], matrix: number[][], points: FeatureCollection<Point>): Ring[][][] {
  const gridBbox = bbox(points)
  const originalWidth = gridBbox[2] - gridBbox[0]
  const originalHeigth = gridBbox[3] - gridBbox[1]

  const x0 = gridBbox[0]
  const y0 = gridBbox[1]

  const matrixWidth = matrix[0].length - 1
  const matrixHeight = matrix.length - 1

  const scaleX = originalWidth / matrixWidth
  const scaleY = originalHeigth / matrixHeight

  // resize and shift each point/line of the isobands
  return rings.map(rings => rings.map(rings => rings.map(ring => ring.map(coord => [
    coord[0] * scaleX + x0,
    coord[1] * scaleY + y0,
  ] as Coord))))
}

/**
 * Returns an array of arrays of coordinates, each representing
 * a set of (coordinates of) nested LinearRings,
 * i.e. the first ring contains all the others
 *
 * @private
 * @param {Array} orderedLinearRings array of coordinates (of LinearRings) in descending order by area
 * @returns {Array<Array>} Array of coordinates of nested LinearRings
 */
function groupNestedRings(orderedLinearRings: Ring[]): Ring[][] {
  // create a list of the (coordinates of) LinearRings
  const lrList = orderedLinearRings.map((lr) => {
    return {lrCoordinates: lr, grouped: false}
  })
  const groupedLinearRingsCoords: Ring[][] = []

  while (!allGrouped(lrList)) {
    for (let i = 0; i < lrList.length; i++) {
      if (!lrList[i].grouped) {
        // create new group starting with the larger not already grouped ring
        const group: Ring[] = []
        group.push(lrList[i].lrCoordinates)
        lrList[i].grouped = true
        const outerMostPoly = polygon([lrList[i].lrCoordinates])
        // group all the rings contained by the outermost ring
        for (let j = i + 1; j < lrList.length; j++) {
          if (!lrList[j].grouped) {
            const lrPoly = polygon([lrList[j].lrCoordinates])
            if (isInside(lrPoly, outerMostPoly)) {
              group.push(lrList[j].lrCoordinates)
              lrList[j].grouped = true
            }
          }
        }
        // insert the new group
        groupedLinearRingsCoords.push(group)
      }
    }
  }
  return groupedLinearRingsCoords
}

/**
 * @private
 * @param {Polygon} testPolygon polygon of interest
 * @param {Polygon} targetPolygon polygon you want to compare with
 * @returns {boolean} true if test-Polygon is inside target-Polygon
 */
function isInside(
  testPolygon: Feature<Polygon>,
  targetPolygon: Feature<Polygon>,
): boolean {
  const points = explode(testPolygon)
  for (let i = 0; i < points.features.length; i++) {
    if (!booleanPointInPolygon(points.features[i], targetPolygon)) {
      return false
    }
  }
  return true
}

/**
 * @private
 * @param {Array<Object>} list list of objects which might contain the 'group' attribute
 * @returns {boolean} true if all the objects in the list are marked as grouped
 */
function allGrouped(
  list: { grouped: boolean; lrCoordinates: Ring }[],
): boolean {
  for (let i = 0; i < list.length; i++) {
    if (list[i].grouped === false) {
      return false
    }
  }
  return true
}

// #endregion

// #region Types

export type Coord = [number, number]
export type Ring = Coord[]

// #endregion