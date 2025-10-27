import { getApiBase } from '../config';
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
      // Transform the data into the format expected by the app
      const hotels: Record<string, Hotel[]> = hotelResult.data;
      
    return hotels;
    } else {
      console.error('Failed to fetch hotels:', hotelResult.message);
      return {};
    }
  } catch (error) {
    console.error('Error fetching hotels:', error);
    return {};
  }
}

export async function getHotelsByCityFromServer(city: string, lang: 'ar' | 'en' = 'ar') {
  try {
  const response = await fetch(`http://${getApiBase()}/api/hotels/${encodeURIComponent(city)}?lang=${lang}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch hotels by city');
    }
    return result.data as Hotel[];
  } catch (error) {
    console.error('Error fetching hotels by city:', error);
    throw error;
  }
}

// Fetch actual room prices for a hotel
export type HotelRoomPrices = Record<string, number> & { room_price?: number; extra_bed_price?: number };

export async function getHotelRoomPricesFromServer(hotelCode: string, date?: string): Promise<HotelRoomPrices> {
  try {
    // Always pass date parameter to get date-specific pricing
    const dateParam = date || new Date().toISOString().slice(0, 10);
    console.log(`Fetching room prices for hotel ${hotelCode} on date ${dateParam}`);
  const url = `http://${getApiBase()}/api/hotel/${encodeURIComponent(hotelCode)}/rooms?date=${encodeURIComponent(dateParam)}`;
    console.log('Request URL:', url);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch hotel room prices');
    }
    
    // Support both map of room type => price and { room_price, extra_bed_price }
    return result.data as HotelRoomPrices;
  } catch (error) {
    console.error('Error fetching hotel room prices:', error);
    return {} as HotelRoomPrices;
  }
}

export async function getCitiesFromServer(lang: 'ar' | 'en' = 'ar') {
  try {
  const response = await fetch(`http://${getApiBase()}/api/cities?lang=${lang}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch cities');
    }
    return result.data as City[];
  } catch (error) {
    console.error('Error fetching cities:', error);
    throw error;
  }
}

export async function getCompanionsFromServer(employeeID: number) {
  try {
  const response = await fetch('http://' + getApiBase() + '/api/companions/' + employeeID);
    const result = await response.json();
    if (result.success) {
      // Transform the data into the format expected by the app
      const COMPANIONS: Companion[] = result.data;
      
    return COMPANIONS;
    } else {
      console.error('Failed to fetch companions:', result.message);
      return {};
    }
  } catch (error) {
    console.error('Error fetching companions:', error);
    return {};
  }
}


export async function getRoomTypesFromServer() {
  try {
  const response = await fetch('http://' + getApiBase() + '/api/room-types');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch room types');
    }
    // Expect an array of room types from API
    return Array.isArray(result.data) ? result.data as RoomType[] : [];
  } catch (error) {
    console.error('Error fetching room types:', error);
    throw error; // Re-throw the error to handle it in the component
  }
}

export async function getTransportOptionsFromServer(employeeID: number) {
  try {
  const response = await fetch('http://' + getApiBase() + '/api/transport-options/' + employeeID);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch transport options');
    }
    return result.data;
  } catch (error) {
    console.error('Error fetching transport options:', error);
    throw error; // Re-throw the error to handle it in the component
  }
}

// Fetch transport allowance using proc EXEC P_GET_STRIP_TRANS_ALLOWANC @lang,@city,@empcode
export async function getTransportAllowanceFromServer(employeeID: number, city: string, lang: 'ar' | 'en' = 'ar') {
  try {
  const url = `http://${getApiBase()}/api/transport-allowance/${employeeID}?city=${encodeURIComponent(city)}&lang=${lang}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch transport allowance');
    }
    return result.data as { value: number; currency: string; label: string };
  } catch (error) {
    console.error('Error fetching transport allowance:', error);
    return { value: 0, currency: '', label: 'لا يوجد' };
  }
}



export async function getEmployeeNameFromServer(employeeID: number) {
  try {
  const response = await fetch('http://' + getApiBase() + '/api/employee/' + employeeID);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch Employee Name ');
    }
    return result.data;
  } catch (error) {
    console.error('Error fetching Employee Name :', error);
    throw error; // Re-throw the error to handle it in the component
  }
}

