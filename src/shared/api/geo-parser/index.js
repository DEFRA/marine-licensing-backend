import { extractController } from './controllers/extract-controller.js'

export const geoParser = [
  {
    method: 'POST',
    path: '/geo-parser/extract',
    ...extractController
  }
]
