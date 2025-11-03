import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import App from './App.tsx';
import { getSecretKeyValueFromServer } from './services/Services';

// Component to extract employeeID from URL and pass to App
function AppWithEmployeeID() {
  const { employeeID } = useParams<{ employeeID: string }>();
  
  const [parsedID, setParsedID] = useState<number>(0);

  // Effect to fetch and set the real employee ID when component mounts
  //RQ-PR-AA-28-10-2025.01
  useEffect(() => {
    const fetchEmployeeId = async () => {
      try {
        // Accept any employeeID from URL, no validation needed
        const parsedSecretID = employeeID || '0';
        //console.log('Fetching employee ID for secret:', parsedSecretID);
        
        const result = parsedSecretID;//*/await getSecretKeyValueFromServer(parsedSecretID);
        //console.log('Fetched employee ID from server:', result);
        const realEmployeeId = parseInt(result, 10);
        //console.log('Parsed real employee ID:', realEmployeeId);
        setParsedID(isNaN(realEmployeeId) ? 0 : realEmployeeId);
      } catch (error) {
        console.error('Error fetching employee ID:', error);
        setParsedID(0); // Fallback to default ID
      }
    };

    fetchEmployeeId();
  }, [employeeID]);

  // Only show error if the ID is clearly invalid (not a number)
  if (parsedID <= 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">خطأ في معرف الموظف</h1>
          <p className="text-gray-600">يرجى التأكد من صحة معرف الموظف في الرابط</p>
          <p className="text-sm text-gray-500 mt-2">مثال: /employee/123456</p>
        </div>
      </div>
    );
  }

  return <App employeeID={parsedID} />;
}

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/employee/:employeeID" element={<AppWithEmployeeID />} />
        <Route path="/" element={<Navigate to="/employee/0" replace />} />
        <Route path="*" element={<Navigate to="/employee/0" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
