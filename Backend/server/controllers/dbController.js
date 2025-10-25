const { COMPANIONS } = require('../data/companions');
require('dotenv').config();
const prisma = require('../lib/prisma');
const { ROOM_PRICES } = require('../data/roomPrices');



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
                try { //console.log('City resolution:', { input: cityInput, resolvedCode: cityCode }); 
                } catch (_) {}
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
        try { //console.log('Hotels fetched for city', cityCode, 'count:', mapped.length, mapped.map(h => h.ar)); 

        } catch (_) {}
        return mapped;
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_HOTEL:', error);
        console.error('Parameters used - city:', city, 'lang:', lang);
        return [];
    }
}

async function getHotelsFromDB(lang = 'ar') {
    try {
        // prefer Arabic names unless lang === 'en'
        const rows = await prisma.$queryRawUnsafe(`
            SELECT
                h.Hotel_Code AS HOTEL_CODE,
                h.Hotel_Name AS HOTEL_EN_NAME,
                h.Hotel_TName AS HOTEL_AR_NAME,
                COALESCE(NULLIF(c.CITIES_TNAME, ''), NULLIF(c.CITIES_NAME, ''), h.Hotel_City) AS CITY_NAME
            FROM PRMS_HOTEL h
            LEFT JOIN CMN_CITIES c ON c.CITIES_CODE = h.Hotel_City
            WHERE ISNULL(h.Hotel_Active, 'Y') = 'Y'
        `);
            //console.log('getHotelsFromDB: fetched', (rows || []).length, 'hotels from database');
            //console.log('getHotelsFromDB: fetched', (rows ));
        const hotelsByCity = {};
        (rows || []).forEach(r => {
            //console.log(r);
            const code = String(r.HOTEL_CODE || '').trim();
            if (!code) return;
            const en = String(r.HOTEL_EN_NAME || '') .trim();
            const ar = String(r.HOTEL_AR_NAME || r.HOTEL_EN_NAME || '') .trim();
            const cityRaw = String(r.CITY_NAME || 'Unknown').trim();
            const cityKey = cityRaw || 'غير محدد';

            if (!hotelsByCity[cityKey]) hotelsByCity[cityKey] = [];
            hotelsByCity[cityKey].push({ id: code, en, ar });
        });
        //console.log('getHotelsFromDB: organized hotels by city:', hotelsByCity);
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
            
            SELECT EMPFAMILY_RelativeID AS RELID ,EMPFAMILY_RELTYPE AS rel,EMPFAMILY_NAME AS name FROM @Results
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
            return { value: 0, currency: '', label: label || 'لا يوجد' };
        }

        return { value: 0, currency: '', label: 'لا يوجد' };
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_TRANS_ALLOWANC:', error);
        console.error('Parameters used - employeeId:', employeeId, 'lang:', lang, 'city:', city);
        return { value: 0, currency: '', label: 'لا يوجد' };
    }
}
  
// Retrieve actual room prices for a hotel from P_GET_STRIP_HOTEL_ROOMS @hotelCode, @date
async function getHotelRoomsPricingFromDB(hotelCode, date = null) {
//       const result = ROOM_PRICES[hotelCode].filter(item => item.PRICE_DATE === date);
//   console.log(result);
//   return result;
console.log(1);

    try {
        const code = String(hotelCode || '').trim().replace(/'/g, "''");
        
        // Try with date parameter first, then without if it fails
        let rows;
        const dateParam = date ? `, N'${date}'` : `, N'${new Date().toISOString().slice(0, 10)}'`;
        
        //console.log(`Calling P_GET_STRIP_HOTEL_ROOMS with hotelCode: ${code}, date: ${date || 'today'}`);
        
        try {
            // Try with date parameter first
            //console.log(`EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}'${dateParam}`);
            //rows = await prisma.$queryRawUnsafe(`EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}'`);
            rows = await prisma.$queryRawUnsafe(`SELECT * FROM GetHotelRoomPrices(N'${code}') where PRICE_DATE =N'${date}'`);
            //console.log(`P_GET_STRIP_HOTEL_ROOMS ${code}`);
             //console.log(`P_GET_STRIP_HOTEL_ROOMS with date result:`, rows);
             
//              const filteredRows = rows.filter(item => 
//   item.PRICE_DATE instanceof Date && 
//   item.PRICE_DATE.toISOString().slice(0, 10) === date
// );
    //console.log(`P_GET_STRIP_HOTEL_ROOMS with date filteredRows:`, filteredRows);
             
             //const result = filteredRows
             const result = rows
//   .map(item => {
//     if (item.ROOM_TYPE === 'FR') return { ...item, ROOM_TYPE: 'F' };
//     if (item.ROOM_TYPE === 'FS') return { ...item, ROOM_TYPE: 'J' };
//     return item;
//   })
  //.filter(item => item.ROOM_TYPE !== 'J' || item.ROOM_PRICE === 3500); // keep only the one converted from FS
            console.log(`P_GET_STRIP_HOTEL_ROOMS with date result:`, result);
             return result;
        } catch (error) {
            //console.log(`P_GET_STRIP_HOTEL_ROOMS with date failed, trying without date:`, error.message);
            // Fallback to without date parameter
          
            //console.log(error.message);
            return [];
        }
        

} catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_HOTEL_ROOMS:', error);
        console.error('Parameters used - hotelCode:', hotelCode, 'date:', date);
        return [];
    }
}
// function buildRoomPrices(date, prices) {
//   // Map between input keys and ROOM_TYPE codes
//   const typeMap = {
//     single: "S",
//     double: "D",
//     trible: "T",
//     family_room: "F",
//     joiner_suite: "J"
//   };

