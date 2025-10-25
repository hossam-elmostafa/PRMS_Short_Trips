const { TRANSPORT_OPTIONS } = require('../data/transportAllowances');
const { getTransportAllowancefromDB } = require('../controllers/dbController');

async function getTransportAllowanceForEmployee(employeeId, lang = 'en', city = 'ALEX') {

  return await getTransportAllowancefromDB(employeeId, lang, city);
  
}

function getAllTransportOptions() {
  return TRANSPORT_OPTIONS;
}

module.exports = {
  getTransportAllowanceForEmployee,
  getAllTransportOptions
};
