const { COMPANIONS } = require('../data/companions');
const prisma = require('../lib/prisma');

async function getCompanionsfromDB(employeeId, lang = 'en') {
    try {
        // Convert lang to bit: 'en' = 1, others = 0
        const langBit = lang === 'en' ? 1 : 0;
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        
        // Call stored procedure using table variable to capture results
        const result = await prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                EMPFAMILY_RelativeID VARCHAR(50),
                EMPFAMILY_RELTYPE VARCHAR(10),
                EMPFAMILY_NAME VARCHAR(100)
            )
            
            INSERT INTO @Results
            EXEC P_GET_STRIP_EMP_FAMILY ${langBit}, '${empCode}'
            
            SELECT EMPFAMILY_RELTYPE AS rel,EMPFAMILY_NAME AS name FROM @Results
        `);
        
        return result;
        
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_EMP_FAMILY:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang);
        
        // Fallback to static data if stored procedure fails
        return COMPANIONS[employeeId] || [];
    }
}

async function getEmployeeNamefromDB(employeeId, lang = 'ar') {
    try {
        // Only use the stored procedure; prefer Arabic field
        const langBit = lang === 'en' ? 1 : 0;
        const empCode = String(employeeId).replace(/^:+/, '').trim();

        const rows = await prisma.$queryRawUnsafe(`
            EXEC P_GET_EMPLOYEE ${langBit}, '${empCode}'
        `);

        if (rows && rows.length > 0) {
            const row = rows[0] || {};
            const procName = row.EMPLOYEE_TNAME || row.EMPLOYEE_NAME || '';
            if (lang !== 'en') {
                // Prefer Arabic from base table when available
                const arabicRows = await prisma.$queryRawUnsafe(`
                    SELECT TOP 1 NULLIF(LTRIM(RTRIM(EMPLOYEE_NAME)), '') AS AR_NAME
                    FROM CMN_EMPLOYEE
                    WHERE LTRIM(RTRIM(CAST(EMPLOYEE_CODE AS NVARCHAR(50)))) = LTRIM(RTRIM('${empCode}'))
                `);
                const ar = (arabicRows && arabicRows[0] && arabicRows[0].AR_NAME) ? arabicRows[0].AR_NAME : '';
                if (ar) return ar;
            }
            return typeof procName === 'string' ? procName : '';
        }

        return '';
    } catch (error) {
        console.error('Error calling stored procedure P_GET_EMPLOYEE:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang);
        return '';
    }
}

async function getTransportAllowancefromDB(employeeId, lang = 'en', city = 'ALEX') {
    try {
        // Convert lang to bit: 'en' = 1, others = 0
        const langBit = lang === 'en' ? 1 : 0;
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        const cityCode = String(city).trim();
        
        // Call stored procedure using table variable to capture results
        const result = await prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                TRANSPORT_OPTION VARCHAR(50)
            )
            
            INSERT INTO @Results
            EXEC P_GET_STRIP_TRANS_ALLOWANC ${langBit}, '${cityCode}', '${empCode}'
            
            SELECT * FROM @Results
        `);
        
        // Normalize payload: parse "<number> <currency>" or return label
        const label = result && result[0] ? result[0].TRANSPORT_OPTION : 'لا يوجد';
        const match = /^\s*(\d+)\s*([\p{L}A-Z]+)?\s*$/u.exec(label || '');
        const normalized = match
            ? { value: Number(match[1]), currency: match[2] || '', label }
            : { value: 0, currency: '', label };
        
        return normalized;
        
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_TRANS_ALLOWANC:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang, 'city:', city);
        
        // Fallback to static data if stored procedure fails
        return { value: 0, currency: '', label: 'لا يوجد' };
    }
}

async function getMaximumNoOfCompanionsfromDB(employeeId) {
    try {
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        // Expect the proc to return a scalar or a single-row/column with the max value
        const rows = await prisma.$queryRawUnsafe(`
            EXEC P_GET_STRIP_POLICY '${empCode}'
        `);
        if (rows && rows.length > 0) {
            const row = rows[0];
            // Try common column names; otherwise take first scalar value
            const candidates = [
                row.MAX_COMPANIONS,
                row.MaxCompanions,
                row.MAX_NO_OF_COMPANIONS,
                row.POLICY_STRIP_CompanionMax,
            ].filter(v => typeof v !== 'undefined' && v !== null);
            if (candidates.length > 0) return Number(candidates[0]) || 0;
            const first = Object.values(row)[0];
            return typeof first === 'number' ? first : Number(first) || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_POLICY:', error);
        console.error('Parameters used - employeeId:', employeeId);
        return 0;
    }
}

module.exports = {
    getCompanionsfromDB,
    getTransportAllowancefromDB,
    getEmployeeNamefromDB,
    getMaximumNoOfCompanionsfromDB
};