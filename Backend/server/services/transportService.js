const { TRANSPORT_OPTIONS, CITY_TRANSPORT_MAP } = require('../data/transportAllowances');
const { getTransportAllowancefromDB } = require('../controllers/dbController');

async function getTransportAllowanceForEmployee(employeeId, lang = 'en', city = 'ALEX') {
    console.log('Fetching transport allowance for employee:', employeeId, 'lang:', lang, 'city:', city);

  return await getTransportAllowancefromDB(employeeId, lang, city);
  
}

function getAllTransportOptions() {
  return TRANSPORT_OPTIONS;
}

module.exports = {
  getTransportAllowanceForEmployee,
  getAllTransportOptions
};
