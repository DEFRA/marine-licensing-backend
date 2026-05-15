import { v7 as uuidv7 } from 'uuid'

export function generateSlug() {
  const hex = uuidv7().replace(/-/g, '')
  return Buffer.from(hex, 'hex').toString('base64url')
}
