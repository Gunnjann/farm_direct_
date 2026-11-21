const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/error');

function sanitizeKeys(obj) {
  // Blocks NoSQL operator injection like {"email": {"$gt": ""}} in bodies/queries.
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (k.startsWith('$') || k.includes('.')) delete obj[k];
      else sanitizeKeys(obj[k]);
    }
  }
  return obj;
}

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render/Vercel sit behind one proxy; needed for correct IPs in rate limiting.
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || env.clientOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      maxAge: 600,
    })
  );
  if (env.nodeEnv !== 'test') app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // Webhook needs the raw body, so it's mounted before the JSON parser.
  app.use('/api/payments/webhook', require('./routes/webhook'));

  app.use(express.json({ limit: '200kb' }));
  app.use((req, _res, next) => {
    sanitizeKeys(req.body);
    sanitizeKeys(req.params);
    if (req.query) sanitizeKeys(req.query);
    next();
  });

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: env.nodeEnv === 'test' ? 100000 : 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: { code: 'RATE_LIMIT', message: 'Too many requests. Slow down a little.' } },
    })
  );

  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads'), { maxAge: '7d', fallthrough: false }));

  app.get('/api/health', (_req, res) =>
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down', paymentMode: env.paymentMode, time: new Date().toISOString() })
  );
  app.get('/api/config', (_req, res) =>
    res.json({ paymentMode: env.paymentMode, razorpayKeyId: env.paymentMode === 'razorpay' ? env.razorpay.keyId : null, platformFeePercent: env.platformFeePercent, paymentWindowMinutes: env.paymentWindowMinutes })
  );

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/checkout', require('./routes/checkout'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/groups', require('./routes/groups'));
  app.use('/api/seller', require('./routes/seller'));
  app.use('/api/uploads', require('./routes/uploads'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/market', require('./routes/market'));
  app.use('/api/connect', require('./routes/connect'));
  app.use('/api', require('./routes/community'));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
