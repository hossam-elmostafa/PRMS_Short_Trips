const express = require('express');
const router = express.Router();
const companionService = require('../services/companionService');


router.get('/companions/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    // BUG-AZ-PR-29-10-2025.1: Normalize lang to 'ar'|'en' (e.g., 'en-US' -> 'en')
    const lang = (String(req.query.lang || 'ar').toLowerCase().startsWith('en')) ? 'en' : 'ar';
    
    //console.log('🌐 API Route - Language received:', lang); // ADD THIS
    
    const companions = await companionService.getCompanions(employeeId, lang);
     
    if (!companions){ /*|| companions.length === 08)*/ //{ It is valid to have zero companions
      return res.status(404).json({ success: false, message: 'companion not found' });
    }

    //console.log('📤 Sending companions:', companions); // ADD THIS
    res.json({ success: true, data: companions });
  } catch (error) {
    console.error('Error in companions route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/employee/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    // BUG-AZ-PR-29-10-2025.1: Normalize lang to avoid Arabic fallback in EN mode
    const lang = (String(req.query.lang || 'ar').toLowerCase().startsWith('en')) ? 'en' : 'ar';

    if (!employeeId) {
      return res.status(404).json({ success: false, message: 'employee not found' });
    }

    const name = await companionService.getEmployeeName(employeeId, lang);
    // Always respond 200 to avoid breaking frontend Promise.all; empty string if not found
    res.json({ success: true, data: name || '' });
  } catch (error) {
    console.error('Error in employee name route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/maximum-no-of-companions/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const maxNoOfCompanions = await companionService.getMaximumNoOfCompanions(employeeId);
    res.json({ success: true, data: maxNoOfCompanions });
  } catch (error) {
    console.error('Error in maximum-no-of-companions route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/last-companions/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    // BUG-AZ-PR-29-10-2025.1: Normalize lang for last-companions endpoint
    const lang = (String(req.query.lang || 'ar').toLowerCase().startsWith('en')) ? 'en' : 'ar';
    const companions = await companionService.getLastCompanions(employeeId, lang);
    if (!companions) {
      return res.status(404).json({ success: false, message: 'last companions not found' });
    }
    res.json({ success: true, data: companions });
  } catch (error) {
    console.error('Error in last-companions route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/last-submission/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    // BUG-AZ-PR-29-10-2025.1: Normalize lang for last-submission endpoint
    const lang = (String(req.query.lang || 'ar').toLowerCase().startsWith('en')) ? 'en' : 'ar';
    const data = await companionService.getLastSubmission(employeeId, lang);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in last-submission route:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});
router.get('/delete-last-submission/:employeeId', async (req, res) => {
  try {
    const { employeeId } = req.params;
    const deleted = await companionService.deleteLastSubmission(employeeId);
    if (deleted) {
      res.json({ success: true, message: 'Submission deleted successfully', deleted: true });
    } else {
      res.json({ success: false, message: 'No records found to delete', deleted: false });
    }
  } catch (error) {
    console.error('Error in delete-last-submission route:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});
module.exports = router;
