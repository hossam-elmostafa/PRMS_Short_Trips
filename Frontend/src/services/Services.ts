import { getApiBase } from '../config';
import i18n from '../i18n/config';

export interface Hotel {
  id: string;
  en: string;
  ar: string;
}

export interface Companion {
  RELID: string;
  rel: string;
  name: string;
}

export interface City {
  code: string;
  name: string;
}

export interface RoomType {
  key: string;
  ar: string;
  factor: number;
}

export async function getHotelsFromServer() {
  try {
    console.log('Fetching hotels from server at api base:', getApiBase());
    const response = await fetch(`http://${getApiBase()}/api/hotels`);
    const hotelResult = await response.json();
    
    if (hotelResult.success) {
      const hotels: Record<string, Hotel[]> = hotelResult.data;
      return hotels;
    } else {
      console.error(i18n.t('errors.fetchHotels'), hotelResult.message);
      return {};
    }
  } catch (error) {
    console.error(i18n.t('errors.fetchHotels'), error);
    return {};
  }
}

export async function getHotelsByCityFromServer(city: string, lang: 'ar' | 'en' = 'ar') {
  try {
    const response = await fetch(`http://${getApiBase()}/api/hotels/${encodeURIComponent(city)}?lang=${lang}`);
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchHotelsByCity'));
    }
    return result.data as Hotel[];
  } catch (error) {
    console.error(i18n.t('errors.fetchHotelsByCity'), error);
    throw error;
  }
}

// Fetch actual room prices for a hotel
export type HotelRoomPrices = Record<string, number> & { room_price?: number; extra_bed_price?: number };

export async function getHotelRoomPricesFromServer(hotelCode: string, date?: string): Promise<HotelRoomPrices> {
  try {
    const dateParam = date || new Date().toISOString().slice(0, 10);
    const url = `http://${getApiBase()}/api/hotel/${encodeURIComponent(hotelCode)}/rooms?date=${encodeURIComponent(dateParam)}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchHotelRoomPrices'));
    }
    
    return result.data as HotelRoomPrices;
  } catch (error) {
    console.error(i18n.t('errors.fetchHotelRoomPrices'), error);
    return {} as HotelRoomPrices;
  }
}

export async function getCitiesFromServer(lang: 'ar' | 'en' = 'ar') {
  try {
    const response = await fetch(`http://${getApiBase()}/api/cities?lang=${lang}`);
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchCities'));
    }
    return result.data as City[];
  } catch (error) {
    console.error(i18n.t('errors.fetchCities'), error);
    throw error;
  }
}

export async function getCompanionsFromServer(employeeID: number, lang?: 'ar' | 'en') {
  try {
    const currentLang = lang || i18n.language as 'ar' | 'en';
    const url = `http://${getApiBase()}/api/companions/${employeeID}?lang=${currentLang}`;
    
    console.log('🔗 Fetching companions from:', url);
    
    const response = await fetch(url);
    const result = await response.json();
    
    console.log('📥 Received companions:', result);
    
    if (result.success) {
      const COMPANIONS: Companion[] = result.data;
      return COMPANIONS;
    } else {
      console.error(i18n.t('errors.fetchCompanions'), result.message);
      return [];
    }
  } catch (error) {
    console.error(i18n.t('errors.fetchCompanions'), error);
    return [];
  }
}

export async function getRoomTypesFromServer() {
  try {
    const response = await fetch('http://' + getApiBase() + '/api/room-types');
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchRoomTypes'));
    }
    return Array.isArray(result.data) ? result.data as RoomType[] : [];
  } catch (error) {
    console.error(i18n.t('errors.fetchRoomTypes'), error);
    throw error;
  }
}

export async function getTransportOptionsFromServer(employeeID: number) {
  try {
    const response = await fetch('http://' + getApiBase() + '/api/transport-options/' + employeeID);
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchTransportOptions'));
    }
    return result.data;
  } catch (error) {
    console.error(i18n.t('errors.fetchTransportOptions'), error);
    throw error;
  }
}

