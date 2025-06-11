import GeoParser from './geo-parser.js'
import { kml } from '@tmcw/togeojson'
import { promises as fs } from 'fs'
import { JSDOM } from 'jsdom'

/**
 * KML file parser service
 */
class KmlParser extends GeoParser {
  /**
   * Parse a KML file and return GeoJSON
   * @param {string} filename - The path to the file (absolute or relative)
   * @returns {Promise<Object>} The parsed GeoJSON object
   */
  async parse(filename) {
    try {
      // Read the KML file
      const kmlContent = await fs.readFile(filename, 'utf8')

      // Parse KML content to XML DOM using jsdom
      const dom = new JSDOM(kmlContent, { contentType: 'application/xml' })

      // Convert to GeoJSON
      const geoJson = kml(dom.window.document)

      return geoJson
    } catch (error) {
      throw new Error(`Failed to parse KML file: ${error.message}`)
    }
  }
}

export default KmlParser
