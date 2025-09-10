import { createTaskList, COMPLETED } from './createTaskList'
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
          circleWidth: '100'
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: COMPLETED
    })
  })

  it('should mark site details as null when not all properties present in the single coordinate journey', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'single',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: { latitude: '54.978252', longitude: '-1.617780' }
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
      publicRegister: COMPLETED,
      projectName: COMPLETED
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
          }
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
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
          ]
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
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
          ]
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
      publicRegister: COMPLETED,
      projectName: COMPLETED,
      siteDetails: COMPLETED
    })
  })

  it('should not mark site details as COMPLETED when multiple coordinates has fewer than 3 points', () => {
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
          ]
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
      publicRegister: COMPLETED,
      projectName: COMPLETED
    })
  })

  it('should not mark site details as COMPLETED when coordinates field is missing for multiple entry', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
      publicRegister: COMPLETED,
      projectName: COMPLETED
    })
  })

  it('should not mark site details as COMPLETED when coordinates is not an array for multiple entry', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: [
        {
          coordinatesType: 'coordinates',
          coordinatesEntry: 'multiple',
          coordinateSystem: COORDINATE_SYSTEMS.WGS84,
          coordinates: { latitude: '54.088594', longitude: '-0.178408' }
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
      publicRegister: COMPLETED,
      projectName: COMPLETED
    })
  })

  it('should not mark site details as COMPLETED when coordinateSystem is missing for multiple entry', () => {
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
          ]
        }
      ],
      activityDescription: 'Test description'
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({
      activityDescription: COMPLETED,
      publicRegister: COMPLETED,
      projectName: COMPLETED
    })
  })

  it('should not return tasks when corresponding exemption properties do not exist', () => {
    const exemption = {
      publicRegister: '',
      projectName: null
    }

    const result = createTaskList(exemption)

    expect(result).toEqual({})
  })

  it('should not return tasks when corresponding exemption properties are missing', () => {
    const exemption = {}

    const result = createTaskList(exemption)

    expect(result).toEqual({})
  })
})
