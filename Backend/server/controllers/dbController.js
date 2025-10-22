const { COMPANIONS } = require('../data/companions');
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

    try {
        const code = String(hotelCode || '').trim().replace(/'/g, "''");
        
        // Try with date parameter first, then without if it fails
        let rows;
        const dateParam = date ? `, N'${date}'` : `, N'${new Date().toISOString().slice(0, 10)}'`;
        
        //console.log(`Calling P_GET_STRIP_HOTEL_ROOMS with hotelCode: ${code}, date: ${date || 'today'}`);
        
        try {
            // Try with date parameter first
            //console.log(`EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}'${dateParam}`);
            rows = await prisma.$queryRawUnsafe(`
                EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}
            `);
            //console.log(`P_GET_STRIP_HOTEL_ROOMS with date result:`, rows);
        } catch (error) {
            //console.log(`P_GET_STRIP_HOTEL_ROOMS with date failed, trying without date:`, error.message);
            // Fallback to without date parameter
            rows = await prisma.$queryRawUnsafe(`
                EXEC P_GET_STRIP_HOTEL_ROOMS N'${code}'
            `);
            //console.log(`P_GET_STRIP_HOTEL_ROOMS without date result:`, rows);
        }
        

        // Normalize into a keyed map by room key (lowercase), with value number
        const pricing = {};
        const mapAbbrevKey = (k) => {
            const n = String(k || '').toLowerCase().trim();
            if (n === 's') return 'single';
            if (n === 'd') return 'double';
            if (n === 't') return 'trible';
            if (n === 'fr') return 'family_room';
            if (n === 'fs') return 'family_suite';
            if (n === 'j') return 'joiner_suite';
            return '';
        };
        const guessKeyFromName = (name) => {
            const n = String(name || '').toLowerCase();
            // Arabic keywords
            if (/[\u0621-\u064A]/.test(n)) {
                if (n.includes('مفرد') || n.includes('فردي')) return 'single';
                if (n.includes('مزدوج') || n.includes('مزدوجه') || n.includes('دابل')) return 'double';
                if (n.includes('ثلاث') || n.includes('ترابل') || n.includes('ثلاثي')) return 'trible';
                if (n.includes('عائلي') && n.includes('سويت')) return 'family_suite';
                if (n.includes('عائلي')) return 'family_room';
                if (n.includes('سويت') || n.includes('جناح')) return 'joiner_suite';
            } else {
                // English keywords
                if (n.includes('single')) return 'single';
                if (n.includes('double') || n.includes('twin')) return 'double';
                if (n.includes('triple') || n.includes('trbl') || n.includes('trible')) return 'trible';
                if (n.includes('family') && n.includes('suite')) return 'family_suite';
                if (n.includes('family')) return 'family_room';
                if (n.includes('suite')) return 'joiner_suite';
            }
            return n.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
        };

        if (rows && rows.length > 0) {
            // Map room type abbreviations to our standard keys
            const roomTypeMapping = {
                'S': 'single',
                'D': 'double', 
                'T': 'trible',
                'FR': 'family_room',
                'FS': 'family_suite',
                'J': 'joiner_suite'
            };
            
            // Check if we have the multi-row format (ROOM_TYPE, PRICE_DATE, ROOM_PRICE, EXTRA_BED_PRICE)
            const hasMultiRowFormat = rows.some(row => 
                row.ROOM_TYPE && row.PRICE_DATE && row.ROOM_PRICE !== undefined
            );
            
            if (hasMultiRowFormat) {
                //console.log('Detected multi-row format with ROOM_TYPE, PRICE_DATE, ROOM_PRICE');
                
                // Filter rows for the requested date (or use first available date if no date specified)
                const targetDate = date || new Date().toISOString().slice(0, 10);
                const dateFilteredRows = rows.filter(row => 
                    row.PRICE_DATE && row.PRICE_DATE.toString().startsWith(targetDate)
                );
                
                // If no rows for target date, use the first available date
                const rowsToUse = dateFilteredRows.length > 0 ? dateFilteredRows : rows;
                const actualDate = rowsToUse[0]?.PRICE_DATE;
                
                //console.log(`Using ${rowsToUse.length} rows for date: ${actualDate}`);
                
                // Extract prices for each room type
                rowsToUse.forEach(row => {
                    const roomType = row.ROOM_TYPE;
                    const roomPrice = Number(row.ROOM_PRICE);
                    const extraBedPrice = Number(row.EXTRA_BED_PRICE);
                    
                    if (roomType && !Number.isNaN(roomPrice) && roomPrice > 0) {
                        const mappedType = roomTypeMapping[roomType];
                        if (mappedType) {
                            pricing[mappedType] = roomPrice;
                            //console.log(`Mapped ${roomType} -> ${mappedType}: ${roomPrice}`);
                        }
                    }
                    
                    // Set extra bed price (should be same for all room types)
                    if (!Number.isNaN(extraBedPrice) && extraBedPrice > 0) {
                        pricing.extra_bed_price = extraBedPrice;
                    }
                });
                
                //console.log('Final pricing object:', pricing);
            } else {
                // Fallback to single row format (original logic)
                const first = rows[0];
                let mappedAny = false;
                
                // First, look for specific room type prices
                for (const [k, v] of Object.entries(first || {})) {
                    const num = Number(v);
                    // Look for realistic prices (not epoch timestamps)
                    if (!Number.isNaN(num) && num > 0 && num < 100000) {
                        // Check if it's a known room type abbreviation
                        if (roomTypeMapping[k]) {
                            pricing[roomTypeMapping[k]] = num;
                            mappedAny = true;
                        } else {
                            // Try other mapping methods
                            const mapped = mapAbbrevKey(k) || guessKeyFromName(k);
                            if (mapped) {
                                pricing[mapped] = num;
                                mappedAny = true;
                            }
                        }
                    }
                }
            }
        }

        // Case 2: Multiple rows with name+price columns (fallback for other formats)
        if (Object.keys(pricing).length === 0) {
            (rows || []).forEach(r => {
                const entries = Object.entries(r || {});
                // Identify a reasonable price among numeric fields
                let priceVal = 0;
                for (const [, v] of entries) {
                    const num = Number(v);
                    if (!Number.isNaN(num) && num > 0 && num < 100000) { priceVal = num; break; }
                }
                // Determine key from known name fields or from any string field
                const nameCandidate = r.ROOM_KEY || r.ROOMTYPE || r.ROOM_TYPE || r.TYPE || r.NAME || (() => {
                    for (const [kk, vv] of entries) {
                        if (typeof vv === 'string' && vv.trim()) return kk;
                    }
                    return '';
                })();
                const key = mapAbbrevKey(nameCandidate) || guessKeyFromName(nameCandidate);
                if (key && priceVal) pricing[key] = priceVal;
            });
        }

        // Also look for extra_bed_price in the results
        const allRows = Array.isArray(rows) ? rows : [rows];
        for (const row of allRows) {
            if (row && typeof row === 'object') {
                for (const [k, v] of Object.entries(row)) {
                    const keyLower = String(k).toLowerCase();
                    if (keyLower.includes('extra') && keyLower.includes('bed')) {
                        const num = Number(v);
                        if (!Number.isNaN(num) && num > 0 && num < 100000) {
                            pricing.extra_bed_price = num;
                            break;
                        }
                    }
                }
            }
        }

        //console.log('P_GET_STRIP_HOTEL_ROOMS rows for', code, rows);
        console.log('Normalized pricing map for', code, pricing);

        updatedPriceing=buildRoomPrices(date,pricing);
        console.log('Updated pricing array for', code, updatedPriceing);
        return updatedPriceing; // e.g., { single: 1200, double: 1700, trible: 2000 }
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_HOTEL_ROOMS:', error);
        console.error('Parameters used - hotelCode:', hotelCode);
        return {};
    }
}

function buildRoomPrices(date, prices) {
  // Map between input keys and ROOM_TYPE codes
  const typeMap = {
    single: "S",
    double: "D",
    trible: "T",
    family_room: "F",
    joiner_suite: "J"
  };

  // Create the array result
  const result = Object.entries(typeMap)
    .filter(([key]) => prices[key] !== undefined) // include only existing keys
    .map(([key, code]) => ({
      ROOM_TYPE: code,
      PRICE_DATE: date,
      ROOM_PRICE: prices[key],
      EXTRA_BED_PRICE: prices.extra_bed_price
    }));

  return result;
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

module.exports = {
    getCompanionsfromDB,
    getTransportAllowancefromDB,
    getEmployeeNamefromDB,
    getEmployeeInfoFromDB,
    getPolicyDataFromDB,
    getHotelsByCityFromDB,
    getCitiesFromDB,
    getHotelRoomsPricingFromDB
};