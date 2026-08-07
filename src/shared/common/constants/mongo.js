// MongoDB duplicate key error code (E11000), surfaced on a unique-index violation.
export const MONGO_DUPLICATE_KEY_CODE = 11000

// NamespaceNotFound: the queried collection does not exist.
export const MONGO_NAMESPACE_NOT_FOUND_CODE = 26

// IndexNotFound: the query requires an index the collection does not have
// (what an unkeyed $geoNear reports for a missing 2dsphere index).
export const MONGO_INDEX_NOT_FOUND_CODE = 27

// NoQueryExecutionPlans: no index can satisfy the query (what a keyed
// $geoNear reports when the named key has no 2dsphere index).
export const MONGO_NO_QUERY_EXECUTION_PLANS_CODE = 291
