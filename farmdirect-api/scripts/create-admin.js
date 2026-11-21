/**
 * Create (or promote) an admin account safely, e.g. on production.
 * Usage: node scripts/create-admin.js "Full Name" admin@yourdomain.in 'StrongPassword123'
 * Admins can never be created through the public /register endpoint.
 */
const mongoose = require('mongoose');
const { connectDB } = require('../src/config/db');
const User = require('../src/models/User');

async function main() {
  const [name, email, password] = process.argv.slice(2);
  if (!name || !email || !password || password.length < 12) {
    console.error('Usage: node scripts/create-admin.js "Name" email password(min 12 chars)');
    process.exit(1);
  }
  await connectDB();
  let u = await User.findOne({ email: email.toLowerCase() });
  if (u) u.role = 'admin';
  else u = new User({ name, email, role: 'admin' });
  await u.setPassword(password);
  await u.save();
  console.log(`Admin ready: ${u.email}`);
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
