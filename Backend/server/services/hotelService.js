const { HOTELS } = require('../data/hotels');

// function getAllCities() {
//   return Object.keys(HOTELS);
// }


function getAllHotels() {
  return HOTELS;
}



// function getHotelsByCity(city) {
//   return HOTELS[city] || [];
// }

// function getHotelById(hotelId) {
//   for (const city in HOTELS) {
//     const hotel = HOTELS[city].find(h => h.id === hotelId);
//     if (hotel) {
//       return { ...hotel, city };
//     }
//   }
//   return null;
// }

// function getMaxExtraBedsForHotel(hotelId) {
//   const maxBeds = {};
//   const { ROOM_TYPES } = require('../data/roomTypes');

//   ROOM_TYPES.forEach(rt => {
//     maxBeds[rt.key] = Math.floor(Math.random() * 3);
//   });

//   return maxBeds;
// }

module.exports = {
  // getAllCities,
  // getHotelsByCity,
  // getHotelById,
  // getMaxExtraBedsForHotel,
  getAllHotels
};
