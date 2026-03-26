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

## Idempotency

It is safer to write idempotent scripts that survive repeatedly being run against the database.

Example:

```js
const collection = 'albums'

export const up = async (db, client) => {
  await db.createCollection(collection)
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
