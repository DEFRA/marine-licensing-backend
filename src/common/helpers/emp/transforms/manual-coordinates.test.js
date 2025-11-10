import { testExemptions } from './test-exemptions.fixture.js'
import { manualCoordsToEmpGeometry } from './manual-coordinates.js'

describe('manualCoordsToEmpGeometry', () => {
  it('converts multiple coordinates (polygon) to EMP format', () => {
    const exemptionWithPolygonSites = testExemptions.find(
      (e) => e.dbRecord.projectName === 'Manual - polygons'
    )
    const {
      dbRecord: { siteDetails },
      expected
    } = exemptionWithPolygonSites
    const rings = manualCoordsToEmpGeometry(siteDetails)
    expect(rings).toEqual(expected.geometry.rings)
  })

  it('converts circle to EMP format', () => {
    const exemptionWithCircleSites = testExemptions.find(
      (e) => e.dbRecord.projectName === 'Manual - circles'
    )
    const {
      dbRecord: { siteDetails },
      expected
    } = exemptionWithCircleSites
    const rings = manualCoordsToEmpGeometry(siteDetails, true)
    expect(rings).toEqual(expected.geometry.rings)
  })

  it('throws error if coordinates are not in the correct format', () => {
    const exemptionWithPolygonSites = testExemptions.find(
      (e) => e.dbRecord.projectName === 'Manual - polygons'
    )
    const {
      dbRecord: { siteDetails }
    } = exemptionWithPolygonSites
    expect(() =>
      manualCoordsToEmpGeometry([
        { ...siteDetails[0], coordinatesEntry: undefined }
      ])
    ).toThrow('Invalid coordinatesEntry: undefined')
  })
})
