require('dotenv').config();
const prisma = require('../lib/prisma');

async function getHotelsByCityFromDB(lang = 'ar', city = 'ALEX') {
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

            SELECT HOTEL_CODE, HOTEL_NAME, HOTEL_ROOM_TYPES,HOTEL_EXTRA_BEDS_COUNTS FROM @Results;
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
            
            return { 
                id, 
                ar: arName, 
                en: enName,
                supportedRoomTypes, // Add supported room types
                supportedRoomExtraBeds
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
        console.log(`[getHotelsFromDB] lang=${lang}, langBit=${langBit}`);
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
        console.log(`[getHotelsFromDB] Sample row:`, rows[0]);
        
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
        console.log(`[getHotelsFromDB] City keys:`, Object.keys(hotelsByCity).slice(0, 3));
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
        console.log(`[getCitiesFromDB] lang=${lang}, langBit=${langBit}`);
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
        console.log(`[getCitiesFromDB] First 3 cities:`, result.slice(0, 3));
        return result;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_CITIES:', error);
        console.error('Parameters used - lang:', lang);
        return [];
    }
}

async function getCompanionsfromDB(employeeId, lang = 'en') {
    try {
        // Convert lang to bit: 'en' = 1, others = 0
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
        console.log(`
            DECLARE @Results TABLE (
                EMPFAMILY_RelativeID VARCHAR(50),
                EMPFAMILY_RELTYPE VARCHAR(10),
                EMPFAMILY_NAME VARCHAR(100)
            )
            
            INSERT INTO @Results
            EXEC P_GET_STRIP_EMP_FAMILY ${langBit}, '${empCode}'
            
            SELECT EMPFAMILY_RelativeID AS RELID ,EMPFAMILY_RELTYPE AS rel,EMPFAMILY_NAME AS name FROM @Results
        `);
        
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
        
        const langBit = lang === 'ar' ? 1 : 0;
        
        //console.log('📊 Using langBit:', langBit, 'for language:', lang);
        
        const empCode = String(employeeId).replace(/^:+/, '').trim();

        //console.log('🔍 Calling stored procedure with:', { langBit, empCode });

        const rows = await prisma.$queryRawUnsafe(`
            EXEC P_GET_EMPLOYEE ${langBit}, '${empCode}'
        `);

        //console.log('📥 Stored procedure result:', rows);

        if (rows && rows.length > 0) {
            const row = rows[0] || {};
            const procName = row.EMPLOYEE_TNAME || row.EMPLOYEE_NAME || '';
            
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
            console.log(`EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}',N'${date}'`);
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

async function submitTripApplication(employeeId, familyIds, hotels=[]) {
    let results = [];
    if (employeeId  && hotels && hotels.length > 0  )
    {
                try {
                    await prisma.$executeRawUnsafe(
                    `DELETE FROM PRMS_STRIP WHERE STRIP_EmpNo = ${employeeId}`
                    );
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
                    
                        console.log('Trip application submitted successfully for employeeId:', employeeId);
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
            console.log('Secret key query result:', secretResult[0]);
        if (!secretResult || secretResult.length === 0 || !secretResult[0].value) {
            console.error('No value found for secret key:', secret);
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
            console.log(`
            DECLARE @Results TABLE (
                EMPLOYEE_CODE NVARCHAR(50),
                EMPLOYEE_NAME NVARCHAR(50)
            );
            
            INSERT INTO @Results
            EXEC P_GET_EMPLOYEE_CODE_BY_ID 1, ${secretResult[0].value};
            
            SELECT EMPLOYEE_CODE FROM @Results;
        `);
            console.log('Employee code query result:', employeeResult[0]);
        if (!employeeResult || employeeResult.length === 0) {
            console.error('No employee code found for value:', secretResult[0].value);
            return null;
        }
        
        console.log('Secret key query result Employee:', employeeResult[0].EMPLOYEE_CODE);
        return employeeResult[0].EMPLOYEE_CODE;
    } catch (error) {
        console.error('Error in getSecretKeyValues:', error);
        return null;
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
    getSecretKeyValues
};