# MongoDB Migrations

See: https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script

## Commands

### Create

```shell

npm run migrate:create my-new-migration
```

### Migrate up

```shell
npm run migrate:up
```

### Migrate down

```shell
npm run migrate:down
```

### Status

```shell
npm run migrate:status
```

## Naming convention

Migration files are automatically prefixed with a timestamp by `migrate:create`. Use lowercase kebab-case with a verb-noun pattern that describes the change:

```shell
npm run migrate:create add-albums-collection
npm run migrate:create add-index-to-exemptions
npm run migrate:create rename-field-project-name
npm run migrate:create remove-legacy-status-values
```

This produces files like `20260326133104-add-albums-collection.js`.

Common verbs: `add`, `remove`, `rename`, `update`, `create`, `drop`.

## Ordering

Migrations run in filename order (by timestamp prefix). `migrate:up` applies all pending migrations in sequence. `migrate:down` rolls back only the **last applied** migration — run it multiple times to roll back further.

Applied migrations are tracked in the `changelog` collection. Use `migrate:status` to see which have been applied.

## Environment

The target database is determined automatically by `migrate-mongo-config.js`, which reads `MONGO_URI` and `MONGO_DATABASE` from the application config. No additional configuration is needed.

## Idempotency

It is safer to write idempotent scripts that survive repeatedly being run against the database.

Example:

```js
const collection = 'albums'

export const up = async (db, client) => {
  const collections = await db.listCollections({ name: collection }).toArray()
  if (!collections.length) {
    await db.createCollection(collection)
  }
  await db
    .collection(collection)
    .updateOne(
      { _id: 'beatles-white-album' },
      { $set: { artist: 'The Beatles', album: 'White Album' } },
      { upsert: true }
    )
}

export const down = async (db, client) => {
  const collections = await db.listCollections({ name: collection }).toArray()
  if (collections.length) {
    await db.collection(collection).deleteOne({ _id: 'beatles-white-album' })
    await db.collection(collection).drop()
  }
}
```

### Adding documents

- use `updateOne`, with `{upsert: true}`
- adding documents with known `_id`s allows precise deletion

### Deleting documents

- check the document exists before deleting, or add try/catch
- delete by `_id` if possible

### Deleting collections

- check the collection is present before deleting it

### Creating collections

- check the collection does not already exist before creating it

### Adding indexes

```js
await db
  .collection('exemptions')
  .createIndex({ contactId: 1 }, { unique: false })
```

`createIndex` is already idempotent — if the index exists with the same spec, it is a no-op.

### Renaming fields

```js
await db
  .collection('exemptions')
  .updateMany(
    { oldFieldName: { $exists: true } },
    { $rename: { oldFieldName: 'newFieldName' } }
  )
```

The `$exists` check makes this safe to re-run.

### Updating existing documents

```js
await db
  .collection('exemptions')
  .updateMany({ status: 'LEGACY' }, { $set: { status: 'DRAFT' } })
```

## Transactions

Use the `client` parameter to run operations across multiple collections atomically via a session:

```js
export const up = async (db, client) => {
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      await db
        .collection('albums')
        .insertOne({ _id: 'a1', title: 'Abbey Road' }, { session })
      await db
        .collection('artists')
        .updateOne(
          { _id: 'the-beatles' },
          { $push: { albumIds: 'a1' } },
          { session }
        )
    })
  } finally {
    await session.endSession()
  }
}
```

Transactions require a MongoDB replica set. If either operation fails, all changes are rolled back.
