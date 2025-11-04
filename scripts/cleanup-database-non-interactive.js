#!/usr/bin/env node

/* eslint-disable no-console */

/**
 * Non-Interactive Database Cleanup Script
 *
 * This version runs without user confirmation and is designed for automatic
 * execution during container startup in production environments.
 *
 * ⚠️  WARNING: This is a destructive operation that cannot be undone!
 *
 *
 * The script will:
 * - Delete all exemption records
 * - Reset reference sequences (exemptions will start from EXE/YYYY/10001)
 * - Clear all queue data (Dynamics integration queues)
 * - Remove all mongo locks
 * - Preserve indexes (collections remain with their indexes intact)
 */

import { MongoClient } from 'mongodb'
import { config } from '../src/config.js'

const COLLECTIONS_TO_CLEAN = [
  'exemptions',
  'reference-sequences',
  'mongo-locks',
  'exemption-dynamics-queue',
  'exemption-dynamics-queue-failed'
]

const mongoUrl = config.get('mongo.mongoUrl')
const databaseName = config.get('mongo.databaseName')
const mongoOptions = config.get('mongo.mongoOptions')
const environment = config.get('cdpEnvironment')

/**
 * Cleans up all collections in the database
 */
async function cleanupDatabase() {
  let client

  try {
    console.log(
      '🧹 Marine Licensing Backend - Database Cleanup (Non-Interactive)'
    )
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Environment:     ${environment}`)
    console.log(`Database:        ${databaseName}`)
    console.log(`MongoDB URL:     ${mongoUrl.replace(/\/\/.*@/, '//*****@')}`) // Mask credentials
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    console.log('🔌 Connecting to MongoDB...')

    // Add TLS options to handle self-signed certificates
    const connectionOptions = {
      ...mongoOptions,
      tls: true,
      tlsAllowInvalidCertificates: true,
      tlsAllowInvalidHostnames: true
    }

    client = await MongoClient.connect(mongoUrl, connectionOptions)

    const db = client.db(databaseName)
    console.log(`✅ Connected to database: ${databaseName}\n`)

    console.log('🗑️  Starting cleanup...\n')

    // Clean each collection
    let totalDocumentsDeleted = 0

    for (const collectionName of COLLECTIONS_TO_CLEAN) {
      try {
        const collection = db.collection(collectionName)

        // Check if collection exists and get count
        const count = await collection.countDocuments()

        if (count === 0) {
          console.log(`⏭️  ${collectionName}: No documents to delete`)
          continue
        }

        // Delete all documents
        const result = await collection.deleteMany({})
        totalDocumentsDeleted += result.deletedCount

        console.log(
          `✅ ${collectionName}: Deleted ${result.deletedCount} documents`
        )
      } catch (error) {
        // Collection might not exist yet, which is fine
        if (error.message.includes('ns not found')) {
          console.log(
            `⏭️  ${collectionName}: Collection does not exist (skipping)`
          )
        } else {
          throw error
        }
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`✅ Cleanup completed successfully!`)
    console.log(`📊 Total documents deleted: ${totalDocumentsDeleted}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(
      '\n📝 Next exemption will be: EXE/' +
        new Date().getFullYear() +
        '/10001\n'
    )
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error.message)
    throw error
  } finally {
    if (client) {
      await client.close()
      console.log('🔌 Database connection closed\n')
    }
  }
}

/**
 * Main execution
 */
try {
  await cleanupDatabase()
  process.exit(0)
} catch (error) {
  console.error('💥 Fatal error:', error)
  process.exit(1)
}
