// Locale is pinned for the same reason as londonToday: an unpinned
// toLocaleString() renders differently depending on the host's ICU
// defaults, and that difference never shows up in a local test run.
const numberFormatter = new Intl.NumberFormat('en-GB')

export const formatNumber = (value) => numberFormatter.format(value)
