import { equal } from '../../utils.js'

export const areCoordsTheSame = ([lon1, lat1], [lon2, lat2]) => {
  return equal(lon1, lon2) && equal(lat1, lat2)
}
