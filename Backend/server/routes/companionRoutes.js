const express = require('express');
const router = express.Router();
const companionService = require('../services/companionService');


router.get('/companions/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { lang } = req.query; // Get language from query parameter
    
    const companions = await companionService.getCompanions(employeeId, lang);

    if (!companions || companions.length === 0) {
      return res.status(404).json({ success: false, message: 'companion not found' });
    }

    res.json({ success: true, data: companions });
  } catch (error) {
    console.error('Error in companions route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { lang } = req.query; // optional language hint: 'ar' | 'en'

    if (!employeeId) {
      return res.status(404).json({ success: false, message: 'employee not found' });
    }

    const name = await companionService.getEmployeeName(employeeId, (lang || 'ar'));
    // Always respond 200 to avoid breaking frontend Promise.all; empty string if not found
    res.json({ success: true, data: name || '' });
  } catch (error) {
    console.error('Error in employee name route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/maximum-no-of-companions', async (req, res) => {
  try {
    const { employeeId } = req.query;
    const maxNoOfCompanions = await companionService.getMaximumNoOfCompanions(employeeId);
    res.json({ success: true, data: maxNoOfCompanions });
  } catch (error) {
    console.error('Error in maximum-no-of-companions route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});





module.exports = router;
