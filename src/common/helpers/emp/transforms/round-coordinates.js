const DECIMAL_PLACES = 6

export const roundCoordinates = (coordinates) => {
  return coordinates.map((coord) => Number(coord.toFixed(DECIMAL_PLACES)))
}
