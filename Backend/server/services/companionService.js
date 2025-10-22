const { COMPANIONS } = require('../data/companions');
const { getCompanionsfromDB, getEmployeeNamefromDB, getMaximumNoOfCompanionsfromDB } = require('../controllers/dbController');

// Relationship type mapping from English codes to Arabic terms
const relationshipMapping = {
  'WH': 'زوجة',      // Wife
  'SN': 'ابن',        // Son
  'D': 'ابنة',        // Daughter
  'F': 'أب',          // Father
  'M': 'أم',          // Mother
  'B': 'أخ',          // Brother
  'S': 'أخت',         // Sister
  'H': 'زوج',         // Husband
  'GF': 'جد',         // Grandfather
  'GM': 'جدة',        // Grandmother
  'UN': 'عم',         // Uncle
  'AU': 'عمة',        // Aunt
  'CO': 'ابن عم',     // Cousin
  'NI': 'ابن أخ',     // Nephew
  'NE': 'ابنة أخ',    // Niece
  'SI': 'صهر',        // Brother-in-law
  'SI2': 'أخت زوج',   // Sister-in-law
};

function mapRelationshipType(relType, lang = 'ar') {
  return relationshipMapping[relType] || relType;
}

async function getCompanions(employeeId, lang = 'en'){
  //console.log('Fetching companions for employee:', employeeId, 'lang:', lang);
  const companions = await getCompanionsfromDB(employeeId, lang);
  
  // Always apply Arabic relationship mapping
  return companions.map(companion => ({
    ...companion,
    rel: mapRelationshipType(companion.rel, 'ar')
  }));
}

async function getMaximumNoOfCompanions(employeeId){
  // Use policy-driven value from DB; default to 6 if not found
  const num = await getMaximumNoOfCompanionsfromDB(employeeId);
  return num || 6;
}

module.exports = {
  getCompanions,
    getMaximumNoOfCompanions,
    getEmployeeName: async (employeeId, lang = 'ar') => {
      // Try requested lang first; if empty, try the other
      const primary = await getEmployeeNamefromDB(employeeId, lang);
      if (primary) return primary;
      const fallback = await getEmployeeNamefromDB(employeeId, lang === 'en' ? 'ar' : 'en');
      return fallback;
    }
};
