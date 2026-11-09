export const convictPositiveInteger = {
  name: 'positive-integer',
  coerce: (value) => Number(value),
  validate: function validatePositiveInteger(value) {
    if (!Number.isInteger(value) || value < 1) {
      throw new TypeError(`must be a positive integer, received ${value}`)
    }
  }
}
