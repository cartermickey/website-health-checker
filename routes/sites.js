const express = require('express');
const router = express.Router();

const SITES = [
  { name: 'Cable Dahmer Chevrolet', url: 'https://www.cabledahmerchevrolet.com' },
  { name: 'Cable Dahmer Honda', url: 'https://www.cabledahmerhonda.com' },
  { name: 'Cable Dahmer Cadillac', url: 'https://www.cabledahmercadillac.com' },
  { name: 'Cable Dahmer Buick GMC', url: 'https://www.cabledahmerbuickgmc.com' },
];

router.get('/', (req, res) => res.json(SITES));

module.exports = router;
