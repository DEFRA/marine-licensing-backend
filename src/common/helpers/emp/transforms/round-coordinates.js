export const roundCoordinates = (coordinates) => {
  return coordinates.map((coord) => Number(coord.toFixed(6)))
}
