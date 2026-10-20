// ============================================================
//  Change 7 — LANDING PAGE CONTENT (additive)
//  ------------------------------------------------------------
//  GET  /api/landing-content            public, read-only key→value map
//  GET  /api/super-admin/landing-content    super_admin: map + updatedAt
//  PUT  /api/super-admin/landing-content    super_admin: { values:{key:value} }
//  Keys missing from the table fall back to the landing page's built-in
//  defaults (the current text), so the page is identical until edited.
//  An empty string value resets that key to its default.
// ============================================================
const express = require('express');
const prisma = require('../utils/prisma');
const { authenticate, requireSuperAdmin } = require('../middleware/auth');

const KEY_RE = /^[a-z0-9_.-]{1,120}$/i;
const MAX_VALUE = 5000;

async function readMap() {
  const rows = await prisma.landingContent.findMany();
  const values = {};
  let updatedAt = null;
  for (const r of rows) {
    values[r.key] = r.value;
    if (!updatedAt || r.updatedAt > updatedAt) updatedAt = r.updatedAt;
  }
  return { values, updatedAt };
}

const publicRouter = express.Router();
publicRouter.get('/', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await readMap());
  } catch (e) {
    // Never break the landing page: defaults are used when this fails.
    res.json({ values: {}, updatedAt: null });
  }
});

const adminRouter = express.Router();
adminRouter.use(authenticate, requireSuperAdmin);
adminRouter.get('/', async (req, res) => {
  try { res.json(await readMap()); } catch (e) { res.status(500).json({ error: 'Failed to load landing content' }); }
});
adminRouter.put('/', async (req, res) => {
  try {
    const values = (req.body && req.body.values) || {};
    if (typeof values !== 'object' || Array.isArray(values)) return res.status(400).json({ error: 'values must be an object' });
    const entries = Object.entries(values);
    if (entries.length > 2000) return res.status(400).json({ error: 'Too many keys' });
    for (const [k, v] of entries) {
      if (!KEY_RE.test(k)) return res.status(400).json({ error: `Invalid key: ${k}` });
      if (v != null && String(v).length > MAX_VALUE) return res.status(400).json({ error: `Value too long for ${k}` });
    }
    const ops = entries.map(([key, v]) => {
      const value = v == null ? '' : String(v);
      if (value === '') return prisma.landingContent.deleteMany({ where: { key } }); // reset to default
      return prisma.landingContent.upsert({ where: { key }, update: { value, updatedById: req.user.id }, create: { key, value, updatedById: req.user.id } });
    });
    await prisma.$transaction(ops);
    try {
      const { logSaActivity } = require('../modules/super-admin/superAdmin.service');
      if (typeof logSaActivity === 'function') await logSaActivity({ req, module: 'landing', action: 'update_content', description: `Updated ${entries.length} landing-page item(s)`, metadata: { keys: entries.map(([k]) => k).slice(0, 50) } });
    } catch (_) { /* activity log is best-effort */ }
    res.json({ message: 'Landing page updated', ...(await readMap()) });
  } catch (e) {
    console.error('landing content save error:', e);
    res.status(500).json({ error: 'Failed to save landing content' });
  }
});

module.exports = { publicRouter, adminRouter };
