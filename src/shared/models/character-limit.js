export const CHARACTER_LIMIT_BACKSTOP = 10000

const graphemeSegmenter = new Intl.Segmenter(undefined, {
  granularity: 'grapheme'
})

export const countCharacters = (text) =>
  Array.from(graphemeSegmenter.segment(text)).length

export const withCharacterLimit = (schema, limit) =>
  schema.max(CHARACTER_LIMIT_BACKSTOP).custom((value, helpers) => {
    if (countCharacters(value) > limit) {
      return helpers.error('string.max', { limit })
    }
    return value
  })
