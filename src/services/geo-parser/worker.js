import { parentPort, workerData } from 'worker_threads'
import { kmlParser } from './kml-parser.js'
import { shapefileParser } from './shapefile-parser.js'

async function processFile() {
  try {
    const { filePath, fileType } = workerData
    let geoJSON

    if (fileType === 'kml') {
      geoJSON = await kmlParser.parseFile(filePath)
    } else if (fileType === 'shapefile') {
      geoJSON = await shapefileParser.parseFile(filePath)
    } else {
      throw new Error(`Unsupported file type: ${fileType}`)
    }

    parentPort.postMessage({ geoJSON })
  } catch (error) {
    parentPort.postMessage({ error: error.message })
  }
}

processFile()
