/**
 * Base interface for geo file parsing services
 */
class GeoParser {
  /**
   * Parse a geo file and return GeoJSON
   * @param {string} _filename - The path to the file (absolute or relative)
   * @returns {Promise<Object>} The parsed GeoJSON object
   */
  async parse(_filename) {
    throw new Error('Method not implemented')
  }
}

export default GeoParser