export async function getPolicyDataFromServer(employeeID: number) {
  try {
  const response = await fetch(`http://${getApiBase()}/api/policy/${employeeID}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch policy data');
    }
    return result.data;
  } catch (error) {
    console.error('Error fetching policy data:', error);
    throw error; // Re-throw the error to handle it in the component
  }
}

export async function getMaximumNoOfCompanionsFromServer(employeeID: number) {
  try {
    const policyData = await getPolicyDataFromServer(employeeID);
    return policyData.maxCompanions || 0;
  } catch (error) {
    console.error('Error fetching maximum-no-of-companions:', error);
    throw error; // Re-throw the error to handle it in the component
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
  hotels: { hotelCode: string;hotelName:string; date: string; roomsData: string }[] | null | undefined;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // employeeId must be present and non-zero (allow string numeric too)
  const emp = tripData?.employeeId;
  if (emp === null || emp === undefined || emp === '' || Number(emp) === 0 || Number.isNaN(Number(emp))) {
    errors.push('Employee ID is missing or invalid.');
  }

  // hotels must be a non-empty array
  const hotels = Array.isArray(tripData?.hotels) ? tripData!.hotels : [];
  if (!hotels || hotels.length === 0) {
    errors.push('لم يتم تحديد أي فنادق للرحلة.');
  }

  // familyIds: if present, split by '|' to count companions. empty or whitespace => 0
  const famStr = (tripData?.familyIds ?? '').toString().trim();
  const familyIdsList = famStr === '' ? [] : famStr.split('|').map(s => s.trim()).filter(s => s !== '');
  const familyCount = familyIdsList.length; // number of family members

  // For each hotel: date must be non-empty; roomsData must be non-empty and contain '|' and have (familyCount + 1) segments
  hotels.forEach(async (h, idx) => {    
    if (!h) {
      errors.push(`Hotel entry #${idx + 1} is invalid.`);
      return;
    }
    if (!h.hotelCode || h.hotelCode.toString().trim() === '') {
      errors.push(`Hotel entry #${idx + 1} has empty hotelCode.`);
    }
    //console.log('Validating hotel date dsdsd: ',  h.date);
    if (!h.date || h.date.toString().trim() === '' || h.date === 'INVALID DATE') {
      errors.push(`الفندق ${h.hotelName || '<unknown>'}: يفتقد التاريخ.`);
    }
    const rooms = (h.roomsData ?? '').toString();
    if (!rooms || rooms.trim() === '') {
      errors.push(`الفندق ${h.hotelName || '<unknown>'}: بيانات الغرف فارغة. `);
    } else {
      const parts = rooms.split('|').map(s => s.trim());
      const RoomsCount = await CalculateRoomsCount(h.hotelCode,parts);
      const expected = familyCount + 1; // employee + family members
      if (RoomsCount !== expected) {
        errors.push(`فندق ${h.hotelName || '<unknown>'}: عدد الأسرة المتوقع ${expected} سرير   (موظف + ${familyCount} من العائلة), ولكن المطلوب ${RoomsCount} سرير.`);
      }
      // ensure no segment is empty
      parts.forEach((p, pi) => {
        if (p === '') {
          errors.push(`Hotel ${h.hotelCode || '<unknown>'} roomsData segment #${pi + 1} is empty.`);
        }
      });
    }
  });

  return { valid: errors.length === 0, errors };
}

export async function submitTripFromServer(employeeID: number, familyIds: string, hotels: { hotelCode: string; hotelName:string; date: string; roomsData: string; }[]) {
  // Ensure hotels is an array and filter out entries without a valid hotelCode
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
    const msg = 'الرجاء تصحيح الأخطاء التالية قبل الإرسال:\n' + validation.errors.join('\n');
    // show user-friendly alert and also log
    alert(msg);
    console.error('Trip data validation failed:', validation.errors);
    return;
  }

  try {
    console.log('Submitting: http://' + getApiBase() + '/api/submit');
  const res = await fetch('http://' + getApiBase() + '/api/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tripData)
    });

    const data = await res.json();
    if (res.ok) {
      alert('تم إرسال الطلب بنجاح!');
    } else {
      alert('حدث خطأ في إرسال الطلب');
      console.error('Error:', data);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
  }
    };
