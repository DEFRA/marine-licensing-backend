// Locale is pinned: an unpinned formatter renders differently depending on the
// host's ICU defaults, and that never shows up in a local test run.
const numberFormatter = new Intl.NumberFormat('en-GB')

export const formatNumber = (value) => numberFormatter.format(value)
