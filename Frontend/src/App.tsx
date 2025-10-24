import { useState, useEffect } from 'react';
import {
  getCompanionsFromServer,
  getHotelsFromServer,
  getHotelsByCityFromServer,
  getHotelRoomPricesFromServer,
  getRoomTypesFromServer,
  getTransportOptionsFromServer,
  getTransportAllowanceFromServer,
  Hotel,
  Companion,
  RoomType,
  getEmployeeNameFromServer,
  getPolicyDataFromServer,
  submitTripFromServer
} from './services/Services';
import Hotels from './components/Hotels';
import { Columns } from 'lucide-react';
import { data } from 'react-router-dom';





interface ColumnState {
  selectedCity: string;
  selectedHotel: Hotel | null;
  travelAllowance: string;
  arrivalDate: string;
  roomCounts: Record<string, number>;
  extraBedCounts: Record<string, number>;
  maxExtraBeds: Record<string, number>;
}

interface AppProps {
  employeeID: number;
}

// Define types for hotel pricing cache
type RoomPricing = { ROOM_TYPE: string; ROOM_PRICE: number };
type PricingPayload = RoomPricing[] | (Record<string, number> & { room_price?: number; extra_bed_price?: number });

function App({ employeeID }: AppProps) {
  const [ROOM_TYPES, setROOM_TYPES] = useState<RoomType[]>([]);
  const [HOTELS, setHOTELS] = useState<Record<string, Hotel[]>>({});
  const [selectedCompanions, setSelectedCompanions] = useState<string[]>([]);
  const [showHotelPopup, setShowHotelPopup] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [COMPANIONS, setCOMPANIONS] = useState<Companion[]>([]);
  const [employeeName, setEmployeeName] = useState<string>('');
  const [maximumNoOfCompanions, setMaximumNoOfCompanions] = useState<number>(0);
  const [maximumNoOfHotels, setMaximumNoOfHotels] = useState<number>(0);
  const [policyStartDate, setPolicyStartDate] = useState<string | null>(null);
  const [policyEndDate, setPolicyEndDate] = useState<string | null>(null);
  const [empContribution, setEmpContribution] = useState<number>(0);
  const [hotelPricingCache, setHotelPricingCache] = useState<Record<string, PricingPayload>>({});
  
  useEffect(() => {
    const fetchInitialData = async () => {
      const [hotelsData, companionsData, roomTypesData, , employeeName, policyData] = await Promise.all([
        getHotelsFromServer(),
        getCompanionsFromServer(employeeID),
        getRoomTypesFromServer(),
        getTransportOptionsFromServer(employeeID),
        getEmployeeNameFromServer(employeeID),
        getPolicyDataFromServer(employeeID),
      ]);

      setHOTELS(hotelsData);
      
      if (Array.isArray(companionsData)) {
        setCOMPANIONS(companionsData as Companion[]);
      } else {
        setCOMPANIONS((companionsData as { companions?: Companion[] })?.companions ?? []);
      }
      
      setROOM_TYPES(Array.isArray(roomTypesData) ? roomTypesData : []);
      setEmployeeName(employeeName)
      setMaximumNoOfCompanions(policyData.maxCompanions || 0)
      setMaximumNoOfHotels(policyData.maxHotels || 0)
      setPolicyStartDate(policyData.startDate)
      setPolicyEndDate(policyData.endDate)
      setEmpContribution(policyData.empContribution || 0)
    };

    fetchInitialData();
  }, [employeeID]);

  const [currentColumn, setCurrentColumn] = useState<number | null>(null);
  const [calendarColumn, setCalendarColumn] = useState<number | null>(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [tooltip, setTooltip] = useState<{show: boolean, x: number, y: number, content: string}>({
    show: false, x: 0, y: 0, content: ''
  });

  const [columns, setColumns] = useState<Record<number, ColumnState>>({});
  
  // Force re-render when pricing cache or empContribution changes
  useEffect(() => {
    // Trigger re-render by updating a dummy value
    const timer = setTimeout(() => {
      setColumns(prev => ({ ...prev }));
    }, 100);
    return () => clearTimeout(timer);
  }, [hotelPricingCache, empContribution]);
  
  useEffect(() => {
    const hotelCount = maximumNoOfHotels > 0 ? maximumNoOfHotels : 3;
    const newColumns: Record<number, ColumnState> = {};
    for (let i = 1; i <= hotelCount; i++) {
      newColumns[i] = { 
        selectedCity: '', 
        selectedHotel: null, 
        travelAllowance: 'لايوجد', 
        arrivalDate: '', 
        roomCounts: {}, 
        extraBedCounts: {}, 
        maxExtraBeds: {} 
      };
    }
    setColumns(newColumns);
  }, [maximumNoOfHotels]);

  const handleCompanionChange = (value: string, checked: boolean) => {
    if (checked) {
      if (selectedCompanions.length >= maximumNoOfCompanions) {
        alert(`الحد الأقصى للمرافقين هو ${maximumNoOfCompanions}`);
        return;
      }
      setSelectedCompanions([...selectedCompanions, value]);
    } else {
      setSelectedCompanions(selectedCompanions.filter(c => c !== value));
    }
  };

  const handleCityChange = (col: number, city: string) => {
    setColumns(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        selectedCity: city,
        travelAllowance: 'لايوجد'
      }
    }));

    if (city) {
      (async () => {
        try {
          const hotels = await getHotelsByCityFromServer(city, 'ar');
          setHOTELS(prev => ({ ...prev, [city]: hotels }));

          const allowance = await getTransportAllowanceFromServer(employeeID, city, 'en');
          setColumns(prev => ({
            ...prev,
            [col]: {
              ...prev[col],
              travelAllowance: allowance?.label || 'لايوجد'
            }
          }));
        } catch (e) {
          console.error('Failed to load data for city', city, e);
        }
      })();
    }
  };

  const openHotelPopup = async (col: number) => {
    const city = columns[col].selectedCity;
    if (!city) {
      alert('اختر المدينة أولاً');
      return;
    }
    try {
      const hotels = await getHotelsByCityFromServer(city, 'ar');
      setHOTELS(prev => ({ ...prev, [city]: hotels }));
    } catch (e) {
      console.error('Failed to refresh hotels for city before opening popup', city, e);
    }
    setCurrentColumn(col);
    const selected = columns[col].selectedHotel;
    if (selected && selected.id) {
      try {
        const pricing = await getHotelRoomPricesFromServer(selected.id);
        setHotelPricingCache(prev => ({ ...prev, [selected.id]: pricing }));
      } catch (e) {
        console.error('Failed to load room prices for hotel', selected.id, e);
      }
    }
    setShowHotelPopup(true);
  };

  const selectHotel = async (hotel: Hotel) => {
    if (currentColumn === null) return;

    const maxBeds: Record<string, number> = {};
    ROOM_TYPES.forEach(rt => {
      maxBeds[rt.key] = Math.floor(Math.random() * 3);
    });

    // First update the columns with the selected hotel
    setColumns(prev => ({
      ...prev,
      [currentColumn]: {
        ...prev[currentColumn],
        selectedHotel: hotel,
        maxExtraBeds: maxBeds
      }
    }));
    
    setShowHotelPopup(false);

    // Then fetch pricing for this hotel
    try {
      //console.log('Fetching pricing for selected hotel:', hotel.id);
      const pricing = await getHotelRoomPricesFromServer(hotel.id);
      //console.log('Received pricing data:', pricing);
      //console.log('Pricing data type:', Array.isArray(pricing) ? 'Array' : 'Object');
      if (Array.isArray(pricing)) {
        //console.log('First few items:', pricing.slice(0, 3));
      }
      
      setHotelPricingCache(prev => {
        const updated = { ...prev, [hotel.id]: pricing };
        //console.log('Updated pricing cache. Keys:', Object.keys(updated));
        return updated;
      });
    } catch (e) {
      console.error('Failed to load room prices for hotel', hotel.id, e);
    }
  };

  const openCalendar = (col: number) => {
    setCalendarColumn(col);
    
    if (policyStartDate) {
      const startDate = new Date(policyStartDate);
      setCalendarYear(startDate.getFullYear());
      setCalendarMonth(startDate.getMonth());
    } else {
      const now = new Date();
      setCalendarYear(now.getFullYear());
      setCalendarMonth(now.getMonth());
    }
    
    setShowCalendar(true);
  };

  const selectDate = (dateObj: Date) => {
    if (calendarColumn === null) return;
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const dateStr = yyyy+'-'+mm+'-'+dd;
    setColumns(prev => ({
      ...prev,
      [calendarColumn]: {
        ...prev[calendarColumn],
        arrivalDate: dateStr
      }
    }));
    setShowCalendar(false);
    setTooltip({ show: false, x: 0, y: 0, content: '' });
  };

  const updateRoomCount = (col: number, roomKey: string, value: number) => {
    const val = Math.max(0, value);
    setColumns(prev => {
      const updated = {
        ...prev,
        [col]: {
          ...prev[col],
          roomCounts: { ...prev[col].roomCounts, [roomKey]: val }
        }
      };
      // Force re-render by returning new object reference
      return { ...updated };
    });
  };

  const updateExtraBedCount = (col: number, roomKey: string, value: number) => {
    const maxAllowed = (columns[col].maxExtraBeds[roomKey] || 0) * (columns[col].roomCounts[roomKey] || 0);
    const val = Math.max(0, Math.min(value, maxAllowed));
    setColumns(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        extraBedCounts: { ...prev[col].extraBedCounts, [roomKey]: val }
      }
    }));
  };

  const priceFor = (hotelId: string, roomTypeKey: string, dateObj?: Date): number => {
    let cacheKey = hotelId;
    //console.log ('priceFor called with:', { hotelId, roomTypeKey, dateObj });
    // If date is provided, use date-specific cache key
    if (dateObj) {
      const yyyy = dateObj.getFullYear();
      const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
      const dd = String(dateObj.getDate()).padStart(2, "0");
      const dateStr = yyyy+'-'+mm+'-'+dd;
      cacheKey = `${hotelId}_${dateStr}`;
    }
    
    const hotelPricing = hotelPricingCache[cacheKey];
    //console.log(`Pricing lookup for hotel ${hotelId} (key: ${cacheKey}):`, hotelPricing);
    if (hotelPricing) {
      // Try specific room type price first

    // Find the first object where ROOM_TYPE === "S"
    const foundRoom = hotelPricing.find(room => room.ROOM_TYPE === roomTypeKey);
    //console.log('Found room for type :', roomTypeKey,foundRoom);
      
      //console.log(roomTypeKey)
      //console.log(foundRoom['ROOM_PRICE'])
      if (foundRoom && typeof foundRoom['ROOM_PRICE'] === 'number') {
        //console.log('Returning : '+ foundRoom['ROOM_PRICE'])
        return foundRoom['ROOM_PRICE'] as number;
      }
      
      if (!Array.isArray(hotelPricing) && typeof hotelPricing.room_price === 'number') {
        //console.log(`  Using generic room_price: ${hotelPricing.room_price}`);
        return hotelPricing.room_price;
      }
    }

    //console.log(`  No price found, returning 0`);
    return 0;
  };

  const calculateTotal = (col: number): { total: number, employee: number } => {
    //console.log('calculateTotal');
    const colData = columns[col];
    //console.log('Column data:', colData);
    if (!colData.selectedHotel || !colData.arrivalDate) {
      //console.log('No hotel or arrival date selected for column', col);
      return { total: 0, employee: 0 };
    }

    let total = 0;
    //console.log(ROOM_TYPES);
    ROOM_TYPES.forEach(rt => {
      const count = colData.roomCounts[rt.key] || 0;
      //console.log(`Room type ${rt.key}: count =`, count);
      if (count > 0) {
        const price = priceFor(colData.selectedHotel!.id, rt.key, new Date(colData.arrivalDate));
        //console.log ('Price for room type', rt.key, 'is', price);
        total += price * count;
      }
    });

    const employeeShare = empContribution > 0 ? (total * empContribution / 100) : (total * 0.6);
    //console.log(`Total for column ${col}:`, total, 'Employee share:', employeeShare);
    return { total, employee: employeeShare };
  };

  const monthName = (y: number, m: number) => {
    const ar = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    return `${ar[m]} ${y}`;
  };

  const weekdayFull = (idx: number) => {
    const ar = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    return ar[idx];
  };

  const renderCalendar = () => {
    const first = new Date(calendarYear, calendarMonth, 1);
    const start = first.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const headers = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

    const days: (number | null)[] = [];
    for (let i = 0; i < start; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }

    return (
      <>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {headers.map((h, i) => (
            <div key={i} className="text-center font-semibold p-2">{h}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, i) => {
            if (d === null) {
              return <div key={i} className="border rounded p-2 bg-gray-50"></div>;
            }
            const dateObj = new Date(calendarYear, calendarMonth, d);
            
            const selectedHotel = calendarColumn !== null && columns[calendarColumn].selectedHotel;
            const priceText = selectedHotel ? 'انقر لعرض الأسعار' : 'اختر فندق أولاً';

            const isWithinPolicyRange = () => {
              if (!policyStartDate || !policyEndDate) return true;
              
              const policyStartDateObj = new Date(policyStartDate);
              const policyEndDateObj = new Date(policyEndDate);
              
              policyStartDateObj.setHours(0, 0, 0, 0);
              policyEndDateObj.setHours(23, 59, 59, 999);
              dateObj.setHours(0, 0, 0, 0);
              
              const isValid = dateObj >= policyStartDateObj && dateObj <= policyEndDateObj;
              return isValid;
            };

            const isDateValid = isWithinPolicyRange();
            const buttonClass = isDateValid 
              ? "w-full text-sm p-1 border rounded hover:bg-blue-50" 
              : "w-full text-sm p-1 border rounded bg-gray-100 text-gray-400 cursor-not-allowed";

            return (
              <div
                key={i}
                className={`border rounded p-2 relative ${isDateValid ? 'bg-white' : 'bg-gray-50'}`}
                style={{ minHeight: '72px', padding: '8px' }}
                onMouseMove={isDateValid ? (e) => handleTooltipShow(e, dateObj) : undefined}
                onMouseLeave={() => setTooltip({ show: false, x: 0, y: 0, content: '' })}
              >
                <div className="font-semibold">{d}</div>
                <div className="text-xs text-gray-600 mt-1">{priceText}</div>
                <div className="mt-2">
                  <button
                    className={buttonClass}
                    onClick={isDateValid ? () => selectDate(dateObj) : undefined}
                    disabled={!isDateValid}
                  >
                    {isDateValid ? 'اختيار' : 'غير متاح'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const handleTooltipShow = async (e: React.MouseEvent, dateObj: Date) => {
    //console.log('Showing tooltip for date:', dateObj);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const localDateStr = `${yyyy}-${mm}-${dd}`;

    const hotelId = calendarColumn !== null && columns[calendarColumn].selectedHotel
      ? columns[calendarColumn].selectedHotel!.id
      : null;
    
    let typesToShow = ROOM_TYPES;
    if (calendarColumn !== null) {
      const hasRooms = ROOM_TYPES.filter(rt => (columns[calendarColumn].roomCounts[rt.key] || 0) > 0);
      if (hasRooms.length > 0) typesToShow = hasRooms;
    }

    let html = `<div style="font-weight:700;margin-bottom:6px">${weekdayFull(dateObj.getDay())} — ${localDateStr}</div>`;
    html += `<table style="width:100%;font-size:13px;margin-bottom:6px"><thead><tr>
      <th style="padding:2px 8px">نوع الغرفة</th>
      <th style="padding:2px 8px">السعر</th>
    </tr></thead><tbody>`;

    if (hotelId) {
      // Fetch fresh pricing data for this hotel and date if not cached
      const dateStr = yyyy+'-'+mm+'-'+dd;
      //dateObj.toISOString().slice(0, 10);
      //console.log('Preparing tooltip for hotel:', hotelId, 'on date:', dateStr);
      const cacheKey = `${hotelId}_${dateStr}`;
      
      if (!hotelPricingCache[cacheKey]) {
        try {
          const pricing = await getHotelRoomPricesFromServer(hotelId, dateStr);
          setHotelPricingCache(prev => ({ ...prev, [cacheKey]: pricing }));
        } catch (error) {
          console.error('Failed to fetch pricing for tooltip:', error);
        }
      }

      typesToShow.forEach(rt => {
        //console.log(dateObj)
        const price = priceFor(hotelId, rt.key, dateObj);
        html += `<tr>
          <td style="padding:2px 8px">${rt.ar}</td>
          <td style="padding:2px 8px;text-align:left">EGP ${price}</td>
        </tr>`;
      });
    } else {
      html += `<tr><td colspan="2" style="padding:2px 8px;text-align:center">اختر فندق أولاً</td></tr>`;
    }

    html += `</tbody></table>`;

    if (hotelId) {
      let extraBedPrice = 0;
      const hotelPricing = hotelPricingCache[hotelId];
      if (hotelPricing && !Array.isArray(hotelPricing) && typeof hotelPricing.extra_bed_price === 'number') {
        extraBedPrice = hotelPricing.extra_bed_price;
      }
      if (extraBedPrice > 0) {
        html += `<div style="margin-top:8px;font-weight:bold;color:#e11d48;text-align:center;border-top:2px solid #e11d48;">سعر السرير الإضافي: EGP ${extraBedPrice}</div>`;
      } else {
        html += `<div style="margin-top:8px;font-weight:bold;color:#e11d48;text-align:center;border-top:2px solid #e11d48;">سعر السرير الإضافي: غير متوفر</div>`;
      }
    }

    setTooltip({ show: true, x: e.clientX, y: e.clientY, content: html });
  };

  const getArabicOrdinal = (num: number): string => {
    const ordinals = [
      'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 
      'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر',
      'الثالث عشر', 'الرابع عشر', 'الخامس عشر', 'السادس عشر', 'السابع عشر',
      'الثامن عشر', 'التاسع عشر', 'العشرون'
    ];
    return ordinals[num - 1] || `ال${num}`;
  };

  const renderColumn = (col: number) => {
    const colData = columns[col];
    
    // Force recalculation on every render to ensure fresh empContribution value
    let total = 0;
    if (colData.selectedHotel && colData.arrivalDate) {
            const dateObj = new Date(colData.arrivalDate);

      const cacheData = hotelPricingCache[colData.selectedHotel.id];
      //console.log(`=== Calculating total for column ${col} ===`);
      //console.log('Hotel ID:', colData.selectedHotel.id);
      //console.log('Arrival Date:', colData.arrivalDate);
      //console.log('Room Counts:', colData.roomCounts);
      //console.log('Cache Keys:', Object.keys(hotelPricingCache));
      //console.log('Actual Cache Data for this hotel:', cacheData);
      //console.log('Is Array?', Array.isArray(cacheData));
      
      ROOM_TYPES.forEach(rt => {
        const count = colData.roomCounts[rt.key] || 0;
        //console.log(`Checking room type ${rt.key} (${rt.ar}): count=${count}`);
        if (count > 0) {
          const price = priceFor(colData.selectedHotel!.id, rt.key, dateObj);
          //console.log(`  -> Price found: ${price}, Subtotal: ${price * count}`);
          total += price * count;
        } else {
          //console.log(`  -> Skipped (count is 0)`);
        }
      });
    } else {
      // console.log(`Column ${col}: Missing hotel or date`, {
      //   hasHotel: !!colData.selectedHotel,
      //   hasDate: !!colData.arrivalDate
      // });
    }
    
    const contributionPercent = empContribution > 0 ? empContribution : 60;
    const employee = (total * contributionPercent) / 100;
    
    //console.log(`Column ${col} FINAL Total: ${total} EGP, Employee contribution: ${contributionPercent}%, Employee pays: ${employee} EGP`);
    //console.log('===================\n');

    return (
      <section key={col} className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold mb-3">
          الإختيار {getArabicOrdinal(col)}: إختر المدينة والفندق
        </h2>

        <select
          className="w-full border rounded p-3 mb-4 text-lg"
          value={colData.selectedCity}
          onChange={(e) => handleCityChange(col, e.target.value)}
        >
          <option value="">-- اختر المدينة --</option>
          {Object.keys(HOTELS).map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <div className="flex items-center gap-3 mb-3">
          <button
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg"
            onClick={() => openHotelPopup(col)}
          >
            اختيار الفندق
          </button>
          <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '14px' }}>بدل انتقال</span>
          <input
            type="text"
            readOnly
            value={colData.travelAllowance ?? ''}
            placeholder="لايوجد"
            style={{
              width: '84px',
              padding: '6px 8px',
              borderRadius: '8px',
              background: '#ecfdf5',
              color: '#065f46',
              border: '1px solid #bbf7d0',
              textAlign: 'center',
              fontWeight: '600',
              cursor: 'not-allowed'
            }}
          />
        </div>

        {colData.selectedHotel && (
          <>
            <img
              src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60"
              alt={colData.selectedHotel.ar}
              style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
              className="mb-2"
            />
            <div className="mb-2 text-lg font-semibold text-blue-700">{colData.selectedHotel.ar}</div>
          </>
        )}
        {!colData.selectedHotel && (
          <div className="mb-2 text-lg font-semibold text-blue-700">لم يتم اختيار فندق</div>
        )}

        <label className="block font-semibold mb-1">أنواع الغرف والسرير الإضافي</label>
        <div>
          {ROOM_TYPES.map(rt => {
            const maxBeds = colData.maxExtraBeds[rt.key] ?? 0;
            const roomCount = colData.roomCounts[rt.key] ?? 0;
            const reqBeds = colData.extraBedCounts[rt.key] ?? 0;

            return (
              <div key={rt.key} className="flex items-center gap-2 mb-2" style={{ flexWrap: 'nowrap' }}>
                <span style={{ width: '110px' }}>{rt.ar}</span>
                <input
                  type="number"
                  min="0"
                  value={roomCount}
                  onChange={(e) => updateRoomCount(col, rt.key, parseInt(e.target.value) || 0)}
                  style={{ width: '40px', textAlign: 'center', background: '#fff', border: '1px solid #bbb', marginRight: '6px' }}
                  title="عدد الغرف"
                />
                <span className="text-xs text-gray-600" style={{ marginRight: '2px', whiteSpace: 'nowrap' }}>مسموح سرر إضافية</span>
                <input
                  type="number"
                  min="0"
                  max="2"
                  value={maxBeds}
                  readOnly
                  style={{ width: '32px', textAlign: 'center', background: '#eee', border: '1px solid #bbb', marginRight: '6px' }}
                  title="أقصى عدد أسرة إضافية"
                />
                <span className="text-xs text-gray-600" style={{ marginRight: '2px', whiteSpace: 'nowrap' }}>عدد السرر الإضافية</span>
                <input
                  type="number"
                  min="0"
                  value={reqBeds}
                  onChange={(e) => updateExtraBedCount(col, rt.key, parseInt(e.target.value) || 0)}
                  style={{ width: '32px', textAlign: 'center', background: '#fff', border: '1px solid #bbb', marginRight: '6px' }}
                  title="عدد الأسرة المطلوبة"
                />
              </div>
            );
          })}
        </div>

        <button
          className="bg-indigo-600 text-white px-10 py-2 rounded-lg mt-3"
          onClick={() => openCalendar(col)}
        >
          اختيار التاريخ
        </button>

        <label className="block font-semibold mb-1 mt-2">تاريخ الوصول</label>
        <input
          readOnly
          value={colData.arrivalDate}
          className="border p-1 rounded w-full bg-gray-50 text-lg"
          placeholder="—"
        />

        {total > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px' }} className="mt-4">
            <div className="font-semibold">
              إجمالي تكلفة الرحلة: EGP {total.toFixed(2)}<br />
              إجمالي تكلفة الموظف: ({empContribution > 0 ? empContribution : 60}%) EGP {employee.toFixed(2)}
            </div>
          </div>
        )}
      </section>
    );
  };

  function getSelectedHotelsData(): { hotelCode: string; date: string; roomsData: string; }[] {
    //console.log('columns:', columns);

    const getHotelIdByColumn = (columnNum:number) => columns[columnNum]?.selectedHotel?.id;
    //const hotelId = getHotelIdByColumn(1);

    const getRoomCountsByColumn = (columnNum:number) => columns[columnNum]?.roomCounts;
    //const roomsData = getRoomCountsByColumn(1);
    //console.log('roomsData raw:', roomsData);
    
    const getArrivalDate = (columnNum:number) => columns[columnNum]?.arrivalDate;
    // const date = new Date(getArrivalDate(1));

//     const dateFormatted = date.toLocaleDateString('en-GB', {
//   day: '2-digit',
//   month: 'short',
//   year: 'numeric'
// }).replace(/ /g, ' ').toUpperCase();

    //console.log('hotelCode[1]:', hotelId);
    //console.log('roomsData[1]:', roomsData);
    //console.log('arrivalDate[1]:', dateFormatted);

  const res=[];
  for (const col in columns) {
    var colhotelCode = getHotelIdByColumn(Number(col));
    var colRoomsData = getRoomCountsByColumn(Number(col));
    // var arrivalDateObj = new Date(getArrivalDate(Number(col)));
    const date = new Date(getArrivalDate(Number(col)));
    var coldateFormatted = date.toLocaleDateString('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric'
}).replace(/ /g, ' ').toUpperCase();

      res.push({
        hotelCode: colhotelCode??'',
        date: coldateFormatted,
        roomsData: Object.entries(colRoomsData).map(([key, count]) => `${key},${count},0`).join('|')
      });
      }
      //console.log('Final selected hotels data:', res);
return res;
    return(
[
                { hotelCode: "EG-ALX-001", date: "15 NOV 2025", roomsData: "D,2,0|S,1,0|J,1,0" },
                { hotelCode: "EG-HUR-002", date: "16 NOV 2025", roomsData: "S,2,2" },
                { hotelCode: "EG-ALX-003", date: "17 NOV 2025", roomsData: "S,3,1" }]
)

  }

  function getCompanionsFormated(): string {
    const result = selectedCompanions
  .map(item => item.split('|').pop()) // extract last part after '|'
  .join('|');  
  return result;
}

  return (
    <div className="bg-gray-100 min-h-screen" dir="rtl" lang="ar" style={{ fontSize: '16px' }}>
      <header className="bg-white shadow p-4 mb-4">
        <div className="max-w-7xl mx-auto flex items-start justify-between relative">
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <img src="/Logo.png" width="300" height="200" alt="Logo" className="object-contain mx-auto" />
          </div>

          <div className="text-right ml-auto">
            <div style={{ display: 'inline-block', textAlign: 'center' }}>
              <div className="text-1.5xl font-extrabold pb-1"
                   style={{ color: '#0F4C9B', borderBottom: '4px solid #0F4C9B', fontFamily: "'GE Hili', sans-serif" }}>
                إدارة العلاقات العامة
              </div>
              <div className="text-1.5xl font-extrabold mt-3"
                   style={{ color: '#0F4C9B', fontFamily: "'GE Hili', sans-serif" }}>
                رحلات قصيرة
              </div>
            </div>
          </div>

          <div>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg">
              English
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 pb-12">
        <div className="mt-6 mb-2 flex justify-center text-3xl font-bold gap-[300px]">
          <span>اسم الموظف: {employeeName}</span>
          <span>الرقم الوظيفى: {employeeID}</span>
        </div>

        <div className="mt-4 mb-8">
          <section className="bg-white p-6 rounded-2xl shadow-lg">
            <label className="block font-semibold mb-2">المرافقون — الحد الأقصى هو {maximumNoOfCompanions}</label>
            <div className="grid grid-cols-4 gap-2">
              {COMPANIONS.slice(0, 12).map((c, i) => {
                const companionValue = `${c.rel}|${c.name}|${c.RELID}`;
                return (
                  <div key={`companion-${i}`} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedCompanions.includes(companionValue)}
                      onChange={(e) => handleCompanionChange(companionValue, e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                    />
                    <span>{c.rel} — {c.name} </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-none">
          {Object.keys(columns).map(colKey => renderColumn(Number(colKey)))}
        </div>

        <div className="flex justify-center mt-8 mb-1">
          <button onClick={function() { 
            submitTripFromServer(employeeID, getCompanionsFormated(),getSelectedHotelsData())}} className="w-full bg-green-600 text-white px-8 py-3 rounded-lg text-xl font-bold hover:bg-green-700 transition">
            إرسال الطلب ورحلة سعيدة
          </button>
        </div>
      </main>

      {showHotelPopup && currentColumn !== null && columns[currentColumn].selectedCity && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-2xl shadow-lg">
            <div className="flex justify-between mb-3">
              <div className="font-bold text-lg">اختر الفندق</div>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded"
                onClick={() => setShowHotelPopup(false)}
              >
                إغلاق
              </button>
            </div>
            <div className="mb-3 text-sm text-gray-600">
              الحد الأقصى للفنادق: {maximumNoOfHotels} | المتاح: {HOTELS[columns[currentColumn].selectedCity]?.length || 0}
            </div>
            <div className="grid grid-cols-1 gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {HOTELS[columns[currentColumn].selectedCity]
                ?.slice(0, maximumNoOfHotels > 0 ? maximumNoOfHotels : undefined)
                .map(h => (
                <button
                  key={h.id}
                  className="block w-full text-right p-3 border rounded mb-2 hover:bg-blue-50"
                  onClick={() => selectHotel(h)}
                >
                  <img
                    src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60"
                    alt={h.ar}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
                    className="mb-2"
                  />
                  <strong>{h.ar}</strong><br />
                  <span className="text-sm text-gray-600">{h.en}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCalendar && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-4 w-full max-w-4xl shadow-lg" style={{ maxHeight: '700px', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-bold">{monthName(calendarYear, calendarMonth)}</div>
              <div className="flex gap-1">
                <button
                  className="px-3 py-2 border rounded"
                  onClick={() => {
                    let m = calendarMonth - 1;
                    let y = calendarYear;
                    if (m < 0) { m = 11; y -= 1; }
                    setCalendarMonth(m);
                    setCalendarYear(y);
                  }}
                >
                  ‹ الشهر السابق
                </button>
                <button
                  className="px-3 py-2 border rounded"
                  onClick={() => {
                    let m = calendarMonth + 1;
                    let y = calendarYear;
                    if (m > 11) { m = 0; y += 1; }
                    setCalendarMonth(m);
                    setCalendarYear(y);
                  }}
                >
                  الشهر التالي ›
                </button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded"
                  onClick={() => {
                    setShowCalendar(false);
                    setTooltip({ show: false, x: 0, y: 0, content: '' });
                  }}
                >
                  إغلاق
                </button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '500px' }}>
              {renderCalendar()}
            </div>
            <div className="mt-3 text-sm text-gray-600">انقر على التاريخ لاختياره.</div>
          </div>
        </div>
      )}

      {tooltip.show && (
        <div
          style={{
            position: 'fixed',
            zIndex: 9999,
            background: 'rgba(15,15,20,0.96)',
            color: 'white',
            padding: '10px',
            borderRadius: '8px',
            maxWidth: '440px',
            fontSize: '12px',
            lineHeight: '1.25',
            boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
            border: '2px solid red',
            left: `${tooltip.x + 12}px`,
            top: `${tooltip.y + 12}px`,
            pointerEvents: 'none'
          }}
          dangerouslySetInnerHTML={{ __html: tooltip.content }}
        />
      )}

      <footer className="bg-white shadow p-4 mt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-4">
          <img src="/First.jpeg" alt="First logo" className="w-16 h-16 object-contain" />
          <div>
            <div className="text-lg font-bold">First Information &amp; Technology Solutions</div>
            <div className="text-sm text-gray-600">الشركة الأولى لنظم المعلومات والحلول التقنية</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;