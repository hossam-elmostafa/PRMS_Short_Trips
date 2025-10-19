const { HOTEL_BASE_PRICES, EXTRA_BED_PRICES } = require('../data/hotels');
const { ROOM_TYPES } = require('../data/roomTypes');

function calculateRoomPrice(hotelId, date, roomTypeKey) {
  const base = HOTEL_BASE_PRICES[hotelId] || 1000;

  const roomType = ROOM_TYPES.find(rt => rt.key === roomTypeKey);
  const roomFactor = roomType ? roomType.factor : 1.0;

  const dateObj = new Date(date);
  const day = dateObj.getDay();
  const weekend = (day === 5 || day === 6) ? 1.2 : 1.0;
  const fluctuation = (dateObj.getDate() % 7) * 40;

  return Math.round(base * roomFactor * weekend + fluctuation);
}

function getExtraBedPrice(hotelId) {
  return EXTRA_BED_PRICES[hotelId] || 400;
}

function calculateTripTotal(hotelId, date, roomCounts, extraBedCounts) {
  let total = 0;

  for (const roomType of ROOM_TYPES) {
    const count = roomCounts[roomType.key] || 0;
    if (count > 0) {
      const roomPrice = calculateRoomPrice(hotelId, date, roomType.key);
      total += roomPrice * count;
    }

    const extraBeds = extraBedCounts[roomType.key] || 0;
    if (extraBeds > 0) {
      const extraBedPrice = getExtraBedPrice(hotelId);
      total += extraBedPrice * extraBeds;
    }
  }

  return total;
}

function calculateEmployeeShare(total) {
  return Math.round(total * 0.6);
}

module.exports = {
  calculateRoomPrice,
  getExtraBedPrice,
  calculateTripTotal,
  calculateEmployeeShare
};
