import { createTaskList, COMPLETED } from './createTaskList'
import { COORDINATE_SYSTEMS } from '../../../common/constants/coordinates.js'

describe('createTaskList', () => {
  it('should mark tasks as COMPLETED when corresponding exemption properties exist', () => {
    const exemption = {
      publicRegister: 'Some value',
      projectName: 'Test Project',
      siteDetails: {
        coordinatesType: 'coordinates',
        coordinatesEntry: 'single',
        coordinateSystem: COORDINATE_SYSTEMS.WGS84,
        coordinates: { latitude: '54.978252', longitude: '-1.617780' },
        circleWidth: '100'
      },
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
