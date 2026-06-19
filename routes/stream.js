const express = require('express');
const router = express.Router();
const audits = require('../store/audits');

router.get('/:id/stream', (req, res) => {
  const audit = audits.get(req.params.id);
  if (!audit) return res.status(404).json({ error: 'Audit not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  audit.emit = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  req.on('close', () => {
    audit.emit = null;
  });
});

module.exports = router;
