export const retryAsyncOperation = ({
  operation,
  retries = 3,
  intervalMs = 1000
}) => {
  return new Promise((resolve, reject) => {
    let retryCount = 0
    let intervalId = null

    const executeOperation = async () => {
      try {
        const result = await operation()
        if (intervalId) {
          clearInterval(intervalId)
        }
        resolve(result)
      } catch (error) {
        retryCount++
        if (retryCount >= retries) {
          if (intervalId) {
            clearInterval(intervalId)
          }
          reject(error)
        } else if (retryCount === 1) {
          // If this is the first failure, set up the interval for retries
          intervalId = setInterval(() => {
            executeOperation()
          }, intervalMs)
        } else {
          // do nothing and wait for the next interval
        }
      }
    }

    // Execute the first attempt immediately
    executeOperation()
  })
}
