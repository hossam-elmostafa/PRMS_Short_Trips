require('dotenv').config();
const prisma = require('../lib/prisma');

async function getHotelsByCityFromDB(lang = 'ar', city = 'ALEX') {
    //console.log(`[getHotelsByCityFromDB] lang=${lang}, city=${city}`);
    try {
        //console.log(10);
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
        //console.log(20);

        // Normalize city: accept either code (e.g., "ALEX") or localized name (e.g., "الإسكندرية")
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
            } catch (_) {
                // ignore and fallback to original input
            }
        }
        //console.log(30);
        // Execute proc directly; map flexible column names
        const esc = (s) => String(s).replace(/'/g, "''");
        const cityCodeEsc = esc(cityCode);
        const cityNameEsc = esc(cityInput);
        //console.log(1);
        // Fetch Arabic and English names, then merge on HOTEL_CODE to deliver both ar/en
        
        const queryFor = async (bit, city) => prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                HOTEL_CODE NVARCHAR(100),
                HOTEL_NAME NVARCHAR(400),
                HOTEL_PIC VARCHAR(300),
                HOTEL_ROOM_TYPES NVARCHAR(MAX),
				HOTEL_BEDS_COUNTS NVARCHAR(MAX),
				HOTEL_EXTRA_BEDS_COUNTS NVARCHAR(MAX)
            );

            INSERT INTO @Results
            EXEC P_GET_STRIP_HOTEL ${bit}, N'${city}';

            SELECT HOTEL_CODE, HOTEL_NAME, HOTEL_ROOM_TYPES,HOTEL_EXTRA_BEDS_COUNTS,HOTEL_BEDS_COUNTS FROM @Results;
        `);

        // First try with resolved code; then, if needed, retry with original city name
        let rowsAr = await queryFor(0, cityCodeEsc);
        let rowsEn = await queryFor(1, cityCodeEsc);
            //console.log(cityCodeEsc);
        if ((!rowsAr || rowsAr.length === 0) && (!rowsEn || rowsEn.length === 0)) {
            rowsAr = await queryFor(0, cityNameEsc);
            rowsEn = await queryFor(1, cityNameEsc);
        }

        const arByCode = new Map();
        const enByCode = new Map();
        const roomTypesByCode = new Map();
        const roomExtraBeds = new Map();
        const roomBeds = new Map();
        
        (rowsAr || []).forEach(r => {
            const code = String(r.HOTEL_CODE || '').trim();
            if (code) {
                arByCode.set(code, String(r.HOTEL_NAME || '').trim());
                // Store room types from the procedure result
                if (r.HOTEL_ROOM_TYPES) {
                    //console.log('Adding room types for', code, r.HOTEL_ROOM_TYPES);
                    roomTypesByCode.set(code, String(r.HOTEL_ROOM_TYPES).trim());
                }
                //console.log(r);
                if (r.HOTEL_EXTRA_BEDS_COUNTS) {
                    //console.log('Adding extra beds for', code, r.HOTEL_EXTRA_BEDS_COUNTS);
                    roomExtraBeds.set(code, String(r.HOTEL_EXTRA_BEDS_COUNTS).trim());
                }
                if (r.HOTEL_BEDS_COUNTS) {
                    //console.log(' beds for', code, r.HOTEL_BEDS_COUNTS);
                    roomBeds.set(code, String(r.HOTEL_BEDS_COUNTS).trim());
                }
                
            }
        });
        
        (rowsEn || []).forEach(r => {
            const code = String(r.HOTEL_CODE || '').trim();
            if (code) {
                enByCode.set(code, String(r.HOTEL_NAME || '').trim());
                // Store room types if not already set from Arabic query
                if (r.HOTEL_ROOM_TYPES && !roomTypesByCode.has(code)) {
                    roomTypesByCode.set(code, String(r.HOTEL_ROOM_TYPES).trim());
                }
                if (r.HOTEL_EXTRA_BEDS_COUNTS && !roomExtraBeds.has(code)) {
                    roomExtraBeds.set(code, String(r.HOTEL_EXTRA_BEDS_COUNTS).trim());
                }
                if (r.HOTEL_BEDS_COUNTS && !roomBeds.has(code)) {
                    roomBeds.set(code, String(r.HOTEL_BEDS_COUNTS).trim());
                }
                
            }
        });

        const allCodes = Array.from(new Set([
            ...Array.from(arByCode.keys()),
            ...Array.from(enByCode.keys())
        ]));

        const mapped = allCodes.map((code, index) => {
            const arName = arByCode.get(code) || '';
            const enName = enByCode.get(code) || arName || '';
            const id = code || `${cityCode}-${index + 1}`;
            const supportedRoomTypes = roomTypesByCode.get(code) || 'S,D,T'; // Default to all if not specified
            const supportedRoomExtraBeds = roomExtraBeds.get(code) || 'S:0,D:0,T:0'; // Default to all if not specified
            const supportedRoomBeds = roomBeds.get(code) || 'D:2,FR:4,FS:5,J:6,S:1,T:3'; // Default to all if not specified
            
            return { 
                id, 
                ar: arName, 
                en: enName,
                supportedRoomTypes, // Add supported room types
                supportedRoomExtraBeds,
                supportedRoomBeds
            };
        });

        return mapped;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_HOTEL:', error);
        console.error('Parameters used - city:', city, 'lang:', lang);
        return [];
    }
}

// BUG-AZ-PR-29-10-2025.1: Fixed by AG - Use language-specific city names for grouping hotels
// Issue: Hotels were always grouped by Arabic city names
// Solution: Query both English and Arabic city names, then group by the requested language
async function getHotelsFromDB(lang = 'ar') {
    try {
        // Use language-specific city names
        const langBit = lang === 'en' ? 1 : 0;
        //console.log(`[getHotelsFromDB] lang=${lang}, langBit=${langBit}`);
        const rows = await prisma.$queryRawUnsafe(`
            SELECT TOP 5
                h.Hotel_Code AS HOTEL_CODE,
                h.Hotel_Name AS HOTEL_EN_NAME,
                h.Hotel_TName AS HOTEL_AR_NAME,
                c.CITIES_CODE AS CITY_CODE,
                c.CITIES_NAME AS CITY_EN_NAME,
                c.CITIES_TNAME AS CITY_AR_NAME
            FROM PRMS_HOTEL h
            LEFT JOIN CMN_CITIES c ON c.CITIES_CODE = h.Hotel_City
            WHERE ISNULL(h.Hotel_Active, 'Y') = 'Y'
        `);
        //console.log(`[getHotelsFromDB] Sample row:`, rows[0]);
        
        // Get all rows for actual processing
        const allRows = await prisma.$queryRawUnsafe(`
            SELECT
                h.Hotel_Code AS HOTEL_CODE,
                h.Hotel_Name AS HOTEL_EN_NAME,
                h.Hotel_TName AS HOTEL_AR_NAME,
                c.CITIES_CODE AS CITY_CODE,
                c.CITIES_NAME AS CITY_EN_NAME,
                c.CITIES_TNAME AS CITY_AR_NAME
            FROM PRMS_HOTEL h
            LEFT JOIN CMN_CITIES c ON c.CITIES_CODE = h.Hotel_City
            WHERE ISNULL(h.Hotel_Active, 'Y') = 'Y'
        `);
        
        const hotelsByCity = {};
        (allRows || []).forEach(r => {
            const code = String(r.HOTEL_CODE || '').trim();
            if (!code) return;
            const en = String(r.HOTEL_EN_NAME || '').trim();
            const ar = String(r.HOTEL_AR_NAME || r.HOTEL_EN_NAME || '').trim();
            
            // BUG-AZ-PR-29-10-2025.1: Use language-specific city name for grouping
            // CITIES_NAME = English name, CITIES_TNAME = Arabic name (based on database schema)
            const cityEn = String(r.CITY_EN_NAME || 'Unknown').trim();
            const cityAr = String(r.CITY_AR_NAME || cityEn || 'غير محدد').trim();
            const cityKey = lang === 'en' ? cityEn : cityAr;

            if (!hotelsByCity[cityKey]) hotelsByCity[cityKey] = [];
            hotelsByCity[cityKey].push({ id: code, en, ar });
        });
        //console.log(`[getHotelsFromDB] City keys:`, Object.keys(hotelsByCity).slice(0, 3));
        return hotelsByCity;
    } catch (error) {
        console.error('getHotelsFromDB: database query failed:', error && error.message ? error.message : error);
        // Fallback to static data file so API remains usable when DB is down
        try {
            const { HOTELS } = require('../data/hotels');
            return HOTELS;
        } catch (e) {
            console.error('getHotelsFromDB: failed to load fallback HOTELS data:', e && e.message ? e.message : e);
            return {};
        }
    }
}

// BUG-AZ-PR-29-10-2025.1: Fixed by AG - Corrected stored procedure language parameter
// Issue: Cities were showing in wrong language (reversed)
// Solution: The stored procedure P_GET_STRIP_CITIES uses reversed logic: 0=English, 1=Arabic
async function getCitiesFromDB(lang = 'ar') {
    try {
        // The stored procedure has reversed logic: 0=English, 1=Arabic
        const langBit = lang === 'en' ? 0 : 1;
        //console.log(`[getCitiesFromDB] lang=${lang}, langBit=${langBit}`);
        const rows = await prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                CITIES_CODE VARCHAR(50),
                CITIES_NAME NVARCHAR(200)
            );

            INSERT INTO @Results
            EXEC P_GET_STRIP_CITIES ${langBit};

            SELECT CITIES_CODE, CITIES_NAME FROM @Results;
        `);

        const result = (rows || []).map(r => ({ code: r.CITIES_CODE, name: r.CITIES_NAME }));
        //console.log(`[getCitiesFromDB] First 3 cities:`, result.slice(0, 3));
        return result;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_CITIES:', error);
        console.error('Parameters used - lang:', lang);
        return [];
    }
}

