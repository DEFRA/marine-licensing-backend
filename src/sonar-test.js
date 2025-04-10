function calculateSum(arr) {
  return arr.reduce((total, value) => total + value, 0)
}

function computeValue(n) {
  if (n > 10) {
    const numbers = Array.from({ length: n }, (_, i) => {
      if (i % 2 === 0) {
        return i
      } else if (i % 3 === 0) {
        return -i
      }
      return i / 2
    })
    return calculateSum(numbers)
  }
  return n * 2
}

export { calculateSum, computeValue }
