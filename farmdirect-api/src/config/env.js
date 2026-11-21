require('dotenv').config();

const required = ['MONGODB_URI', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    // Fail fast: a server without these is unusable and unsafe.
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const isProd = process.env.NODE_ENV === 'production';

if (isProd && (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.startsWith('change-me'))) {
  throw new Error('JWT_SECRET is too weak for production. Use at least 32 random characters.');
}

const paymentMode = (process.env.PAYMENT_MODE || 'mock').toLowerCase();
if (isProd && paymentMode === 'mock') {
  throw new Error('PAYMENT_MODE=mock is not allowed in production.');
}
if (paymentMode === 'razorpay' && (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)) {
  throw new Error('PAYMENT_MODE=razorpay requires RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
}

module.exports = {
  isProd,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  paymentMode,
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? 2),
  paymentWindowMinutes: Number(process.env.PAYMENT_WINDOW_MINUTES ?? 15),
  disputeWindowHours: Number(process.env.DISPUTE_WINDOW_HOURS ?? 48),
};
