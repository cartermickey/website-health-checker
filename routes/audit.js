const express = require('express');
const router = express.Router();
const audits = require('../store/audits');

router.post('/', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const auditId = audits.create(url);
  res.json({ auditId });
});

module.exports = router;
