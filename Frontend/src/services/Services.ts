export interface Hotel {
  id: string;
  en: string;
  ar: string;
}

export interface Companion {
  rel: string;
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
    const result = await response.json();
    
    if (result.success) {
      // Transform the data into the format expected by the app
      const hotels: Record<string, Hotel[]> = result.data;
      
    return hotels;
    } else {
      console.error('Failed to fetch hotels:', result.message);
      return {};
    }
  } catch (error) {
    console.error('Error fetching hotels:', error);
    return {};
  }
}

export async function getCompanionsFromServer(employeeID: number) {
  try {
    const response = await fetch('http://localhost:3000/api/companions/' + employeeID);
    const result = await response.json();
    
    if (result.success) {
      // Transform the data into the format expected by the app
      var COMPANIONS: Companion[] = result.data;
      console.log('Companions fetched from server:', COMPANIONS);
      
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
    return result.data;
  } catch (error) {
    console.error('Error fetching room types:', error);
    throw error; // Re-throw the error to handle it in the component
  }
}

export async function getTransportOptionsFromServer() {
  try {
    const response = await fetch('http://localhost:3000/api/transport-options');
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

export async function getMaximumNoOfCompanionsFromServer() {
  try {
    const response = await fetch('http://localhost:3000/api/maximum-no-of-companions');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch maximum-no-of-companions  ');
    }
    return result.data;
  } catch (error) {
    console.error('Error fetching maximum-no-of-companions :', error);
    throw error; // Re-throw the error to handle it in the component
  }
}