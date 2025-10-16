import { readFile } from 'node:fs/promises'
import { JSDOM } from 'jsdom'
import * as togeojson from '@tmcw/togeojson'
import { createLogger } from '../../common/helpers/logging/logger.js'
import Boom from '@hapi/boom'

const logger = createLogger()

export class KmlParser {
  logSystem = 'FileUpload:KmlParser'

  async parseFile(filePath) {
    logger.info({ filePath }, `${this.logSystem}: Parsing KML file`)

    try {
      const kmlContent = await readFile(filePath, 'utf-8')

      const dom = new JSDOM(kmlContent, {
        contentType: 'application/xml'
      })

      const geoJSON = togeojson.kml(dom.window.document)

      logger.info(
        {
          filePath,
          featureCount: geoJSON.features?.length || 0
        },
        `${this.logSystem}: Successfully parsed KML file`
      )

      return geoJSON
    } catch (error) {
      logger.error(
        {
          filePath,
          error
        },
        `${this.logSystem}: Failed to parse KML file`
      )

      if (error.message.includes('Invalid XML')) {
        throw Boom.badRequest('Invalid KML file format')
      }

      throw Boom.internal(`KML parsing failed: ${error.message}`)
    }
  }
}
export const kmlParser = new KmlParser()
