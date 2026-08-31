/**
 * helpers/db.js
 *
 * Manages a MongoMemoryServer instance for the test suite.
 * Call connect() in beforeAll, clearCollections() in afterEach,
 * and disconnect() in afterAll.
 */

import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod

export async function connect() {
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()
  await mongoose.connect(uri)
}

export async function clearCollections() {
  const collections = mongoose.connection.collections
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({})
  }
}

export async function disconnect() {
  await mongoose.connection.dropDatabase()
  await mongoose.connection.close()
  await mongod.stop()
}
