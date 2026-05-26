import { describe, expect, test } from 'vitest'
import {
  iatContextSlugParams,
  iatContextPatchBody,
  outcomeDocumentMintBody
} from './iat-context.js'

const validSlug = 'a'.repeat(22)

describe('iatContextSlugParams', () => {
  test('accepts a 22-char base64url slug', () => {
    expect(
      iatContextSlugParams.validate({ slug: validSlug }).error
    ).toBeUndefined()
  })
  test('rejects a too-short slug', () => {
    expect(iatContextSlugParams.validate({ slug: 'short' }).error).toBeDefined()
  })
  test('rejects characters outside base64url', () => {
    expect(
      iatContextSlugParams.validate({ slug: '*'.repeat(22) }).error
    ).toBeDefined()
  })
})

describe('iatContextPatchBody', () => {
  const validAnswer = {
    questionRoute: '/q1',
    questionText: 'What?',
    answers: [{ id: 'A', text: 'Answer' }],
    mcmsAppFormMapping: null
  }

  test('accepts a valid single-select answer wrapper', () => {
    expect(
      iatContextPatchBody.validate({ answer: validAnswer }).error
    ).toBeUndefined()
  })
  test('accepts a multi-select answer wrapper (multiple {id,text})', () => {
    expect(
      iatContextPatchBody.validate({
        answer: {
          ...validAnswer,
          answers: [
            { id: 'A', text: 'A text' },
            { id: 'B', text: 'B text' }
          ]
        }
      }).error
    ).toBeUndefined()
  })
  test('accepts mcmsAppFormMapping as a string', () => {
    expect(
      iatContextPatchBody.validate({
        answer: { ...validAnswer, mcmsAppFormMapping: 'ACTIVITY_TYPE' }
      }).error
    ).toBeUndefined()
  })
  test('requires questionText (frozen text)', () => {
    const { questionText, ...rest } = validAnswer
    expect(iatContextPatchBody.validate({ answer: rest }).error).toBeDefined()
  })
  test('requires at least one selected answer', () => {
    expect(
      iatContextPatchBody.validate({ answer: { ...validAnswer, answers: [] } })
        .error
    ).toBeDefined()
  })
  test('requires each selected answer to have id and text (frozen)', () => {
    expect(
      iatContextPatchBody.validate({
        answer: { ...validAnswer, answers: [{ id: 'A' }] }
      }).error
    ).toBeDefined()
  })
})

describe('outcomeDocumentMintBody', () => {
  const validBody = {
    outcomeRoute: '/outcome-a',
    outcomeKind: 'terminal-single',
    outcomeHeading: 'You may need …',
    outcomeText: '',
    focusedOption: {
      id: 'WO_FOO',
      heading: 'Option',
      text: '<p>x</p>',
      module: null,
      link: null,
      overrideCtaButtonUrl: null,
      params: null
    }
  }

  test('accepts the canonical body', () => {
    expect(outcomeDocumentMintBody.validate(validBody).error).toBeUndefined()
  })
  test('accepts params as an array of {name, value}', () => {
    const body = {
      ...validBody,
      focusedOption: {
        ...validBody.focusedOption,
        params: [{ name: 'ADV_TYPE', value: 'EXE' }]
      }
    }
    expect(outcomeDocumentMintBody.validate(body).error).toBeUndefined()
  })
  test('rejects an outcomeKind outside the allowlist', () => {
    expect(
      outcomeDocumentMintBody.validate({ ...validBody, outcomeKind: 'bogus' })
        .error
    ).toBeDefined()
  })
  test('rejects when focusedOption.id missing', () => {
    const { id, ...rest } = validBody.focusedOption
    expect(
      outcomeDocumentMintBody.validate({ ...validBody, focusedOption: rest })
        .error
    ).toBeDefined()
  })
})
