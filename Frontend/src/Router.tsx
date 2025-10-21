import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import App from './App.tsx';

// Component to extract employeeID from URL and pass to App
function AppWithEmployeeID() {
  const { employeeID } = useParams<{ employeeID: string }>();
  
  // Accept any employeeID from URL, no validation needed
  const parsedID = employeeID ? parseInt(employeeID, 10) : 100019;
  
  // Only show error if the ID is clearly invalid (not a number)
  if (isNaN(parsedID) || parsedID <= 0) {
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
        <Route path="/" element={<Navigate to="/employee/100019" replace />} />
        <Route path="*" element={<Navigate to="/employee/100019" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
