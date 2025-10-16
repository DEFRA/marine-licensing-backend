import {
  createTaskList,
  COMPLETED,
  IN_PROGRESS,
  INCOMPLETE
} from './createTaskList'
import { COORDINATE_SYSTEMS } from '../../../common/constants/coordinates.js'

describe('createTaskList', () => {
  it('should mark tasks as COMPLETED when corresponding exemption properties exist for all properties in the single coordinate journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'single',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: { latitude: '54.978252', longitude: '-1.617780' },
          circleWidth: '100',
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: COMPLETED
    })
  })

  it('should mark site details as IN_PROGRESS when not all properties present in the single coordinate circular journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'single',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: { latitude: '54.978252', longitude: '-1.617780' },
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })

  it('should mark site details as IN_PROGRESS when not all properties present in the manual polygon journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })

  it('should mark site details as IN_PROGRESS when not all properties present in the file journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'file',
          fileUploadType: 'kml'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })

  it('should mark site details as COMPLETED for valid file upload', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'file',
          fileUploadType: 'kml',
          s3Location: {
            s3Bucket: 'mmo-uploads',
            s3Key: 'test-file-key',
            checksumSha256: 'test-checksum'
          },
          featureCount: 1,
          geoJSON: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [-1.2951, 50.7602]
                },
                properties: {}
              }
            ]
          },
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: COMPLETED
    })
  })

  it('should mark site details as COMPLETED for valid multiple coordinates', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '54.088594', longitude: '-0.178408' },
            { latitude: '54.086782', longitude: '-0.177369' },
            { latitude: '54.088057', longitude: '-0.175219' }
          ],
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: COMPLETED
    })
  })

  it('should mark site details as COMPLETED for valid OSGB36 multiple coordinates', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.OSGB36,
          coordinates: [
            { eastings: '513967', northings: '476895' },
            { eastings: '514040', northings: '476693' },
            { eastings: '514193', northings: '476835' }
          ],
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: COMPLETED
    })
  })

  it('should mark site details as IN_PROGRESS when multiple coordinates has fewer than 3 points', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: [
            { latitude: '54.088594', longitude: '-0.178408' },
            { latitude: '54.086782', longitude: '-0.177369' }
          ],
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })

  it('should mark site details as IN_PROGRESS when coordinates field is missing for multiple entry', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })

  it('should mark site details as IN_PROGRESS when coordinates is not an array for multiple entry', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: { latitude: '54.088594', longitude: '-0.178408' },
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })

  it('should mark site details as IN_PROGRESS when coordinateSystem is missing for multiple entry', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinates: [
            { latitude: '54.088594', longitude: '-0.178408' },
            { latitude: '54.086782', longitude: '-0.177369' },
            { latitude: '54.088057', longitude: '-0.175219' }
          ],
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: IN_PROGRESS
    })
  })

  it('should return tasks as INCOMPLETE when corresponding exemption properties are missing', () => {
    const exemption = {}

    const result = createTaskList(exemption)

    expect(result).toEqual({
      projectName: 'INCOMPLETE',
      publicRegister: 'INCOMPLETE',
      siteDetails: 'INCOMPLETE'
    })
  })

  it('should mark site details as INCOMPLETE when all properties present in the single coordinate circular journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'single'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: INCOMPLETE
    })
  })

  it('should mark site details as INCOMPLETE when all properties not present in the manual polygon journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: INCOMPLETE
    })
  })

  it('should mark site details as INCOMPLETE when all properties NOT present in the file journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'file'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: INCOMPLETE
    })
  })

  it('should mark site details as INCOMPLETE when one site is complete but another is not ', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      multipleSiteDetails: { multipleSitesEnabled: true },
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'single',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: { latitude: '54.978252', longitude: '-1.617780' },
          circleWidth: '100',
          activityDates: { start: '2024-01-01', end: '2024-12-31' },
          activityDescription: 'Test description',
          siteName: 'test'
        },
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'single'
        }
      ]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: INCOMPLETE
    })
  })

  it('should correctly handle an empty object', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [{}]
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: INCOMPLETE
    })
  })
})