async function getCompanionsfromDB(employeeId, lang = 'en') {
    try {
        // BUG-AZ-PR-29-10-2025.1: Companions proc expects 1 = Arabic, 0 = English (confirmed)
        const langBit = lang === 'ar' ? 1 : 0;
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
            
            SELECT EMPFAMILY_RelativeID AS RELID ,EMPFAMILY_RELTYPE AS rel,EMPFAMILY_NAME AS name FROM @Results
        `);
        // console.log(`
        //     DECLARE @Results TABLE (
        //         EMPFAMILY_RelativeID VARCHAR(50),
        //         EMPFAMILY_RELTYPE VARCHAR(10),
        //         EMPFAMILY_NAME VARCHAR(100)
        //     )
            
        //     INSERT INTO @Results
        //     EXEC P_GET_STRIP_EMP_FAMILY ${langBit}, '${empCode}'
            
        //     SELECT EMPFAMILY_RelativeID AS RELID ,EMPFAMILY_RELTYPE AS rel,EMPFAMILY_NAME AS name FROM @Results
        // `);
        
        return result;
        
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_EMP_FAMILY:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang);
        
        return '';
    }
}

async function getEmployeeNamefromDB(employeeId, lang = 'ar') {
    try {
        //console.log('🗃️ getEmployeeNamefromDB called with:', { employeeId, lang });
        
        // BUG-AZ-PR-29-10-2025.1: Correct bit for employee proc (1 = English, 0 = Arabic)
        const langBit = lang === 'en' ? 1 : 0;
        
        //console.log('📊 Using langBit:', langBit, 'for language:', lang);
        
        const empCode = String(employeeId).replace(/^:+/, '').trim();

        //console.log('🔍 Calling stored procedure with:', { langBit, empCode });

        const rows = await prisma.$queryRawUnsafe(`
            EXEC P_GET_EMPLOYEE ${langBit}, '${empCode}'
        `);

        //console.log('📥 Stored procedure result:', rows);

        if (rows && rows.length > 0) {
            const row = rows[0] || {};
            const primary = (lang === 'en')
                ? (row.EMPLOYEE_NAME || row.EMPLOYEE_TNAME || '')
                : (row.EMPLOYEE_TNAME || row.EMPLOYEE_NAME || '');
            const alternate = (lang === 'en')
                ? (row.EMPLOYEE_TNAME || row.EMPLOYEE_NAME || '')
                : (row.EMPLOYEE_NAME || row.EMPLOYEE_TNAME || '');
            const isArabic = (s) => /[\u0600-\u06FF]/.test(String(s || ''));
            let procName = primary;
            // BUG-AZ-PR-29-10-2025.1: Some DBs return swapped columns; auto-correct by script detection
            if (lang === 'en' && isArabic(primary) && alternate) {
                procName = alternate;
            }
            if (lang === 'ar' && !isArabic(primary) && isArabic(alternate)) {
                procName = alternate;
            }

            // BUG-AZ-PR-29-10-2025.1: Fallback requery if still mismatched script
            const shouldBeArabic = lang !== 'en';
            const hasArabic = isArabic(procName);
            if ((shouldBeArabic && !hasArabic) || (!shouldBeArabic && hasArabic)) {
                const flippedBit = langBit === 1 ? 0 : 1;
                try {
                    const altRows = await prisma.$queryRawUnsafe(`
                        EXEC P_GET_EMPLOYEE ${flippedBit}, '${empCode}'
                    `);
                    if (altRows && altRows.length > 0) {
                        const r = altRows[0] || {};
                        const pickEn = (r.EMPLOYEE_NAME || r.EMPLOYEE_TNAME || '');
                        const pickAr = (r.EMPLOYEE_TNAME || r.EMPLOYEE_NAME || '');
                        const candidate = shouldBeArabic ? pickAr : pickEn;
                        if (typeof candidate === 'string' && candidate.trim() !== '') {
                            const candidateArabic = isArabic(candidate);
                            if ((shouldBeArabic && candidateArabic) || (!shouldBeArabic && !candidateArabic)) {
                                procName = candidate;
                            }
                        }
                    }
                } catch (_) {
                    // ignore fallback errors
                }
            }
            
            //console.log('📄 Procedure returned name:', procName);
            
            if (lang !== 'en') {
                // Prefer Arabic from base table when available
                const arabicRows = await prisma.$queryRawUnsafe(`
                    SELECT TOP 1 NULLIF(LTRIM(RTRIM(EMPLOYEE_NAME)), '') AS AR_NAME
                    FROM CMN_EMPLOYEE
                    WHERE LTRIM(RTRIM(CAST(EMPLOYEE_CODE AS NVARCHAR(50)))) = LTRIM(RTRIM('${empCode}'))
                `);
                
                //console.log('📥 Direct Arabic query result:', arabicRows);
                
                const ar = (arabicRows && arabicRows[0] && arabicRows[0].AR_NAME) ? arabicRows[0].AR_NAME : '';
                if (ar) {
                    //console.log('✅ Returning Arabic name from base table:', ar);
                    return ar;
                }
            }
            
            //console.log('✅ Returning name from procedure:', procName);
            return typeof procName === 'string' ? procName : '';
        }

        //console.log('⚠️ No results found');
        return '';
    } catch (error) {
        console.error('❌ Error calling stored procedure P_GET_EMPLOYEE:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang);
        return '';
    }
}

async function getTransportAllowancefromDB(employeeId, lang = 'en', city = 'ALEX') {
    try {
        const langBit = lang === 'en' ? 1 : 0;
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        const esc = (s) => String(s || '').replace(/'/g, "''").trim();

        // Try to resolve city code similar to hotels logic
        let cityInput = esc(city);
        let resolvedCity = cityInput;
        try {
            const [citiesAr, citiesEn] = await Promise.all([
                getCitiesFromDB('ar'),
                getCitiesFromDB('en')
            ]);
            const normalizeArabic = (text) => String(text || '')
                .replace(/أ|إ|آ/g, 'ا')
                .replace(/ى/g, 'ي')
                .replace(/ة/g, 'ه')
                .replace(/ـ/g, '')
                .replace(/\s+/g, ' ').trim();
            const inputNorm = normalizeArabic(cityInput);
            const all = [...(citiesAr || []), ...(citiesEn || [])];
            let match = all.find(c => String(c.code || '').toUpperCase() === cityInput.toUpperCase());
            if (!match) match = all.find(c => normalizeArabic(c.name || '') === inputNorm);
            if (!match) match = all.find(c => (c.name || '').includes(cityInput));
            if (match && match.code) {
                resolvedCity = esc(String(match.code).toUpperCase());
            }
        } catch (_) {
            // ignore resolution errors; use input as-is
        }

        // Helper to execute the proc and read any returned value
        const execForCity = async (cityParam) => prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                VAL NVARCHAR(200)
            );
            INSERT INTO @Results (VAL)
            EXEC P_GET_STRIP_TRANS_ALLOWANC ${langBit}, N'${cityParam}', N'${esc(empCode)}';
            SELECT * FROM @Results;
        `);

        // First try resolved code, then fall back to original input
        let rows = await execForCity(resolvedCity);
        if ((!rows || rows.length === 0) && resolvedCity !== cityInput) {
            rows = await execForCity(cityInput);
        }

        if (rows && rows.length > 0) {
            const row = rows[0] || {};
            // Read the first value regardless of column name
            const firstValue = Object.values(row)[0];
            let label = firstValue != null ? String(firstValue) : '';

            // If row contained a known column, prefer it
            if (row.TRANSPORT_OPTION != null) label = String(row.TRANSPORT_OPTION);
            if (row.TRANS_ALLOWANCE != null) label = String(row.TRANS_ALLOWANCE);
            if (row.VALUE != null) label = String(row.VALUE);

            // Normalize: numeric or "<number> <currency>"
            const numOnly = /^\s*([0-9]+)\s*$/u.exec(label);
            if (numOnly) {
                const n = Number(numOnly[1]);
                return { value: n, currency: '', label: String(n) };
            }
            const numWithCurr = /^\s*([0-9]+)\s*([\p{L}A-Z]+)?\s*$/u.exec(label);
            if (numWithCurr) {
                const n = Number(numWithCurr[1]);
                const curr = numWithCurr[2] || '';
                return { value: n, currency: curr, label };
            }
            return { value: 0, currency: '', label: label || '' };
        }

        return { value: 0, currency: '', label: '' };
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_TRANS_ALLOWANC:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang, 'city:', city);
        return { value: 0, currency: '', label: '' };
    }
}
  
// Retrieve actual room prices for a hotel from P_GET_STRIP_HOTEL_ROOMS @hotelCode, @date
async function getHotelRoomsPricingFromDB(hotelCode, date = null) {
    try {
        const code = String(hotelCode || '').trim().replace(/'/g, "''");
        
        try {
            // Try with date parameter first
            // const rows = await prisma.$queryRawUnsafe(`
            //     SELECT * 
            //     FROM GetHotelRoomPrices(N'${code}') 
            //     WHERE PRICE_DATE = N'${date}'
            // `);
            //console.log(`EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}',N'${date}'`);
            const rows = await prisma.$queryRawUnsafe(`EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}',N'${date}'`);
            return rows;
        } catch (error) {
            // Fallback to without date parameter
            console.error('Error fetching hotel room prices with date:', error);
            return [];
        }
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_HOTEL_ROOMS:', error);
        console.error('Parameters used - hotelCode:', hotelCode, 'date:', date);
        return [];
    }
}

