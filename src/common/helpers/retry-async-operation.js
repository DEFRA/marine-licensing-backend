export const retryAsyncOperation = ({
  operation,
  retries = 3,
  intervalMs = 1000
}) => {
  return new Promise((resolve, reject) => {
    let result
    let retryCount = 0
    const intervalId = setInterval(async () => {
      try {
        result = await operation()
        clearInterval(intervalId)
        resolve(result)
      } catch (error) {
        retryCount++
        if (retryCount >= retries) {
          clearInterval(intervalId)
          reject(error)
        }
      }
    }, intervalMs)
  })
}
