import sanitizeHtml from 'sanitize-html'

// CONTRACT: this allowlist is a literal duplicate of richTextSanitiseOptions in
// marine-licensing-frontend/src/server/journey/self-service/services/sanitise.js.
// If you change it here, change it there in the SAME PR, and update the canary
// in both repos' contract tests.
const ALLOWED_TAGS = ['a', 'b', 'br', 'li', 'ol', 'p', 'strong', 'u', 'ul']
const ALLOWED_SCHEMES = ['http', 'https']

const richTextSanitiseOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    ol: ['type']
  },
  allowedSchemes: ALLOWED_SCHEMES,
  allowProtocolRelative: false
}

export function sanitiseSummaryText(text) {
  return text ? sanitizeHtml(text, richTextSanitiseOptions) : text
}
