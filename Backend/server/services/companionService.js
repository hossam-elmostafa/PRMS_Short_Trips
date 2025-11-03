const { getCompanionsfromDB, getEmployeeNamefromDB, getMaximumNoOfCompanionsfromDB, getLastCompanionsFromDB, getLastSubmissionForEmployee, deleteLastSubmissionFromDB } = require('../controllers/dbController');

// Relationship type mapping - both Arabic and English
const relationshipMapping = {
  ar: {
    'WH': 'زوج/زوجة',
    'SN': 'ابن',
    'D': 'ابنة',
    'F': 'أب',
    'M': 'أم',
    'B': 'أخ',
    'S': 'أخت',
    'H': 'زوج/زوجة',
    'GF': 'جد',
    'GM': 'جدة',
    'UN': 'عم',
    'AU': 'عمة',
    'CO': 'ابن عم',
    'NI': 'ابن أخ',
    'NE': 'ابنة أخ',
    'SI': 'صهر',
    'SI2': 'أخت زوج'
  },
  en: {
    'WH': 'Spouse',
    'SN': 'Son',
    'D': 'Daughter',
    'F': 'Father',
    'M': 'Mother',
    'B': 'Brother',
    'S': 'Sister',
    'H': 'Spouse',
    'GF': 'Grandfather',
    'GM': 'Grandmother',
    'UN': 'Uncle',
    'AU': 'Aunt',
    'CO': 'Cousin',
    'NI': 'Nephew',
    'NE': 'Niece',
    'SI': 'Brother-in-law',
    'SI2': 'Sister-in-law'
  }
};

/**
 * Map relationship code to translated text
 * @param {string} relType - Relationship code (e.g., 'WH', 'SN')
 * @param {string} lang - Language code ('ar' or 'en')
 * @returns {string} Translated relationship or original code if not found
 */
function mapRelationshipType(relType, lang = 'ar') {
  const mapping = relationshipMapping[lang] || relationshipMapping['ar'];
  return mapping[(relType || '').trim()] || (relType || '').trim();
}

/**
 * Get companions for an employee with translated relationships
 * @param {number} employeeId - Employee ID
 * @param {string} lang - Language code ('ar' or 'en')
 * @returns {Promise<Array>} Array of companions with translated relationship types
 */
async function getCompanions(employeeId, lang = 'ar'){
  const companions = await getCompanionsfromDB(employeeId, lang);
  
  // Apply relationship mapping based on requested language
  return companions.map(companion => ({
    ...companion,
    rel: mapRelationshipType(companion.rel, lang)
  }));
}

/**
 * Get maximum number of companions allowed for an employee
 * @param {number} employeeId - Employee ID
 * @returns {Promise<number>} Maximum number of companions (default: 6)
 */
async function getMaximumNoOfCompanions(employeeId){
  // Use policy-driven value from DB; default to 6 if not found
  const num = await getMaximumNoOfCompanionsfromDB(employeeId);
  return num || 6;
}

/**
 * Get employee name with language fallback
 * @param {number} employeeId - Employee ID
 * @param {string} lang - Language code ('ar' or 'en')
 * @returns {Promise<string>} Employee name
 */
async function getEmployeeName(employeeId, lang = 'ar') {
  // Try requested lang first; if empty, try the other
  const primary = await getEmployeeNamefromDB(employeeId, lang);
  if (primary) return primary;
  const fallback = await getEmployeeNamefromDB(employeeId, lang === 'en' ? 'ar' : 'en');
  return fallback;
}

/**
 * Get last saved companions for an employee with translated relationships
 * @param {number} employeeId - Employee ID
 * @param {string} lang - Language code ('ar' or 'en')
 * @returns {Promise<Array>} Array of companions with translated relationship types
 */
async function getLastCompanions(employeeId, lang = 'ar') {
  const companions = await getLastCompanionsFromDB(lang, employeeId);
  return (Array.isArray(companions) ? companions : []).map(companion => ({
    RELID: companion.RELID,
    name: companion.rel, // SWAPPED: DB returns name in 'rel' field
    rel: mapRelationshipType((companion.name || '').trim(), lang) // SWAPPED: DB returns rel code in 'name' field
  }));
}

async function getLastSubmission(employeeId, lang = 'ar') {
  return await getLastSubmissionForEmployee(lang, employeeId);
}

async function deleteLastSubmission(employeeId) {
  return await deleteLastSubmissionFromDB(employeeId);
}


module.exports = {
  getCompanions,
  getMaximumNoOfCompanions,
  getEmployeeName,
  mapRelationshipType, // Export for testing or direct use
  getLastCompanions,
  getLastSubmission,
  deleteLastSubmission
};