export async function getTransportAllowanceFromServer(employeeID: number, city: string, lang: 'ar' | 'en' = 'ar') {
  try {
    const url = `http://${getApiBase()}/api/transport-allowance/${employeeID}?city=${encodeURIComponent(city)}&lang=${lang}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchTransportAllowance'));
    }
    return result.data as { value: number; currency: string; label: string };
  } catch (error) {
    console.error(i18n.t('errors.fetchTransportAllowance'), error);
    return { value: 0, currency: '', label: i18n.t('transport.none') };
  }
}

export async function getEmployeeNameFromServer(employeeID: number, currentLang: string) {
  try {
    const response = await fetch(`http://${getApiBase()}/api/employee/${employeeID}?lang=${currentLang}`);
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchEmployeeName'));
    }
    return result.data;
  } catch (error) {
    console.error(i18n.t('errors.fetchEmployeeName'), error);
    throw error;
  }
}

export async function getPolicyDataFromServer(employeeID: number) {
  try {
    const response = await fetch(`http://${getApiBase()}/api/policy/${employeeID}`);
    if (!response.ok) {
      throw new Error(i18n.t('errors.httpError', { status: response.status }));
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || i18n.t('errors.fetchPolicyData'));
    }
    return result.data;
  } catch (error) {
    console.error(i18n.t('errors.fetchPolicyData'), error);
    throw error;
  }
}

export async function getMaximumNoOfCompanionsFromServer(employeeID: number) {
  try {
    const policyData = await getPolicyDataFromServer(employeeID);
    return policyData.maxCompanions || 0;
  } catch (error) {
    console.error(i18n.t('errors.fetchMaxCompanions'), error);
    throw error;
  }
}

/**
 * RQ-PR-26-10-2025.4
 * Calculate total expected persons from rooms parts array.
 * Each part is expected in the format: TYPE,roomsCount,extras
 * where TYPE is 'S'|'D'|'T' (single/double/triple) and
 * roomsCount and extras are numbers.
 * Examples:
 *  'S,4,1' => 1*4 + 1 = 5
 *  'D,2,1' => 2*2 + 1 = 5
 *  'T,2,2' => 3*2 + 2 = 8
 *  ['S,2,1','T,1,2'] => (1*2+1) + (3*1+2) = 8
 */
export async function getHotelRoomBedCountsFromServer(hotelCode: string): Promise<Record<string, number>> {
  try {
    const response = await fetch(`http://${getApiBase()}/api/hotel/${encodeURIComponent(hotelCode)}/beds`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch hotel room bed counts');
    }
    return result.data as Record<string, number>;
  } catch (error) {
    console.error('Error fetching hotel room bed counts:', error);
    // Return default values if the server request fails
    return { S: 1, D: 2, T: 3, FR: 4, FS: 5, J: 6 };
  }
}

export async function CalculateRoomsCount(hotelCode:string, parts: string[] | null | undefined): Promise<number> {
  if (!Array.isArray(parts) || parts.length === 0) return 0;
  //const capMap: Record<string, number> = { S: 1, D: 2, T: 3, FR: 4 ,FS:5,j:6};
  const capMap: Record<string, number> = await getHotelRoomBedCountsFromServer(hotelCode) as unknown as Record<string, number>;
  console.log('Using capMap for hotel',hotelCode, ':', capMap);
  let total = 0;

  parts.forEach(segment => {
    if (!segment || typeof segment !== 'string') return;
    const tokens = segment.split(',').map(t => t.trim()).filter(t => t !== '');
    if (tokens.length === 0) return;

    const type = (tokens[0] || '').toUpperCase();
    const roomsCount = tokens.length > 1 ? Number(tokens[1]) : 0;
    const extras = tokens.length > 2 ? Number(tokens[2]) : 0;

    const cap = capMap[type] ?? 1;
    const rc = Number.isFinite(roomsCount) ? roomsCount : 0;
    const ex = Number.isFinite(extras) ? extras : 0;

    total += cap * rc + ex;
  });

  return total;
}

