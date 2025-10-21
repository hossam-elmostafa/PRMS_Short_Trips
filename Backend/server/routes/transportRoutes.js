const express = require('express');
const router = express.Router();
const transportService = require('../services/transportService');

router.get('/transport-options', (req, res) => {
  const options = transportService.getAllTransportOptions();
  res.json({ success: true, data: options });
});

router.get('/transport-options/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { lang, city } = req.query;
    
    // Get employee-specific transport allowance
    const transportAllowance = await transportService.getTransportAllowanceForEmployee(
      employeeId, 
      lang || 'en', 
      city || 'ALEX'
    );

    // Return both static options and employee-specific allowance
    const staticOptions = transportService.getAllTransportOptions();
    const result = {
      staticOptions,
      employeeAllowance: transportAllowance
    };

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in transport options route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/transport-allowance/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { lang, city } = req.query; // Get language and city from query parameters
    
    const transportAllowance = await transportService.getTransportAllowanceForEmployee(
      employeeId, 
      lang || 'en', 
      city || 'ALEX'
    );

    // Always return 200 with a normalized allowance object
    res.json({ success: true, data: transportAllowance || { value: 0, currency: '', label: 'لا يوجد' } });
  } catch (error) {
    console.error('Error in transport allowance route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
