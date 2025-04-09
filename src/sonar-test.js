//Two functions doing the same operation.
function calculateSumA(arr) {
  let total = 0
  for (let i = 0; i < arr.length; i++) {
    total += arr[i]
  }
  return total
}

function calculateSumB(arr) {
  let sum = 0
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i]
  }
  return sum
}

// intentionally contains nested logic to trigger warnings

function computeValue(n) {
  let result = 0
  if (n > 10) {
    for (let i = 0; i < n; i++) {
      if (i % 2 === 0) {
        result += i
      } else if (i % 3 === 0) {
        // Nested condition inside a loop increases complexity.
        result -= i
      } else {
        result += i / 2
      }
    }
  } else {
    // Minimal logic for lower values
    result = n * 2
  }
  return result
}

export { calculateSumA, calculateSumB, computeValue }
