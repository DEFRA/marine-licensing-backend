import GeoParser from './geo-parser.js'
import KmlParser from './kml-parser.js'
import ShapefileParser from './shapefile-parser.js'

describe('GeoParser Interface', () => {
  it('should throw when base class parse method is called', async () => {
    const parser = new GeoParser()
    await expect(parser.parse('test.file')).rejects.toThrow(
      'Method not implemented'
    )
  })

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
