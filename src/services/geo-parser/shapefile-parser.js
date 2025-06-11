import GeoParser from './geo-parser.js'
import * as shapefile from 'shapefile'
import { glob } from 'glob'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import AdmZip from 'adm-zip'

/**
 * Shapefile parser service for .zip files containing shapefiles
 */
class ShapefileParser extends GeoParser {
  /**
   * Extract a zip file to a temporary directory
   * @param {string} zipPath - Path to the zip file
   * @returns {Promise<string>} Path to the temporary directory containing extracted files
   */
  async extractZip(zipPath) {
    const tempDir = await mkdtemp(join(tmpdir(), 'shapefile-'))
    const zip = new AdmZip(zipPath)
    zip.extractAllTo(tempDir, true)
    return tempDir
  }

  /**
   * Find all .shp files in a directory
   * @param {string} directory - Directory to search in
   * @returns {Promise<string[]>} Array of paths to .shp files
   */
  async findShapefiles(directory) {
    const shapefiles = await glob('**/*.shp', {
      cwd: directory,
      absolute: true
    })
    return shapefiles
  }

  /**
   * Parse a shapefile and return GeoJSON
   * @param {string} shpPath - Path to the .shp file
   * @returns {Promise<Object>} The parsed GeoJSON object
   */
  async parseShapefile(shpPath) {
    const geoJson = await shapefile.read(shpPath)
    return geoJson
  }

  /**
   * Parse a zip file containing shapefiles and return GeoJSON
   * @param {string} filename - Path to the zip file
   * @returns {Promise<Object>} The parsed GeoJSON object containing all features from all shapefiles
   */
  async parse(filename) {
    // console.log('parsing shapefile ', filename)
    try {
      // Extract zip file
      const extractDir = await this.extractZip(filename)
      console.log('extractDir', extractDir)

      try {
        // Find all shapefiles
        const shapefiles = await this.findShapefiles(extractDir)
        // console.log('shapefiles', shapefiles)

        if (shapefiles.length === 0) {
          throw new Error('No shapefiles found in zip archive')
        }

        // Parse each shapefile and combine features
        const allFeatures = []
        for (const shpPath of shapefiles) {
          // console.log('about to extract ', shpPath)
          const geoJson = await this.parseShapefile(shpPath)
          // console.log('extracting ', shpPath)
          allFeatures.push(...geoJson.features)
        }

        return {
          type: 'FeatureCollection',
          features: allFeatures
        }
      } finally {
        // Clean up extracted files
        await rm(extractDir, { recursive: true, force: true })
      }
    } catch (error) {
      throw new Error(`Failed to parse shapefile: ${error.message}`)
    }
  }
}

export default ShapefileParser
