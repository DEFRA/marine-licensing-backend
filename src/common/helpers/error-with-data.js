class ErrorWithData extends Error {
  constructor(message, data) {
    super(message)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ErrorWithData)
    }

    this.name = 'ErrorWithData'
    this.data = data
  }
}

export { ErrorWithData }
