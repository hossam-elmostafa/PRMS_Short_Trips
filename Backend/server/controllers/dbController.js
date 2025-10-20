const { COMPANIONS } = require('../data/companions');
const prisma = require('../lib/prisma');

async function getHotelsByCityFromDB(lang = 'ar', city = 'ALEX') {
    try {
        const langBit = lang === 'en' ? 1 : 0;
        let cityInput = String(city).trim();

        const normalizeArabic = (s) => {
            return String(s || '')
                .replace(/[\u0640]/g, '') // Tatweel
                .replace(/[\u0622\u0623\u0625]/g, '\u0627') // all alef variants -> alef
                .replace(/[\u0649]/g, '\u064A') // alif maqsura -> ya
                .replace(/[\u0629]/g, '\u0647') // taa marbuta -> ha (best-effort)
                .replace(/\s+/g, ' ')
                .trim();
        };

        // Normalize city: accept either code (e.g., "ALEX") or localized name (e.g., "الإسكندرية")
        // If input looks like a Latin code, use it; otherwise resolve via P_GET_STRIP_CITIES
        let cityCode = cityInput;
        const looksLikeCode = /^[A-Z]{2,6}$/.test(cityInput);
        if (!looksLikeCode) {
            try {
                const [citiesAr, citiesEn] = await Promise.all([
                    getCitiesFromDB('ar'),
                    getCitiesFromDB('en')
                ]);
                const inputNorm = normalizeArabic(cityInput);
                const all = [...(citiesAr || []), ...(citiesEn || [])];
                let match = all.find(c => String(c.name || '').trim() === cityInput);
                if (!match) {
                    match = all.find(c => normalizeArabic(c.name || '') === inputNorm);
                }
                if (!match) {
                    match = all.find(c => (c.name || '').includes(cityInput));
                }
                if (match && match.code) {
                    cityCode = String(match.code).trim().toUpperCase();
                }
                try { console.log('City resolution:', { input: cityInput, resolvedCode: cityCode }); } catch (_) {}
            } catch (_) {
                // ignore and fallback to original input
            }
        }

        // Execute proc directly; map flexible column names
        const esc = (s) => String(s).replace(/'/g, "''");
        const cityCodeEsc = esc(cityCode);
        const cityNameEsc = esc(cityInput);

        // Fetch Arabic and English names, then merge on HOTEL_CODE to deliver both ar/en
        const queryFor = async (bit, city) => prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                HOTEL_CODE NVARCHAR(100),
                HOTEL_NAME NVARCHAR(400),
                HOTEL_PIC VARBINARY(MAX),
                HOTEL_ROOM_TYPES NVARCHAR(MAX)
            );

            INSERT INTO @Results
            EXEC P_GET_STRIP_HOTEL ${bit}, N'${city}';

            SELECT HOTEL_CODE, HOTEL_NAME FROM @Results;
        `);

        // First try with resolved code; then, if needed, retry with original city name
        let rowsAr = await queryFor(0, cityCodeEsc);
        let rowsEn = await queryFor(1, cityCodeEsc);

        if ((!rowsAr || rowsAr.length === 0) && (!rowsEn || rowsEn.length === 0)) {
            rowsAr = await queryFor(0, cityNameEsc);
            rowsEn = await queryFor(1, cityNameEsc);
        }

        const arByCode = new Map();
        const enByCode = new Map();
        (rowsAr || []).forEach(r => {
            const code = String(r.HOTEL_CODE || '').trim();
            if (code) arByCode.set(code, String(r.HOTEL_NAME || '').trim());
        });
        (rowsEn || []).forEach(r => {
            const code = String(r.HOTEL_CODE || '').trim();
            if (code) enByCode.set(code, String(r.HOTEL_NAME || '').trim());
        });

        const allCodes = Array.from(new Set([
            ...Array.from(arByCode.keys()),
            ...Array.from(enByCode.keys())
        ]));

        const mapped = allCodes.map((code, index) => {
            const arName = arByCode.get(code) || '';
            const enName = enByCode.get(code) || arName || '';
            const id = code || `${cityCode}-${index + 1}`;
            return { id, ar: arName, en: enName };
        });

        // Temporary log to verify counts and names during debugging
        try { console.log('Hotels fetched for city', cityCode, 'count:', mapped.length, mapped.map(h => h.ar)); } catch (_) {}
        return mapped;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_HOTEL:', error);
        console.error('Parameters used - city:', city, 'lang:', lang);
        return [];
    }
}

async function getCitiesFromDB(lang = 'ar') {
    try {
        const langBit = lang === 'en' ? 1 : 0;
        const rows = await prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                CITIES_CODE VARCHAR(50),
                CITIES_NAME NVARCHAR(200)
            );

            INSERT INTO @Results
            EXEC P_GET_STRIP_CITIES ${langBit};

            SELECT CITIES_CODE, CITIES_NAME FROM @Results;
        `);

        return (rows || []).map(r => ({ code: r.CITIES_CODE, name: r.CITIES_NAME }));
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_CITIES:', error);
        console.error('Parameters used - lang:', lang);
        return [];
    }
}

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
                row.POLICY_STRIP_MAXCOMPAN,
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
    getMaximumNoOfCompanionsfromDB,
    getHotelsByCityFromDB,
    getCitiesFromDB
};