const env = require('./config/env');
const { connectDB } = require('./config/db');
const { createApp } = require('./app');
const { startSweeper } = require('./jobs/sweeper');
const mongoose = require('mongoose');

async function main() {
  await connectDB();
  console.log('MongoDB connected');
  const app = createApp();
  const server = app.listen(env.port, () => console.log(`FarmDirect API on :${env.port} (payments: ${env.paymentMode})`));
  const stopSweeper = startSweeper();

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    stopSweeper();
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
