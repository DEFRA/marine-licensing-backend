import proj4 from 'proj4'

const BRITISH_NATIONAL_GRID_PROJECTION = 'tmerc'
const TRUE_ORIGIN_LATITUDE = 49
const TRUE_ORIGIN_LONGITUDE = -2
const CENTRAL_MERIDIAN_SCALE_FACTOR = 0.9996012717
const FALSE_EASTING = 400000
const FALSE_NORTHING = -100000
const ELLIPSOID = 'airy'

// Helmert Transformation Parameters (OSGB36 to WGS84)
// These parameters provide ~3m accuracy transformation
const HELMERT_DX = 446.448
const HELMERT_DY = -125.157
const HELMERT_DZ = 542.06
const HELMERT_RX = 0.15
const HELMERT_RY = 0.247
const HELMERT_RZ = 0.842
const HELMERT_SCALE = -20.489

const BRITISH_NATIONAL_GRID_DEFINITION = [
  `+proj=${BRITISH_NATIONAL_GRID_PROJECTION}`,
  `+lat_0=${TRUE_ORIGIN_LATITUDE}`,
  `+lon_0=${TRUE_ORIGIN_LONGITUDE}`,
  `+k=${CENTRAL_MERIDIAN_SCALE_FACTOR}`,
  `+x_0=${FALSE_EASTING}`,
  `+y_0=${FALSE_NORTHING}`,
  `+ellps=${ELLIPSOID}`,
  `+towgs84=${HELMERT_DX},${HELMERT_DY},${HELMERT_DZ},${HELMERT_RX},${HELMERT_RY},${HELMERT_RZ},${HELMERT_SCALE}`,
  '+units=m',
  '+no_defs',
  '+type=crs'
].join(' ')

proj4.defs('OSGB36', BRITISH_NATIONAL_GRID_DEFINITION)
