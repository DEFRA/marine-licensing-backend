export const makeEmpRequest = async ({ features, apiUrl, apiKey }) => {
  const encodedParams = new URLSearchParams()
  encodedParams.set('f', 'json')
  encodedParams.set('token', apiKey)
  encodedParams.set('features', JSON.stringify(features))
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: encodedParams
  }
  const url = `${apiUrl}/addFeatures`
  const response = await fetch(url, options)
  const data = await response.json()
  return { response, data }
}
