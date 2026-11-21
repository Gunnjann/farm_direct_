const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);

async function connectDB(uri = env.mongoUri) {
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 10000 });
  // Make sure unique indexes exist (createIndexes never drops existing ones) before we accept traffic (idempotency relies on them).
  await Promise.all(Object.values(mongoose.models).map((m) => m.createIndexes()));
  return mongoose.connection;
}

module.exports = { connectDB };
