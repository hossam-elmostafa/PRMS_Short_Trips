const express = require('express');
const router = express.Router();
const companionService = require('../services/companionService');

router.get('/companionss', (req, res) => {
  const companion = companionService.getAllCompanions();

  if (!companion) {
    return res.status(404).json({ success: false, message: 'companion not found' });
  }

  res.json({ success: true, data: companion });
});


module.exports = router;
