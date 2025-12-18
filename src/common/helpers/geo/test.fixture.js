import { COORDINATE_SYSTEMS } from '../../constants/coordinates.js'

export const mockFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {
        info: 'Test area 1'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-4.619296988999963, 51.405308601000058],
            [-4.619285544999968, 51.405262830000026],
            [-4.619085277999943, 51.404660180000064],
            [-4.618419607999954, 51.401860526000064],
            [-4.61841958499997, 51.401063347000047],
            [-4.619018420999964, 51.400994684000068],
            [-4.619306169999959, 51.405348480000043],
            [-4.619296988999963, 51.405308601000058]
          ]
        ]
      }
    },
    {
      type: 'Feature',
      properties: {
        info: 'Test area 1'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-4.619296988999963, 51.405308601000058],
            [-4.619285544999968, 51.405262830000026],
            [-4.619085277999943, 51.404660180000064],
            [-4.618419607999954, 51.401860526000064],
            [-4.61841958499997, 51.401063347000047],
            [-4.619018420999964, 51.400994684000068],
            [-4.619306169999959, 51.405348480000043],
            [-4.619296988999963, 51.405308601000058]
          ]
        ]
      }
    }
  ]
}

export const mockSiteWGS84 = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: COORDINATE_SYSTEMS.WGS84,
  coordinates: { latitude: '51.489676', longitude: '-0.231530' },
  circleWidth: '20'
}

export const mockSiteOSGB36 = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'single',
  coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
  coordinates: { eastings: '513967', northings: '476895' },
  circleWidth: '20'
}

export const mockSiteMultipleWGS84 = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: COORDINATE_SYSTEMS.WGS84,
  coordinates: [
    {
      latitude: '54.088594',
      longitude: '-0.178408'
    },
    {
      latitude: '54.086782',
      longitude: '-0.177369'
    },
    {
      latitude: '54.088057',
      longitude: '-0.175219'
    }
  ]
}

export const mockSiteMultipleOSGB36 = {
  coordinatesType: 'coordinates',
  coordinatesEntry: 'multiple',
  coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
  coordinates: [
    {
      eastings: '513967',
      northings: '476895'
    },
    {
      eastings: '514040',
      northings: '476693'
    },
    {
      eastings: '514193',
      northings: '476835'
    }
  ]
}

export const mockSiteFile = {
  coordinatesType: 'file',
  fileUploadType: 'shapefile',
  geoJSON: {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-2.6561784467249394, 55.6217431238072],
              [-2.3132402554949936, 55.32224616938891],
              [-2.9479108792966926, 55.331328251526465],
              [-2.6561784467249394, 55.6217431238072]
            ]
          ]
        }
      }
    ]
  }
}

export const mockPointGeometry = {
  type: 'Point',
  coordinates: [-1.5491, 54.9783]
}

export const mockPolygonGeometry = {
  type: 'Polygon',
  coordinates: [
    [
      [-1.5492, 54.9783],
      [-1.5491, 54.9784],
      [-1.549, 54.9783],
      [-1.5491, 54.9782],
      [-1.5492, 54.9783]
    ]
  ]
}

export const mockMarinePlanAreas = ['North east inshore', 'South west inshore']
