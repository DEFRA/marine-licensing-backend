import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p',
  'br',
  'a',
  'ol',
  'ul',
  'li',
  'strong',
  'em',
  'sup',
  'sub'
]

const NON_TEXT_TAGS = [
  'script',
  'style',
  'textarea',
  'option',
  'xmp',
  'noscript',
  'iframe',
  'object',
  'embed'
]

const BLOCK_TAGS_REMOVED_WHEN_EMPTY = ['p', 'li', 'ul', 'ol']

const VALID_HREF = /^https?:\/\//i
const NON_BREAKING_SPACES = /\u00A0/g
const INVISIBLE_CHARACTERS = /[\u200B\uFEFF\u00AD]/g

const cleanText = (text) =>
  text.replace(NON_BREAKING_SPACES, ' ').replace(INVISIBLE_CHARACTERS, '')

const renameTo = (tagName) => () => ({ tagName, attribs: {} })

const transformAnchor = (tagName, attribs) => ({
  tagName,
  attribs: {
    ...(attribs.href && { href: attribs.href }),
    ...(attribs.target && {
      target: attribs.target,
      rel: 'noopener noreferrer'
    })
  }
})

const isDeadAnchor = (frame) =>
  frame.tag === 'a' && !VALID_HREF.test(frame.attribs?.href ?? '')

const isEmptyBlock = (frame) =>
  BLOCK_TAGS_REMOVED_WHEN_EMPTY.includes(frame.tag) &&
  cleanText(frame.text ?? '').trim() === ''

const STRUCTURE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  nonTextTags: NON_TEXT_TAGS,
  transformTags: {
    a: transformAnchor,
    b: renameTo('strong'),
    i: renameTo('em')
  },
  textFilter: cleanText,
  exclusiveFilter: (frame) => (isDeadAnchor(frame) ? 'excludeTag' : false)
}

const EMPTY_BLOCK_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https'],
  allowProtocolRelative: false,
  nonTextTags: NON_TEXT_TAGS,
  exclusiveFilter: isEmptyBlock
}

// Empty-block removal is a separate second pass because, within a single
// pass, text unwrapped from an excluded tag is not part of the parent
// frame's text yet — a block whose only child was a dead anchor would be
// wrongly judged empty and removed along with its text.
export const sanitisePolicyWording = (html) => {
  if (typeof html !== 'string') {
    return null
  }
  return sanitizeHtml(
    sanitizeHtml(html, STRUCTURE_OPTIONS),
    EMPTY_BLOCK_OPTIONS
  )
}
