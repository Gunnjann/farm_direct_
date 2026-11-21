/**
 * Image uploads (product photos, dispute evidence).
 *
 * Stored on local disk under /uploads for development. IMPORTANT for Render:
 * the free/standard filesystem is ephemeral — files vanish on redeploy. Before
 * launch, swap `storage` for Cloudinary / S3 / Cloudflare R2 (only this file changes).
 */
const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { asyncHandler, badRequest } = require('../utils/errors');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${EXT[file.mimetype]}`),
  }),
  limits: { fileSize: 3 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => (EXT[file.mimetype] ? cb(null, true) : cb(badRequest('Only JPG, PNG or WEBP images are allowed'))),
});

// Check real file signatures — the browser-supplied mimetype can be faked.
function looksLikeImage(file) {
  const fd = fs.openSync(file.path, 'r');
  const buf = Buffer.alloc(12);
  fs.readSync(fd, buf, 0, 12, 0);
  fs.closeSync(fd);
  const jpg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  const png = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP';
  return jpg || png || webp;
}

router.post(
  '/',
  authenticate,
  upload.array('images', 6),
  asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw badRequest('No images received');
    const bad = files.filter((f) => !looksLikeImage(f));
    if (bad.length) {
      files.forEach((f) => fs.unlink(f.path, () => {}));
      throw badRequest('One of the files is not a valid image');
    }
    const base = `${req.protocol}://${req.get('host')}`;
    res.status(201).json({ urls: files.map((f) => `${base}/uploads/${f.filename}`) });
  })
);

module.exports = router;
