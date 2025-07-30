import { parentPort, workerData } from 'worker_threads'
import { kmlParser } from './kml-parser.js'
import { shapefileParser } from './shapefile-parser.js'

export async function processFile(data = workerData, messagePort = parentPort) {
  try {
    const { filePath, fileType } = data
    let geoJSON

    if (fileType === 'kml') {
      geoJSON = await kmlParser.parseFile(filePath)
    } else if (fileType === 'shapefile') {
      geoJSON = await shapefileParser.parseFile(filePath)
    } else {
      throw new Error(`Unsupported file type: ${fileType}`)
    }

    messagePort.postMessage({ geoJSON })
  } catch (error) {
    messagePort.postMessage({ error: error.message })
  }
}

// Run automatically when loaded as a worker thread (not in test/import context)
if (parentPort && workerData) {
  processFile()
}
