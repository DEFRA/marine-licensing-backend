import { sanitisePolicyWording } from './sanitise-policy-wording.js'

describe('sanitisePolicyWording', () => {
  describe('tag allowlist', () => {
    it('should keep the allowed structural and inline tags', () => {
      const input =
        '<p>Intro</p><ol><li>one</li></ol><ul><li>two</li></ul>' +
        '<p><strong>bold</strong> <em>emph</em> 10m<sup>2</sup> H<sub>2</sub>O<br>end</p>'
      const expected =
        '<p>Intro</p><ol><li>one</li></ol><ul><li>two</li></ul>' +
        '<p><strong>bold</strong> <em>emph</em> 10m<sup>2</sup> H<sub>2</sub>O<br />end</p>'

      expect(sanitisePolicyWording(input)).toBe(expected)
    })

    it('should unwrap span and u tags, keeping their text', () => {
      expect(
        sanitisePolicyWording(
          '<p><span style="color: black;">Text</span> and <u>underlined</u></p>'
        )
      ).toBe('<p>Text and underlined</p>')
    })

    it('should drop script tags together with their content', () => {
      expect(
        sanitisePolicyWording(
          '<p>before</p><script>alert(1)</script><p>after</p>'
        )
      ).toBe('<p>before</p><p>after</p>')
    })

    it('should drop style, iframe, object, embed and noscript with their content', () => {
      const input =
        '<style>p{display:none}</style><iframe src="https://evil.example">fallback</iframe>' +
        '<object>o</object><embed><noscript>ns</noscript><p>kept</p>'

      expect(sanitisePolicyWording(input)).toBe('<p>kept</p>')
    })

    it('should normalise b to strong and i to em', () => {
      expect(sanitisePolicyWording('<p><b>bold</b> <i>italic</i></p>')).toBe(
        '<p><strong>bold</strong> <em>italic</em></p>'
      )
    })

    it('should return null for non-string input', () => {
      expect(sanitisePolicyWording(null)).toBeNull()
      expect(sanitisePolicyWording(undefined)).toBeNull()
      expect(sanitisePolicyWording(12345)).toBeNull()
      expect(sanitisePolicyWording(['<p>x</p>'])).toBeNull()
      expect(sanitisePolicyWording({ policy: '<p>x</p>' })).toBeNull()
    })
  })

  describe('links', () => {
    it('should keep https links, discard input rel, and force rel when target is present', () => {
      expect(
        sanitisePolicyWording(
          '<p><a href="https://www.gov.uk/x" rel="bookmark" target="_blank" style="color: rgb(5, 99, 193);">GOV.UK</a></p>'
        )
      ).toBe(
        '<p><a href="https://www.gov.uk/x" target="_blank" rel="noopener noreferrer">GOV.UK</a></p>'
      )
    })

    it('should keep http links without target and without adding rel', () => {
      expect(
        sanitisePolicyWording('<p><a href="http://example.com/">plain</a></p>')
      ).toBe('<p><a href="http://example.com/">plain</a></p>')
    })

    it('should unwrap anchors with about:blank hrefs to plain text', () => {
      expect(
        sanitisePolicyWording(
          '<p>The <a href="about:blank" rel="noopener noreferrer" target="_blank">Climate Change Act 2008</a> sets targets</p>'
        )
      ).toBe('<p>The Climate Change Act 2008 sets targets</p>')
    })

    it('should unwrap anchors with javascript:, data: and vbscript: hrefs to plain text', () => {
      expect(
        sanitisePolicyWording('<p><a href="javascript:alert(1)">click</a></p>')
      ).toBe('<p>click</p>')
      expect(
        sanitisePolicyWording(
          '<p><a href="data:text/html,<script>alert(1)</script>">data</a></p>'
        )
      ).toBe('<p>data</p>')
      expect(
        sanitisePolicyWording('<p><a href="vbscript:msgbox(1)">vb</a></p>')
      ).toBe('<p>vb</p>')
    })

    it('should unwrap fragment-only, relative and missing hrefs to plain text', () => {
      expect(sanitisePolicyWording('<p><a href="#foo">frag</a></p>')).toBe(
        '<p>frag</p>'
      )
      expect(sanitisePolicyWording('<p><a href="/policies">rel</a></p>')).toBe(
        '<p>rel</p>'
      )
      expect(sanitisePolicyWording('<p><a>none</a></p>')).toBe('<p>none</p>')
      expect(
        sanitisePolicyWording(
          '<p><a href="//example.com/x">protocol relative</a></p>'
        )
      ).toBe('<p>protocol relative</p>')
    })
  })

  describe('text cleanup', () => {
    it('should replace entity and literal non-breaking spaces with normal spaces', () => {
      expect(sanitisePolicyWording('<p>a&nbsp;b\u00A0c\u00A0d</p>')).toBe(
        '<p>a b c d</p>'
      )
    })

    it('should strip zero-width spaces, byte order marks and soft hyphens', () => {
      expect(sanitisePolicyWording('<p>a​b﻿c­d</p>')).toBe('<p>abcd</p>')
    })

    it('should preserve escaped angle brackets in prose', () => {
      expect(
        sanitisePolicyWording(
          '<p>projects &lt;100MW and projects &gt;100MW</p>'
        )
      ).toBe('<p>projects &lt;100MW and projects &gt;100MW</p>')
    })

    it('should keep smart quotes, dashes and pound signs untouched', () => {
      expect(sanitisePolicyWording('<p>‘quoted’ – £50</p>')).toBe(
        '<p>‘quoted’ – £50</p>'
      )
    })
  })

  describe('empty blocks', () => {
    it('should remove paragraphs containing only a br', () => {
      expect(
        sanitisePolicyWording('<p>first</p><p><br></p><p><br></p><p>second</p>')
      ).toBe('<p>first</p><p>second</p>')
    })

    it('should remove paragraphs that are empty after nbsp and span handling', () => {
      expect(sanitisePolicyWording('<p>&nbsp;</p><p>kept</p>')).toBe(
        '<p>kept</p>'
      )
      expect(
        sanitisePolicyWording(
          '<p><span style="color: black;">&nbsp;</span></p><p>kept</p>'
        )
      ).toBe('<p>kept</p>')
      expect(
        sanitisePolicyWording('<p><strong>&nbsp;</strong></p><p>kept</p>')
      ).toBe('<p>kept</p>')
    })

    it('should remove list items that contain only a br or invisible characters', () => {
      expect(
        sanitisePolicyWording(
          '<ul><li>real</li><li><br></li><li>​</li><li>­</li></ul>'
        )
      ).toBe('<ul><li>real</li></ul>')
    })

    it('should remove lists left with no items', () => {
      expect(sanitisePolicyWording('<p>kept</p><ul><li><br></li></ul>')).toBe(
        '<p>kept</p>'
      )
      expect(sanitisePolicyWording('<ol><li>​</li></ol>')).toBe('')
    })

    it('should keep a br that sits inside real content', () => {
      expect(sanitisePolicyWording('<p>line one<br>line two</p>')).toBe(
        '<p>line one<br />line two</p>'
      )
    })
  })

  describe('real corpus samples', () => {
    it('should tidy the ticket example (S-AGG-4/E-AGG-3): drop the empty paragraphs, keep the ordered list', () => {
      const input =
        '<p>Within defined areas of high potential aggregate resource, proposals should demonstrate in order of preference:</p>' +
        '<p><br></p><p><br></p>' +
        '<ol><li>that they will not, prevent aggregate extraction</li>' +
        '<li>how, if there are adverse impacts on aggregate extraction, they will minimise these</li></ol>'

      expect(sanitisePolicyWording(input)).toBe(
        '<p>Within defined areas of high potential aggregate resource, proposals should demonstrate in order of preference:</p>' +
          '<ol><li>that they will not, prevent aggregate extraction</li>' +
          '<li>how, if there are adverse impacts on aggregate extraction, they will minimise these</li></ol>'
      )
    })

    it('should flatten Quill indent classes and drop the empty indented item (S-FISH-4-HER)', () => {
      const input =
        '<ul><li>red – high herring spawning potential –</li>' +
        '<li class="ql-indent-1">no extraction in the peak spawning period</li>' +
        '<li class="ql-indent-1"><br></li></ul>'

      expect(sanitisePolicyWording(input)).toBe(
        '<ul><li>red – high herring spawning potential –</li>' +
          '<li>no extraction in the peak spawning period</li></ul>'
      )
    })

    it('should strip span/style word-paste noise (E-CC-2 pattern)', () => {
      const input =
        '<p><span style="color: rgb(31, 23, 114);">• </span><span style="color: black;">emissions directly related to the activity</span></p>'

      expect(sanitisePolicyWording(input)).toBe(
        '<p>• emissions directly related to the activity</p>'
      )
    })
  })

  describe('adversarial input', () => {
    it('should strip event-handler attributes', () => {
      expect(
        sanitisePolicyWording('<p onclick="alert(1)" onmouseover="x()">hi</p>')
      ).toBe('<p>hi</p>')
    })

    it('should drop img tags entirely', () => {
      expect(
        sanitisePolicyWording('<p>a<img src="x" onerror="alert(1)">b</p>')
      ).toBe('<p>ab</p>')
    })

    it('should treat dollar-prefixed strings as inert text', () => {
      expect(sanitisePolicyWording('<p>$where and {"$gt": ""}</p>')).toBe(
        '<p>$where and {"$gt": ""}</p>'
      )
    })

    it('should survive malformed and unbalanced markup without throwing', () => {
      expect(() =>
        sanitisePolicyWording('<p><strong>unclosed<li>stray</p></ul>')
      ).not.toThrow()
      expect(() => sanitisePolicyWording('<'.repeat(10000))).not.toThrow()
    })
  })

  describe('idempotency', () => {
    const fixtures = [
      '<p>Plain</p>',
      '<p><span style="color: black;">Text</span> and <u>underlined</u></p>',
      '<p>first</p><p><br></p><ol><li>one</li><li class="ql-indent-1"><br></li></ol>',
      '<p>The <a href="about:blank" target="_blank">Act</a> and <a href="https://www.gov.uk/x" rel="x" target="_blank">GOV.UK</a></p>',
      '<p>a&nbsp;b​c</p>',
      '<p>projects &lt;100MW &amp; &gt;100MW</p>'
    ]

    it.each(fixtures)(
      'sanitise(sanitise(x)) === sanitise(x) for %s',
      (fixture) => {
        const once = sanitisePolicyWording(fixture)
        expect(sanitisePolicyWording(once)).toBe(once)
      }
    )
  })
})
