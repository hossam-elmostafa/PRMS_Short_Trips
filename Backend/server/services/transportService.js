const { TRANSPORT_OPTIONS, CITY_TRANSPORT_MAP } = require('../data/transportAllowances');

// function getTransportAllowanceForCity(city) {
//   const options = CITY_TRANSPORT_MAP[city] || TRANSPORT_OPTIONS;
//   const randomIndex = Math.floor(Math.random() * options.length);
//   return options[randomIndex];
// }

function getAllTransportOptions() {
  return TRANSPORT_OPTIONS;
}

module.exports = {
  // getTransportAllowanceForCity,
  getAllTransportOptions
};
