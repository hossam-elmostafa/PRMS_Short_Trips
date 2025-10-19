const express = require('express');
const router = express.Router();
const companionService = require('../services/companionService');


router.get('/companions', (req, res) => {
  const companions = companionService.getCompanions();

  if (companions.length === 0) {
    return res.status(404).json({ success: false, message: 'companion not found' });
  }

  res.json({ success: true, data: companions });
});

router.get('/employee/:employeeId', (req, res) => {
  const { employeeId } = req.params;

  if (!employeeId) {
    return res.status(404).json({ success: false, message: 'employee not found' });
  }
  const employeeNames =['عبدالرحمن غنيم', 'محمد احمد', 'سارة علي' ];
  console.log(employeeId);


  res.json({ success: true, data: employeeNames[employeeId] });
});

router.get('/maximum-no-of-companions', (req, res) => {
  const maxNoOfCompanions = companionService.getMaximumNoOfCompanions();

  res.json({ success: true, data: maxNoOfCompanions });
});





module.exports = router;
