const express = require('express');
const router = express.Router();
const { ROOM_TYPES } = require('../data/roomTypes');
const { getAllRoomTypes, getBedsCountByHotel } = require('../services/roomTypeService');

// Get all room types
router.get('/room-types', (req, res) => {
  getAllRoomTypes();
  res.json({ success: true, data: ROOM_TYPES });
});

// Get bed counts for a specific hotel
router.get('/hotel/:hotelCode/beds', async (req, res) => {
  try {
    const { hotelCode } = req.params;
    if (!hotelCode) {
      return res.status(400).json({
        success: false,
        message: 'Hotel code is required'
      });
    }

    const bedCounts = await getBedsCountByHotel(hotelCode);
    res.json({
      success: true,
      data: bedCounts
    });
  } catch (error) {
    console.error('Error retrieving bed counts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bed counts',
      error: error.message
    });
  }
});

module.exports = router;
