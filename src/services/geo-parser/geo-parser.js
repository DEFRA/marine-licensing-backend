/**
 * Base interface for geo file parsing services
 */
class GeoParser {
  /**
   * Parse a geo file and return GeoJSON
   * @param {string} filename - The path to the file (absolute or relative)
   * @returns {Promise<Object>} The parsed GeoJSON object
   */
  async parse(filename) {
    throw new Error('Method not implemented')
  }
}

export default GeoParser