// Validate tripData structure before sending to server
export function validateTripData(tripData: {
  employeeId: number | string | null | undefined;
  familyIds: string | null | undefined;
  hotels: { hotelCode: string; hotelName: string; date: string; roomsData: string }[] | null | undefined;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const emp = tripData?.employeeId;
  if (emp === null || emp === undefined || emp === '' || Number(emp) === 0 || Number.isNaN(Number(emp))) {
    errors.push(i18n.t('validation.employeeIdMissing'));
  }

  const hotels = Array.isArray(tripData?.hotels) ? tripData!.hotels : [];
  if (!hotels || hotels.length === 0) {
    errors.push(i18n.t('validation.noHotelsSelected'));
  }

  // familyIds: if present, split by '|' to count companions
  const famStr = (tripData?.familyIds ?? '').toString().trim();
  const familyIdsList = famStr === '' ? [] : famStr.split('|').map(s => s.trim()).filter(s => s !== '');
  const familyCount = familyIdsList.length;

  // For each hotel: date must be non-empty; roomsData must be non-empty and contain '|' and have (familyCount + 1) segments
  hotels.forEach(async (h, idx) => {    
    if (!h) {
      errors.push(i18n.t('validation.hotelEntryInvalid', { index: idx + 1 }));
      return;
    }
    if (!h.hotelCode || h.hotelCode.toString().trim() === '') {
      errors.push(i18n.t('validation.hotelCodeEmpty', { index: idx + 1 }));
    }
    if (!h.date || h.date.toString().trim() === '' || h.date === 'INVALID DATE') {
      errors.push(i18n.t('validation.hotelMissingDate', { hotelName: h.hotelName || '<unknown>' }));
    }
    const rooms = (h.roomsData ?? '').toString();
    if (!rooms || rooms.trim() === '') {
      errors.push(i18n.t('validation.hotelEmptyRooms', { hotelName: h.hotelName || '<unknown>' }));
    } else {
      const parts = rooms.split('|').map(s => s.trim());
      const RoomsCount = await CalculateRoomsCount(h.hotelCode,parts);
      const expected = familyCount + 1; // employee + family members
      if (RoomsCount !== expected) {
        errors.push(i18n.t('validation.hotelRoomsMismatch', { 
          hotelName: h.hotelName || '<unknown>',
          expected: expected,
          familyCount: familyCount,
          actual: RoomsCount
        }));
      }
      parts.forEach((p, pi) => {
        if (p === '') {
          errors.push(i18n.t('validation.hotelRoomsSegmentEmpty', { 
            hotelCode: h.hotelCode || '<unknown>',
            segment: pi + 1
          }));
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

// THIS IS THE KEY CHANGE - The function now returns a Promise with the result object
export async function submitTripFromServer(
  employeeID: number, 
  familyIds: string, 
  hotels: { hotelCode: string; hotelName: string; date: string; roomsData: string; }[]
): Promise<{ success: boolean; errors?: string[] }> {
  const validHotels = Array.isArray(hotels)
    ? hotels.filter(h => h && typeof h.hotelCode === 'string' && h.hotelCode.trim() !== '')
    : [];

  const tripData = {
    employeeId: employeeID,
    familyIds: familyIds,
    hotels: validHotels
  };
  
  // Validate trip data before sending
  const validation = validateTripData(tripData);
  console.log('Trip data validation result:', validation);
  if (!validation.valid) {
    console.error('Trip data validation failed:', validation.errors);
    return { success: false, errors: validation.errors };
  }

  try {
    const res = await fetch('http://' + getApiBase() + '/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripData)
    });

    const data = await res.json();
    if (res.ok) {
      return { success: true };
    } else {
      console.error('Error:', data);
      return { success: false, errors: [data.message || i18n.t('errors.submitError')] };
    }
  } catch (err) {
    console.error(i18n.t('errors.networkError'), err);
    return { success: false, errors: [i18n.t('errors.networkError')] };
  }
}