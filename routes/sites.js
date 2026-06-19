const express = require('express');
const router = express.Router();

const SITES = [
  { name: 'Cable Dahmer Chevrolet of Kansas City',      url: 'https://www.cabledahmerkc.com' },
  { name: 'Cable Dahmer Chevrolet of Independence',     url: 'https://www.cabledahmerind.com' },
  { name: 'Cable Dahmer Buick GMC of Independence',     url: 'https://www.cabledahmerbuickgmc.com' },
  { name: 'Cable Dahmer Buick GMC of Kansas City',      url: 'https://www.cabledahmerbgkc.com' },
  { name: "Cable Dahmer Kia of Lee's Summit",           url: 'https://www.cabledahmerkia.com' },
  { name: 'Cable Dahmer Kia of Lawrence',               url: 'https://www.cabledahmerlawrence.com' },
  { name: 'Cable Dahmer Chrysler Dodge Jeep Ram of KC', url: 'https://www.cabledahmercdjr.com' },
  { name: 'Cable Dahmer Cadillac of Kansas City',       url: 'https://www.cabledahmercadillac.com' },
  { name: 'Cable Dahmer of Topeka',                     url: 'https://www.cabledahmertopeka.com' },
];

router.get('/', (req, res) => res.json(SITES));

module.exports = router;
