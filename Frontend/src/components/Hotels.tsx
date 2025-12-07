import { useState, useEffect } from 'react';
import { getApiBase, getProtocol } from '../config';

interface Hotel {
  // Add your hotel properties here based on your backend data structure
  id: string;
  name: string;
  // Add other properties as needed
}

const Hotels = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchHotels = async () => {
      try {
        const response = await fetch(`${getProtocol()}://${getApiBase()}/shorttrips/api/hotels`);
        const result = await response.json();
        
        if (result.success) {
          setHotels(result.data);
        } else {
          setError(result.message || 'Failed to fetch hotels');
        }
      } catch (err) {
        setError('Failed to fetch hotels');
      } finally {
        setLoading(false);
      }
    };

    fetchHotels();
  }, []);

  if (loading) {
    return <div>Loading hotels...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Hotels</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {hotels.map((hotel) => (
          <div key={hotel.id} className="border rounded-lg p-4 shadow-sm">
            <h3 className="text-lg font-semibold">{hotel.name}</h3>
            {/* Add more hotel details here */}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Hotels;