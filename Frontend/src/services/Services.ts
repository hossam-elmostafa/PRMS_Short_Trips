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
    const response = await fetch('http://localhost:3000/api/hotels');
    const hotelResult = await response.json();
    //console.log('Hotels fetched from server:', hotelResult);
    
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
    const response = await fetch(`http://localhost:3000/api/hotels/${encodeURIComponent(city)}?lang=${lang}`);
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
    const url = `http://localhost:3000/api/hotel/${encodeURIComponent(hotelCode)}/rooms?date=${encodeURIComponent(dateParam)}`;
    console.log('Constructed URL for fetching hotel room prices:', url);

    //console.log(`Fetching hotel room prices for ${hotelCode} on date ${dateParam}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch hotel room prices');
    }
    
    //console.log(`Received pricing data for ${hotelCode}:`, result.data);
    
    // Support both map of room type => price and { room_price, extra_bed_price }
    return result.data as HotelRoomPrices;
  } catch (error) {
    console.error('Error fetching hotel room prices:', error);
    return {} as HotelRoomPrices;
  }
}

export async function getCitiesFromServer(lang: 'ar' | 'en' = 'ar') {
  try {
    const response = await fetch(`http://localhost:3000/api/cities?lang=${lang}`);
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
    const response = await fetch('http://localhost:3000/api/companions/' + employeeID);
    const result = await response.json();
    console.log('Companions fetched from server:', result);
    if (result.success) {
      // Transform the data into the format expected by the app
      const COMPANIONS: Companion[] = result.data;
      //console.log('Companions fetched from server:', COMPANIONS);
      
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
    const response = await fetch('http://localhost:3000/api/room-types');
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
    const response = await fetch('http://localhost:3000/api/transport-options/' + employeeID);
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
    const url = `http://localhost:3000/api/transport-allowance/${employeeID}?city=${encodeURIComponent(city)}&lang=${lang}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch transport allowance');
    }
    // result.data: { value: number, currency: string, label: string }
    return result.data as { value: number; currency: string; label: string };
  } catch (error) {
    console.error('Error fetching transport allowance:', error);
    return { value: 0, currency: '', label: 'لا يوجد' };
  }
}



export async function getEmployeeNameFromServer(employeeID: number) {
  try {
    const response = await fetch('http://localhost:3000/api/employee/' + employeeID);
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
    const response = await fetch(`http://localhost:3000/api/policy/${employeeID}`);
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

export async function submitTripFromServer(employeeID: number, familyIds: number[], hotels: { hotelCode: string; date: string; roomsData: string }[]) {
const tripData = {
            employeeId: employeeID,
            familyIds: familyIds,
            hotels: hotels
        };
            try {
            const res = await fetch('http://localhost:3000/api/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(tripData)
            });

            const data = await res.json();
            console.log('Response from server:', data);
            return;
            if (res.ok) {
                console.log('Success:', data);
            } else {
                console.error('Error:', data);
            }
        } catch (err) {
            console.error('Error:', err);
        } finally {
        }
    };


