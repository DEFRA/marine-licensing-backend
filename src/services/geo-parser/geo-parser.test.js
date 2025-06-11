import GeoParser from './geo-parser.js'
import KmlParser from './kml.js'
import ShapefileParser from './shapefile.js'

describe('GeoParser Interface', () => {
  it('should be implemented by KmlParser', () => {
    const parser = new KmlParser()
    expect(parser instanceof GeoParser).toBe(true)
    expect(typeof parser.parse).toBe('function')
  })

  it('should be implemented by ShapefileParser', () => {
    const parser = new ShapefileParser()
    expect(parser instanceof GeoParser).toBe(true)
    expect(typeof parser.parse).toBe('function')
  })
})
