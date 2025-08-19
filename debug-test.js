import { siteDetailsSchema } from './src/models/site-details/site-details.js'
import {
  mockSiteDetailsRequest,
  mockSiteDetails
} from './src/models/site-details/test-fixtures.js'

const testData = {
  ...mockSiteDetailsRequest,
  multipleSiteDetails: { multipleSitesEnabled: true },
  siteDetails: { ...mockSiteDetails }
}

console.log('Test data:', JSON.stringify(testData, null, 2))
const result = siteDetailsSchema.validate(testData)
console.log('Has error:', !!result.error)
console.log('Result:', result)
if (result.error) {
  console.log('Error message:', result.error.message)
}
