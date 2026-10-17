// ============================================================
//  LMS fee payment-proof upload (Section 7.2) — LMS-only.
//  Screenshot: PNG / JPEG / WEBP only, max 2 MB. The MIME type is checked
//  by multer and the file's magic bytes are verified after upload (a
//  renamed non-image is rejected). Files get a random, unguessable name
//  under uploads/lms-fee-proofs and are served only through the
//  authenticated proof routes (owning student or Provost).
// ============================================================
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PROOF_DIR = path.join(__dirname, '..', '..', 'uploads', 'lms-fee-proofs');
if (!fs.existsSync(PROOF_DIR)) fs.mkdirSync(PROOF_DIR, { recursive: true });

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PROOF_DIR),
  filename: (req, file, cb) => cb(null, `${crypto.randomBytes(16).toString('hex')}${ALLOWED[file.mimetype] || ''}`),
});

const uploadFeeProof = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) {
      const err = new Error('Screenshot must be a PNG, JPG or WEBP image.');
      err.status = 400; err.expose = true;
      return cb(err);
    }
    return cb(null, true);
  },
});

/** Verify the stored file really is a PNG / JPEG / WEBP image. */
function hasImageSignature(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const b = Buffer.alloc(12);
    fs.readSync(fd, b, 0, 12, 0);
    const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
    const webp = b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
    return png || jpg || webp;
  } catch (_) {
    return false;
  } finally {
    if (fd !== undefined) try { fs.closeSync(fd); } catch (_) { /* ignore */ }
  }
}

function proofAbsPath(storedName) {
  return path.join(PROOF_DIR, path.basename(String(storedName || '')));
}

module.exports = { uploadFeeProof, hasImageSignature, proofAbsPath, PROOF_DIR, MAX_BYTES };