// Get supported room types for a specific hotel
async function getHotelRoomTypesFromDB(hotelCode) {
    try {
        const code = String(hotelCode || '').trim().replace(/'/g, "''");
        
        const rows = await prisma.$queryRawUnsafe(`
            SELECT DISTINCT ROOM_TYPE 
            FROM GetHotelRoomPrices(N'${code}')
            WHERE ROOM_TYPE IS NOT NULL AND ROOM_TYPE != ''
        `);
        
        // Return comma-separated room types (e.g., "S,D,T")
        const roomTypes = (rows || [])
            .map(r => String(r.ROOM_TYPE || '').trim())
            .filter(rt => rt !== '')
            .join(',');
            
        return roomTypes;
    } catch (error) {
        console.error('Error fetching hotel room types:', error);
        console.error('Parameters used - hotelCode:', hotelCode);
        return 'S,D,T'; // Default to all room types if query fails
    }
}

async function getPolicyDataFromDB(employeeId) {
    try {
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        const rows = await prisma.$queryRawUnsafe(`
            EXEC P_GET_STRIP_POLICY '${empCode}'
        `);
        
        if (rows && rows.length > 0) {
            const row = rows[0];
            
            // Save all columns in variables as specified
            return {
                // Max companions and hotels
                maxCompanions: Number(row.POLICY_STRIP_MAXCOMPAN) || 0,
                maxHotels: Number(row.POLICY_STRIP_MAXHOTELS) || 0,
                
                // Date range
                startDate: row.POLICY_STRIP_STARTDATE,
                endDate: row.POLICY_STRIP_ENDDATE,
                
                // Employee contribution percentage
                empContribution: Number(row.POLICY_STRIP_EMP_CONT) || 0,
                
                // All other policy columns
                allColumns: row
            };
        }
        return { 
            maxCompanions: 0, 
            maxHotels: 0, 
            startDate: null, 
            endDate: null, 
            empContribution: 0,
            allColumns: {} 
        };
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_POLICY:', error);
        console.error('Parameters used - employeeId:', employeeId);
        return { 
            maxCompanions: 0, 
            maxHotels: 0, 
            startDate: null, 
            endDate: null, 
            empContribution: 0,
            allColumns: {} 
        };
    }
}

// Load Employee Info - Execute P_GET_EMPLOYEE @lang, @empCode
async function getEmployeeInfoFromDB(employeeId, lang = 'ar') {
    try {
        const langBit = lang === 'en' ? 1 : 0;
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        
        const result = await prisma.$queryRawUnsafe(`
            EXEC P_GET_EMPLOYEE ${langBit}, '${empCode}'
        `);
        
        return result && result.length > 0 ? result[0] : {};
        
    } catch (error) {
        console.error('Error calling stored procedure P_GET_EMPLOYEE:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang);
        return {};
    }
}

// RQ-AZ-PR-31-10-2024.1: Review Trip and Calculate Cost
// Calls P_STRIP_SUBMIT_FAMILY, P_STRIP_SUBMIT_CLEAR_HOTEL, P_STRIP_SUBMIT_HOTEL (loop)
async function reviewTripAndCalculateCost(lang = 'ar', empCode, familyIds, hotels = []) {
    try {
        console.log("reviewTripAndCalculateCost: "+ lang + " " + empCode + " " + familyIds + " " + hotels);
        const langBit = lang === 'ar' ? 1 : 0;
        empCode = String(empCode).replace(/^:+/, '').trim();
        const esc = (s) => String(s || '').replace(/'/g, "''");
        
        // 1. Execute P_STRIP_SUBMIT_FAMILY
        // Handle empty familyIds - pass empty string if no companions selected
        const familyIdsParam = familyIds && familyIds.trim() !== '' ? familyIds : '';
        //console.log(`[reviewTripAndCalculateCost] Calling P_STRIP_SUBMIT_FAMILY with lang=${langBit}, empCode=${empCode}, familyIds=${familyIdsParam}`);
        
        let familySuccess = false;
        let familyErrorMsg = null;
        
        try {
            // The stored procedure returns result in a result set, not as RETURN value
            // Call it directly and check the result set
            const familyResult = await prisma.$queryRawUnsafe(`
                EXEC P_STRIP_SUBMIT_FAMILY ${langBit}, '${esc(empCode)}', '${esc(familyIdsParam)}';
            `);
            console.log('[reviewTripAndCalculateCost] P_STRIP_SUBMIT_FAMILY result:', JSON.stringify(familyResult));
            console.log(`
                EXEC P_STRIP_SUBMIT_FAMILY ${langBit}, '${esc(empCode)}', '${esc(familyIdsParam)}';
            `);
            console.log("familyResult: "+ JSON.stringify(familyResult));
            if (familyResult && familyResult.length > 0) {
                const firstRow = familyResult[0];
                // Check for Result column (common pattern)
                const resultValue = firstRow.Result || firstRow.RESULT || firstRow.result;
                const allValues = Object.values(firstRow);
                const firstValue = allValues.length > 0 ? allValues[0] : null;
                
                // Check if result is 1 (success) - could be number or string "1"
                if (resultValue !== undefined && resultValue !== null) {
                    const resultNum = Number(resultValue);
                    const resultStr = String(resultValue).trim();
                    if (resultNum === 1 || resultStr === '1') {
                        familySuccess = true;
                    } else if (resultStr !== '' && !isNaN(resultNum)) {
                        // It's a number but not 1 - might be an error code
                        familyErrorMsg = `Family submission failed with code: ${resultNum}`;
                    } else {
                        // Might be an error message
                        familyErrorMsg = String(resultValue);
                    }
                } else if (firstValue !== null && firstValue !== undefined) {
                    // Check first value if Result column doesn't exist
                    const firstValueNum = Number(firstValue);
                    const firstValueStr = String(firstValue).trim();
                    if (firstValueNum === 1 || firstValueStr === '1') {
                        familySuccess = true;
                    } else if (firstValueStr !== '' && !isNaN(firstValueNum)) {
                        familyErrorMsg = `Family submission failed with code: ${firstValueNum}`;
                    } else {
                        familyErrorMsg = String(firstValue);
                    }
                }
            }
            
        } catch (err) {
            console.error('[reviewTripAndCalculateCost] Error calling P_STRIP_SUBMIT_FAMILY:', err);
            return {
                success: false,
                message: err.message || 'Failed to call P_STRIP_SUBMIT_FAMILY stored procedure',
                hotels: []
            };
        }
        
        //console.log('[reviewTripAndCalculateCost] Family success:', familySuccess, 'Error message:', familyErrorMsg);
        
        // Check if result is 1 (success)
        if (!familySuccess) {
            // Use error message if available, otherwise generic error
            const errorMsg = familyErrorMsg || 'Failed to submit family members';
            console.error('[reviewTripAndCalculateCost] Family submission failed:', errorMsg);
            return {
                success: false,
                message: errorMsg,
                hotels: []
            };
        }
        
        //console.log('[reviewTripAndCalculateCost] Family submission successful');
        
        // 2. Execute P_STRIP_SUBMIT_CLEAR_HOTEL
        await prisma.$queryRawUnsafe(`EXEC P_STRIP_SUBMIT_CLEAR_HOTEL '${esc(empCode)}'`);
        
        // 3. Execute P_STRIP_SUBMIT_HOTEL for each hotel
        const hotelResults = [];
        if (Array.isArray(hotels) && hotels.length > 0) {
            for (const h of hotels) {
                if (!h || !h.hotelCode) {
                    continue;
                }
                
                try {
                    const hotelCodeEsc = esc(h.hotelCode);
                    // Convert date format from "01 NOV 2025" to "YYYY-MM-DD" for SQL Server
                    let dateFormatted = h.date;
                    try {
                        // Try to parse the date string if it's in a format like "01 NOV 2025"
                        const dateMatch = h.date.match(/(\d{1,2})\s+([A-Z]{3})\s+(\d{4})/i);
                        if (dateMatch) {
                            const [, day, month, year] = dateMatch;
                            const monthMap = {
                                'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
                                'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
                                'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
                            };
                            const monthNum = monthMap[month.toUpperCase()] || month;
                            dateFormatted = `${year}-${monthNum}-${day.padStart(2, '0')}`;
                            //console.log(`[reviewTripAndCalculateCost] Converted date from "${h.date}" to "${dateFormatted}"`);
                        }
                    } catch (dateParseErr) {
                        // If parsing fails, use the original date string
                        //console.log(`[reviewTripAndCalculateCost] Could not parse date "${h.date}", using as-is`);
                    }
                    const dateEsc = esc(dateFormatted);
                    const roomsDataEsc = esc(h.roomsData);
                    
                    //console.log(`[reviewTripAndCalculateCost] Calling P_STRIP_SUBMIT_HOTEL with lang=${langBit}, empCode=${empCode}, hotelCode=${hotelCodeEsc}, date=${dateEsc}, rooms=${roomsDataEsc}`);
                    
                    const hotelResult = await prisma.$queryRawUnsafe(`
                        DECLARE @Results TABLE (
                            TOTAL_COST INT,
                            EMP_COST FLOAT,
                            RESUT_MESSAGE NVARCHAR(500)
                        );
                        INSERT INTO @Results
                        EXEC P_STRIP_SUBMIT_HOTEL ${langBit}, '${esc(empCode)}', '${hotelCodeEsc}', '${dateEsc}', '${roomsDataEsc}';
                        SELECT TOTAL_COST, EMP_COST, RESUT_MESSAGE FROM @Results;
                    `);

                    console.log(`
                        DECLARE @Results TABLE (
                            TOTAL_COST INT,
                            EMP_COST FLOAT,
                            RESUT_MESSAGE NVARCHAR(500)
                        );
                        INSERT INTO @Results
                        EXEC P_STRIP_SUBMIT_HOTEL ${langBit}, '${esc(empCode)}', '${hotelCodeEsc}', '${dateEsc}', '${roomsDataEsc}';
                        SELECT TOTAL_COST, EMP_COST, RESUT_MESSAGE FROM @Results;
                    `);
                    
                    //console.log(`[reviewTripAndCalculateCost] P_STRIP_SUBMIT_HOTEL result for ${h.hotelCode}:`, hotelResult);
                    
                    if (hotelResult && hotelResult.length > 0) {
                        const result = hotelResult[0];
                        let resultMessage = (result.RESUT_MESSAGE || result.RESULT_MESSAGE || result.Result || '').toString();
                        // Clean up message - remove carriage returns, line feeds, and trim
                        resultMessage = resultMessage.replace(/\r\n/g, ' ').replace(/\r/g, ' ').replace(/\n/g, ' ').trim();
                        const totalCost = Number(result.TOTAL_COST) || 0;
                        const empCost = Number(result.EMP_COST) || 0;
                        
                        //console.log(`[reviewTripAndCalculateCost] Hotel ${h.hotelCode} - Result message: "${resultMessage}", TotalCost: ${totalCost}, EmpCost: ${empCost}`);
                        
                        // Check if result message indicates success
                        // According to spec: RESUT_MESSAGE = 1 means saved successfully
                        // The message should be exactly "1" or contain only "1" with whitespace
                        // If it contains other text (even garbled), it's likely an error message
                        const resultMsgTrimmed = resultMessage.trim();
                        
                        // Check for exact match first (most reliable)
                        const isExactOne = resultMsgTrimmed === '1' || 
                                          resultMsgTrimmed === '1.0' ||
                                          /^\s*1\s*$/.test(resultMsgTrimmed) ||
                                          (resultMsgTrimmed.length === 1 && resultMsgTrimmed === '1');
                        
                        // If not exact, check if message contains only "1" and whitespace/punctuation
                        // but NOT if it contains letters (even garbled ones suggest an error message)
                        const hasLetters = /[a-zA-Z\u0600-\u06FF]/.test(resultMsgTrimmed); // ASCII and Arabic letters
                        const numericOnly = resultMsgTrimmed.replace(/[^0-9]/g, '');
                        const isNumericOneOnly = !hasLetters && numericOnly === '1';
                        
                        const isSuccessMessage = isExactOne || isNumericOneOnly;
                        
                        //console.log(`[reviewTripAndCalculateCost] Hotel ${h.hotelCode} - Message analysis: trimmed="${resultMsgTrimmed}", numericOnly="${numericOnly}", isSuccessMessage=${isSuccessMessage}`);
                        
                        // If message is "1" OR costs are > 0, consider it success
                        if (isSuccessMessage || totalCost > 0) {
                            hotelResults.push({
                                hotelCode: h.hotelCode,
                                hotelName: h.hotelName || '',
                                date: h.date,
                                totalCost: totalCost,
                                empCost: empCost,
                                success: true
                            });
                            //console.log(`[reviewTripAndCalculateCost] Hotel ${h.hotelCode} - Success! TotalCost: ${totalCost}, EmpCost: ${empCost}`);
                        } else {
                            // Message is not "1" and costs are 0 - this is an error
                            const errorMsg = resultMessage || `Failed to submit hotel ${h.hotelCode}`;
                            console.error(`[reviewTripAndCalculateCost] Hotel submission failed: ${errorMsg}`);
                            return {
                                success: false,
                                message: errorMsg,
                                hotels: []
                            };
                        }
                    } else {
                        console.error(`[reviewTripAndCalculateCost] No result returned for hotel ${h.hotelCode}`);
                        return {
                            success: false,
                            message: `No result returned for hotel ${h.hotelCode}`,
                            hotels: []
                        };
                    }
                } catch (innerErr) {
                    console.error(`Error submitting hotel ${h.hotelCode}:`, innerErr);
                    return {
                        success: false,
                        message: innerErr.message || `Failed to submit hotel ${h.hotelCode}`,
                        hotels: []
                    };
                }
            }
        }
        
        return {
            success: true,
            message: 'Trip reviewed and costs calculated successfully',
            hotels: hotelResults
        };
        
    } catch (error) {
        console.error('Error in reviewTripAndCalculateCost:', error);
        return {
            success: false,
            message: error.message || 'Failed to review trip and calculate costs',
            hotels: []
        };
    }
}

// RQ-AZ-PR-31-10-2024.1: Check Trip Submission
// Calls P_STRIP_SUBMIT
async function checkTripSubmission(lang = 'ar', empCode) {
    try {
        console.log("checkTripSubmission: "+ lang + " " + empCode);
        const langBit = lang === 'ar' ? 1 : 0;
        empCode = String(empCode).replace(/^:+/, '').trim();
        const esc = (s) => String(s || '').replace(/'/g, "''");
        
        //console.log(`[checkTripSubmission] Calling P_STRIP_SUBMIT with lang=${langBit}, empCode=${empCode}`);
        
        // Call the stored procedure directly and check the result set
        // Similar to how P_STRIP_SUBMIT_FAMILY works
        const result = await prisma.$queryRawUnsafe(`
            EXEC P_STRIP_SUBMIT ${langBit}, '${esc(empCode)}';
        `);
        console.log("checkTripSubmission: "+ `
            EXEC P_STRIP_SUBMIT ${langBit}, '${esc(empCode)}';
        `);
        
        //console.log('[checkTripSubmission] P_STRIP_SUBMIT result:', JSON.stringify(result));
        
        let success = false;
        let message = '';
        
        if (result && result.length > 0) {
            const firstRow = result[0];
            // Check for Result column (common pattern)
            const resultValue = firstRow.Result || firstRow.RESULT || firstRow.result;
            const allValues = Object.values(firstRow);
            const firstValue = allValues.length > 0 ? allValues[0] : null;
            
            // Check if result is 1 (success) - could be number or string "1"
            if (resultValue !== undefined && resultValue !== null) {
                const resultNum = Number(resultValue);
                const resultStr = String(resultValue).trim();
                if (resultNum === 1 || resultStr === '1') {
                    success = true;
                } else if (resultStr !== '' && !isNaN(resultNum)) {
                    // It's a number but not 1 - might be an error code
                    message = `Trip submission failed with code: ${resultNum}`;
                } else {
                    // Might be an error message
                    message = String(resultValue);
                }
            } else if (firstValue !== null && firstValue !== undefined) {
                // Check first value if Result column doesn't exist
                const firstValueNum = Number(firstValue);
                const firstValueStr = String(firstValue).trim();
                if (firstValueNum === 1 || firstValueStr === '1') {
                    success = true;
                } else if (firstValueStr !== '' && !isNaN(firstValueNum)) {
                    message = `Trip submission failed with code: ${firstValueNum}`;
                } else {
                    message = String(firstValue);
                }
            }
        }
        
        //console.log('[checkTripSubmission] Success:', success, 'Message:', message);
        
        return {
            success: success,
        };
        
    } catch (error) {
        console.error('[checkTripSubmission] Error calling P_STRIP_SUBMIT:', error);
        
        // Check if the error is about the procedure not existing
        if (error.message && error.message.includes('Could not find stored procedure')) {
            return {
                success: false,
                message: 'Stored procedure P_STRIP_SUBMIT not found in database. Please ensure it is created.'
            };
        }
        
        return {
            success: false,
            message: error.message || 'Failed to check trip submission'
        };
    }
}

async function submitTripApplication(employeeId, familyIds, hotels=[]) {
    let results = [];
    if (employeeId  && hotels && hotels.length > 0  )
    {
                try {
                    // await prisma.$executeRawUnsafe(
                    // `DELETE FROM PRMS_STRIP WHERE STRIP_EmpNo = ${employeeId}`
                    // );
                    await prisma.$queryRawUnsafe(`EXEC P_STRIP_SUBMIT_CLEAR_HOTEL ${employeeId}`);
                
                    await prisma.$queryRawUnsafe(`
                        EXEC P_STRIP_SUBMIT_FAMILY ${employeeId},'${familyIds}'
                    `);                    
                        
                    // Submit each hotel provided in the hotels array. Escape single quotes to avoid SQL errors.
                    const esc = (s) => String(s || '').replace(/'/g, "''");
                    if (Array.isArray(hotels) && hotels.length > 0) {
                        for (let i = 0; i < hotels.length; i++) {
                            const h = hotels[i];
                            try {
                                if (!h || !h.hotelCode) {
                                    continue;
                                }
                                const hotelCodeEsc = esc(h.hotelCode);
                                const dateEsc = esc(h.date);
                                const roomsDataEsc = esc(h.roomsData);
                                await prisma.$queryRawUnsafe(`
                                    EXEC P_STRIP_SUBMIT_HOTEL  ${employeeId}, '${hotelCodeEsc}', '${dateEsc}', '${roomsDataEsc}'
                                `);
                            } catch (innerErr) {
                                console.error(`Error submitting hotel at index ${i}:`, innerErr && innerErr.message ? innerErr.message : innerErr);
                                // Continue with next hotel instead of failing the whole submission
                                continue;
                            }
                        }
                    } else {
                        //console.log('No hotels to submit');
                    }
                    await prisma.$queryRawUnsafe(`
                        EXEC P_STRIP_SUBMIT  ${employeeId}
                    `);
                    
                        //console.log('Trip application submitted successfully for employeeId:', employeeId);
                    return {
                        success: true,
                        message: 'Messagge from submitTripApplication',
                    };
        
                } catch (error) {
                    console.error('Error in P_STRIP_SUBMIT_FAMILY:', error);
                    return {
                        success: false,
                        message: 'Failed to submit family members',
                        error: error.message,
                        results
                    };
                }

    }   
}

async function getSecretKeyValues(secret) {
    try {
        // First get the value from the temp table
        const secretResult = await prisma.$queryRawUnsafe(`
            SELECT [value] FROM tempdb..##SecretKeyValue WHERE [key] = N'${String(secret).replace(/'/g, "''")}';
        `);
            //console.log('Secret key query result:', secretResult[0]);
        if (!secretResult || secretResult.length === 0 || !secretResult[0].value) {
            //console.error('No value found for secret key:', secret);
            return null;
        }

        // Now pass this value to P_GET_EMPLOYEE_CODE_BY_ID
        const employeeResult = await prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                EMPLOYEE_CODE NVARCHAR(50),
                EMPLOYEE_NAME NVARCHAR(50)
            );
            
            INSERT INTO @Results
            EXEC P_GET_EMPLOYEE_CODE_BY_ID 1, ${secretResult[0].value};
            
            SELECT EMPLOYEE_CODE FROM @Results;
        `);
        //     console.log(`
        //     DECLARE @Results TABLE (
        //         EMPLOYEE_CODE NVARCHAR(50),
        //         EMPLOYEE_NAME NVARCHAR(50)
        //     );
            
        //     INSERT INTO @Results
        //     EXEC P_GET_EMPLOYEE_CODE_BY_ID 1, ${secretResult[0].value};
            
        //     SELECT EMPLOYEE_CODE FROM @Results;
        // `);
        //     console.log('Employee code query result:', employeeResult[0]);
        if (!employeeResult || employeeResult.length === 0) {
            console.error('No employee code found for value:', secretResult[0].value);
            return null;
        }
        
        //console.log('Secret key query result Employee:', employeeResult[0].EMPLOYEE_CODE);
        
        // Clean up: delete the secret key entry after use after a short delay. If it is deleted immediately, 
        // the calling code may not have time to read it.
        setTimeout(async() => {
  
        const deleteResult = await prisma.$queryRawUnsafe(`
            DELETE FROM tempdb..##SecretKeyValue WHERE [key] = N'${String(secret).replace(/'/g, "''")}';
        `);

}, 700);
        return employeeResult[0].EMPLOYEE_CODE;
    } catch (error) {
        console.error('Error in getSecretKeyValues:', error);
        return null;
    }
}

// Get the last saved companions data via stored proc P_GET_STRIP_GET_LAST_EMP_FAMILY
async function getLastCompanionsFromDB(lang = 'ar', empCode) {
    try {
        // BUG-AZ-PR-29-10-2025.1: Align bit mapping with companions proc (1 = Arabic, 0 = English)
        const langBit = lang === 'ar' ? 1 : 0;
        empCode = String(empCode).replace(/^:+/, '').trim();
        
        const result = await prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                EMPFAMILY_RelativeID VARCHAR(150),
                EMPFAMILY_RELTYPE VARCHAR(20),
                EMPFAMILY_NAME VARCHAR(300)
            );
            INSERT INTO @Results
            EXEC P_GET_STRIP_GET_LAST_EMP_FAMILY ${langBit}, '${empCode}';
            SELECT 
                EMPFAMILY_RelativeID AS RELID, 
                EMPFAMILY_NAME AS name, 
                EMPFAMILY_RELTYPE AS rel 
            FROM @Results;
        `);
        return result;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_GET_LAST_EMP_FAMILY:', error);
        console.error('Parameters used - empCode:', empCode, 'lang:', lang);
        return '';
    }
}

// Get the last saved hotels data via stored proc P_GET_STRIP_GET_LAST_HOTELS
async function getLastHotelsFromDB(lang = 'ar', empCode) {
    try {
        // Convert lang to bit: 'ar' = 1, anything else = 0
        const langBit = lang === 'ar' ? 1 : 0;
        empCode = String(empCode).replace(/^:+/, '').trim();
        // Call stored procedure and return result table
        // Procedure returns: CITY_CODE, CITY_NAME, HOTEL_CODE, HOTEL_NAME, REQ_DATE, 
        // SELECTED_ROOMS, HOTEL_BEDS_COUNTS, HOTEL_EXTRA_BEDS_COUNTS, HOTEL_PIC, TOTAL_COST, EMP_COST
        const result = await prisma.$queryRawUnsafe(`
            DECLARE @Results TABLE (
                CITY_CODE VARCHAR(50),
                CITY_NAME VARCHAR(100),
                HOTEL_CODE VARCHAR(50),
                HOTEL_NAME VARCHAR(100),
                REQ_DATE DATETIME,
                SELECTED_ROOMS VARCHAR(200),
                HOTEL_BEDS_COUNTS VARCHAR(100),
                HOTEL_EXTRA_BEDS_COUNTS VARCHAR(100),
                HOTEL_PIC VARCHAR(300),
                TOTAL_COST INT,
                EMP_COST FLOAT
            );
            INSERT INTO @Results
            EXEC P_GET_STRIP_GET_LAST_HOTELS ${langBit}, '${empCode}';
            SELECT
                CITY_CODE,
                CITY_NAME,
                HOTEL_CODE,
                HOTEL_NAME,
                CONVERT(varchar(10), REQ_DATE, 120) AS REQ_DATE,
                SELECTED_ROOMS,
                HOTEL_BEDS_COUNTS,
                HOTEL_EXTRA_BEDS_COUNTS,
                HOTEL_PIC,
                TOTAL_COST,
                EMP_COST
            FROM @Results;`);
        return result;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_GET_LAST_HOTELS:', error);
        console.error('Parameters used - empCode:', empCode, 'lang:', lang);
        return '';
    }
}

async function deleteLastSubmissionFromDB(employeeId) {
    try {
        const esc = (s) => String(s || '').replace(/'/g, "''").trim();
        // Clean and escape employeeId like other functions do
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        const empCodeEsc = esc(empCode);
        
        console.log(`[deleteLastSubmissionFromDB] Attempting to delete records for empCode: ${empCode}`);
        
        // Use $executeRawUnsafe for DELETE - it returns the number of affected rows
        const affectedRows = await prisma.$executeRawUnsafe(`
            DELETE FROM PRMS_STRIP WHERE STRIP_EmpNo = '${empCodeEsc}'
        `);
        
        console.log(`[deleteLastSubmissionFromDB] Deleted ${affectedRows} row(s) for empCode: ${empCode}`);
        
        // Return true if any rows were deleted
        return affectedRows > 0;
    } catch (error) {
        console.error('[deleteLastSubmissionFromDB] Error deleting submission:', error);
        console.error('Parameters used - employeeId:', employeeId);
        return false;
    }
}

module.exports = {
    getCompanionsfromDB,
    getTransportAllowancefromDB,
    getEmployeeNamefromDB,
    getEmployeeInfoFromDB,
    getPolicyDataFromDB,
    getHotelsByCityFromDB,
    getCitiesFromDB,
    getHotelRoomsPricingFromDB,
    getHotelRoomTypesFromDB,
    submitTripApplication,
    getHotelsFromDB,
    getSecretKeyValues,
    getLastCompanionsFromDB,
    getLastHotelsFromDB,
    reviewTripAndCalculateCost,
    checkTripSubmission,
    deleteLastSubmissionFromDB
};