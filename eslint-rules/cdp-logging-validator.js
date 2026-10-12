// Matches `logger.<level>(...)` and `<anything>.logger.<level>(...)`
// (request/server/this/job.logger) for the pino log levels.
const LOGGER_CALL =
  'CallExpression[callee.computed=false]' +
  '[callee.property.name=/^(debug|info|warn|error|fatal)$/]' +
  ':matches([callee.object.name="logger"], [callee.object.property.name="logger"])'

const CDP_SCHEMA = {
  client: { address: true, ip: true, port: true },
  error: { code: true, id: true, message: true, stack_trace: true, type: true },
  event: {
    action: true,
    created: true,
    duration: true,
    kind: true,
    outcome: ['failure', 'success', 'unknown'],
    reason: true,
    reference: true,
    severity: true,
    type: true
  },
  host: { hostname: true },
  http: {
    request: {
      body: { bytes: true },
      bytes: true,
      headers: {
        'Accept-language': true,
        'accept-encoding': true,
        'cache-control': true,
        expires: true,
        referer: true
      },
      id: true,
      method: true
    },
    response: { status_code: true }
  },
  log: { level: true, file: { path: true }, logger: true },
  message: true,
  process: { name: true, pid: true, thread: { id: true, name: true } },
  server: { address: true },
  service: { type: true },
  span: { id: true },
  tenant: { id: true, message: true },
  transaction: { id: true },
  url: { domain: true, full: true, path: true, port: true, query: true },
  user_agent: {
    device: { name: true },
    name: true,
    original: true,
    version: true
  },
  // Not a CDP field, but ecsFormat rewrites an Error in `err` to
  // `error.type/message/stack_trace`, so it never reaches CDP as `err`.
  err: true
}

const checkProperty = (context, prop, schema, prefix) => {
  const key = prop.key.name ?? String(prop.key.value)

  if (!Object.hasOwn(schema, key)) {
    context.report({
      node: prop.key,
      messageId: 'invalidKey',
      data: { key: prefix + key }
    })
    return
  }

  if (schema[key] !== true && prop.value.type === 'ObjectExpression') {
    checkObject(context, prop.value, schema[key], `${prefix}${key}.`)
  }
}

const checkObject = (context, objectNode, schema, prefix = '') => {
  for (const prop of objectNode.properties) {
    if (prop.type === 'Property' && !prop.computed) {
      checkProperty(context, prop, schema, prefix)
    }
  }
}

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Enforce that logger calls only use CDP fields.'
    },
    schema: [],
    messages: {
      invalidKey: '`{{key}}` is not a valid CDP log field.'
    }
  },
  create(context) {
    return {
      [LOGGER_CALL](node) {
        const [obj] = node.arguments
        if (obj?.type === 'ObjectExpression') {
          checkObject(context, obj, CDP_SCHEMA)
        }
      }
    }
  }
}
