const express = require('express');
const router = express.Router();
const audits = require('../store/audits');
const { runAudit } = require('../crawler');

router.post('/', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const auditId = audits.create(url);
  res.json({ auditId });

  // Start async — do not await
  runAudit(auditId, url).catch((err) => console.error('Audit failed:', err));
});

module.exports = router;
