export const retryAsyncOperation = ({ operation, retries, intervalMs }) => {
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
        }
      }
    }

    // Execute the first attempt immediately
    executeOperation()
  })
}
