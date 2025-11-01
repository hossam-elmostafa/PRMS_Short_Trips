const express = require('express');
const router = express.Router();
const { getSecretKeyValues } = require('../controllers/dbController');



// GET /api/admin/key/:secret
router.get('/key/:secret', async (req, res) => {
    try {
        const { secret } = req.params;
        
        if (!secret) {
            return res.status(400).json({
                success: false,
                message: 'Secret parameter is required'
            });
        }
        //console.log('Received request for secret:', secret);
        const keyValue = await getSecretKeyValues(secret);
        
        //console.log(`Retrieved value for secret ${secret}:`, keyValue);
        return res.json({
            success: true,
            data: keyValue
        });
    } catch (error) {
        console.error('Error in /api/admin/key/:secret endpoint:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving secret value'
        });
    }
});

module.exports = router;