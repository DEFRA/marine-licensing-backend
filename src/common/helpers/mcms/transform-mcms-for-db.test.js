import { activityTypes } from '../../constants/mcms-context.js'
import { transformMcmsContextForDb } from './transform-mcms-for-db.js'

describe('transformMcmsContextForDb', () => {
  it('should return correct labels for each activity type when used in transform function', () => {
    Object.entries(activityTypes).forEach(([key, expectedActivityType]) => {
      const mockContext = { activityType: key }
      const result = transformMcmsContextForDb(mockContext)
      expect(result.activity.code).toBe(expectedActivityType.code)
      expect(result.activity.label).toBe(expectedActivityType.label)
    })
  })

  it('should add purpose label for Construction activity type', () => {
    const mockContext = { activityType: 'CON', article: '25' }
    const result = transformMcmsContextForDb(mockContext)

    expect(result.activity.purpose).toEqual('Moorings or aids to navigation')
  })

  it('should add purpose label for Deposit activity type', () => {
    const mockContext = { activityType: 'DEPOSIT', article: '13' }
    const result = transformMcmsContextForDb(mockContext)

    expect(result.activity.purpose).toBe('Shellfish propagation or cultivation')
  })

  it('should add purpose label for Removal activity type', () => {
    const mockContext = { activityType: 'REMOVAL', article: '17A' }
    const result = transformMcmsContextForDb(mockContext)

    expect(result.activity.purpose).toBe('Samples for testing or analysis')
  })

  it('should add purpose label for Dredging activity type', () => {
    const mockContext = { activityType: 'DREDGE', article: '18A' }
    const result = transformMcmsContextForDb(mockContext)

    expect(result.activity.purpose).toBe('Navigational dredging')
  })

  it('should handle activity types without purposes', () => {
    const mockContext = { activityType: 'INCINERATION' }
    const result = transformMcmsContextForDb(mockContext)

    expect(result.activity.purpose).toBeUndefined()
  })

  it('should return a full transformed object', () => {
    const mockContext = {
      activityType: 'CON',
      article: '25',
      activitySubtype: 'pontoons',
      pdfDownloadUrl:
        'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f'
    }
    const result = transformMcmsContextForDb(mockContext)

    expect(result).toEqual({
      activity: {
        code: 'CON',
        label: 'Construction',
        purpose: 'Moorings or aids to navigation',
        subType: 'pontoons'
      },
      articleCode: '25',
      pdfDownloadUrl:
        'https://marinelicensing.marinemanagement.org.uk/path/journey/self-service/outcome-document/b87ae3f7-48f3-470d-b29b-5a5abfdaa49f'
    })
  })

  it('should return undefined if no activityType is provided', () => {
    const mockContext = {
      activityType: undefined,
      article: '25',
      activitySubtype: 'pontoons'
    }
    const result = transformMcmsContextForDb(mockContext)
    expect(result).toBeNull()
  })
})
