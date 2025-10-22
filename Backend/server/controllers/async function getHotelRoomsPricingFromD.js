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
                if (n.includes('single')) return 'S';
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

        console.log('P_GET_STRIP_HOTEL_ROOMS rows for', code, rows);
        //console.log('Normalized pricing map for', code, pricing);

        return pricing; // e.g., { single: 1200, double: 1700, trible: 2000 }
    } catch (error) {
        console.error('Error calling stored procedure P_GET_STRIP_HOTEL_ROOMS:', error);
        console.error('Parameters used - hotelCode:', hotelCode);
        return {};
    }
}