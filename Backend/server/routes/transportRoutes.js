const express = require('express');
const router = express.Router();
const transportService = require('../services/transportService');

router.get('/transport-options', (req, res) => {
  const options = transportService.getAllTransportOptions();
  res.json({ success: true, data: options });
});

router.get('/transport-allowance/:city', (req, res) => {
  const { city } = req.params;
  const allowance = transportService.getTransportAllowanceForCity(city);

  res.json({ success: true, data: { allowance } });
});

module.exports = router;
