const express = require('express');
const router = express.Router();
const { ROOM_TYPES } = require('../data/roomTypes');
const { getAllRoomTypes } = require('../services/roomTypeService');

router.get('/room-types', (req, res) => {
  getAllRoomTypes();
  res.json({ success: true, data: ROOM_TYPES });
});

router.get('/room-type/:key', (req, res) => {
  const { key } = req.params;
  const roomType = ROOM_TYPES.find(rt => rt.key === key);

  if (!roomType) {
    return res.status(404).json({ success: false, message: 'Room type not found' });
  }

  res.json({ success: true, data: roomType });
});

module.exports = router;