//   // Create the array result
//   const result = Object.entries(typeMap)
//     .filter(([key]) => prices[key] !== undefined) // include only existing keys
//     .map(([key, code]) => ({
//       ROOM_TYPE: code,
//       PRICE_DATE: date,
//       ROOM_PRICE: prices[key],
//       EXTRA_BED_PRICE: prices.extra_bed_price
//     }));

//   return result;
// }
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

/*
    function to call the database with fixed data
EXEC P_STRIP_SUBMIT_FAMILY '100005','100005-210|100005-209|100005-208'
EXEC P_STRIP_SUBMIT_HOTEL  '100005', 'EG-ALX-001', '15 NOV 2025', 'D,2,0|S,1,0|J,1,0'
EXEC P_STRIP_SUBMIT_HOTEL  '100005', 'EG-HUR-002', '16 NOV 2025', 'S,2,2'
EXEC P_STRIP_SUBMIT_HOTEL  '100005', 'EG-ALX-003', '17 NOV 2025', 'S,3,1'

EXEC P_STRIP_SUBMIT  '100005'

*/
async function submitTripApplication(employeeId, familyIds, hotels=[]) {
    //console.log('submitTripApplication called with:', { employeeId, familyIds, hotels });
    if (employeeId && familyIds && hotels && hotels.length > 0  )
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
                                    //console.log(`Skipping invalid hotel at index ${i}`);
                                    continue;
                                }
                                const hotelCodeEsc = esc(h.hotelCode);
                                const dateEsc = esc(h.date);
                                const roomsDataEsc = esc(h.roomsData);
                                //console.log(`Submitting hotel ${i + 1}:`, hotelCodeEsc, dateEsc, roomsDataEsc);
                                await prisma.$queryRawUnsafe(`
                                    EXEC P_STRIP_SUBMIT_HOTEL  ${employeeId}, '${hotelCodeEsc}', '${dateEsc}', '${roomsDataEsc}'
                                `);
                                //console.log(`Submitted hotel index ${i}`);
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

                return {
            success: false,
            message: 'No parameters provided to submitTripApplication'
        };
    }   
}

 async function submitTripApplicationV2(employeeId, familyIds, hotels = []) {
    try {
        const empCode = String(employeeId).replace(/^:+/, '').trim();
        const esc = (s) => String(s || '').replace(/'/g, "''");
        
        const results = {
            family: null,
            hotels: [],
            final: null
        };
        
        // Step 1: Submit family members
        if (familyIds) {
            try {
                const familyIdsStr = String(familyIds).trim();
                //console.log(`Calling P_STRIP_SUBMIT_FAMILY with empCode: ${empCode}, familyIds: ${familyIdsStr}`);
                
                await prisma.$queryRawUnsafe(`
                    EXEC P_STRIP_SUBMIT_FAMILY '${esc(empCode)}', '${esc(familyIdsStr)}'
                `);
                
                results.family = { success: true, message: 'Family members submitted successfully' };
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
        
        // Step 2: Submit all hotels
        for (const hotel of hotels) {
            try {
                const hotelCode = String(hotel.hotelCode || '').trim();
                const date = String(hotel.date || '').trim();
                const roomsData = String(hotel.roomsData || '').trim();
                
                //console.log(`Calling P_STRIP_SUBMIT_HOTEL with empCode: ${empCode}, hotel: ${hotelCode}, date: ${date}, rooms: ${roomsData}`);
                
                await prisma.$queryRawUnsafe(`
                    EXEC P_STRIP_SUBMIT_HOTEL '${esc(empCode)}', '${esc(hotelCode)}', '${esc(date)}', '${esc(roomsData)}'
                `);
                
                results.hotels.push({ 
                    success: true, 
                    hotelCode,
                    message: 'Hotel booking submitted successfully' 
                });
            } catch (error) {
                console.error('Error in P_STRIP_SUBMIT_HOTEL:', error);
                return {
                    success: false,
                    message: `Failed to submit hotel: ${hotel.hotelCode}`,
                    error: error.message,
                    results
                };
            }
        }
        
        // Step 3: Final submit
        try {
            //console.log(`Calling P_STRIP_SUBMIT with empCode: ${empCode}`);
            
            await prisma.$queryRawUnsafe(`
                EXEC P_STRIP_SUBMIT '${esc(empCode)}'
            `);
            
            results.final = { success: true, message: 'Trip application submitted successfully' };
        } catch (error) {
            console.error('Error in P_STRIP_SUBMIT:', error);
            return {
                success: false,
                message: 'Failed to complete final submission',
                error: error.message,
                results
            };
        }
        
        return {
            success: true,
            message: 'Complete trip application submitted successfully',
            results
        };
        
    } catch (error) {
        console.error('Error in submitTripApplication:', error);
        return {
            success: false,
            message: error.message || 'Failed to submit trip application',
            error: error
        };
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
    submitTripApplication,
    getHotelsFromDB
};