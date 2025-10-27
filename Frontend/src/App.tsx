import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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

interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

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
type RoomPricing = { ROOM_TYPE: string; ROOM_PRICE: number ,EXTRA_BED_PRICE: string };
type PricingPayload = RoomPricing[] | (Record<string, number> & { room_price?: number; extra_bed_price?: number });

function App({ employeeID }: AppProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

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
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [exitingToasts, setExitingToasts] = useState<number[]>([]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      dismissToast(id);
    }, 5000);
  };

  const dismissToast = (id: number) => {
    setExitingToasts(prev => [...prev, id]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
      setExitingToasts(prev => prev.filter(toastId => toastId !== id));
    }, 400);
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      const currentLang = i18n.language as 'ar' | 'en';

      const [hotelsData, companionsData, roomTypesData, , employeeName, policyData] = await Promise.all([
        getHotelsFromServer(),
        getCompanionsFromServer(employeeID, currentLang),
        getRoomTypesFromServer(),
        getTransportOptionsFromServer(employeeID),
        getEmployeeNameFromServer(employeeID, currentLang),
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
  }, [employeeID, i18n.language]);

  const [currentColumn, setCurrentColumn] = useState<number | null>(null);
  const [calendarColumn, setCalendarColumn] = useState<number | null>(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [tooltip, setTooltip] = useState<{show: boolean, x: number, y: number, content: string}>({
    show: false, x: 0, y: 0, content: ''
  });

  const [columns, setColumns] = useState<Record<number, ColumnState>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setColumns(prev => ({ ...prev }));
    }, 100);
    return () => clearTimeout(timer);
  }, [hotelPricingCache, empContribution]);

  useEffect(() => {
    if (maximumNoOfHotels === 0) return;

    const newColumns: Record<number, ColumnState> = {};
    for (let i = 1; i <= maximumNoOfHotels; i++) {
      newColumns[i] = {
        selectedCity: '',
        selectedHotel: null,
        travelAllowance: t('transport.none'),
        arrivalDate: '',
        roomCounts: {},
        extraBedCounts: {},
        maxExtraBeds: {}
      };
    }
    setColumns(newColumns);
  }, [maximumNoOfHotels, t]);

  const handleCompanionChange = (value: string, checked: boolean) => {
    if (checked) {
      if (selectedCompanions.length >= maximumNoOfCompanions) {
        showToast('warning', t('alerts.maxCompanionsTitle'), `${t('alerts.maxCompanions')} ${maximumNoOfCompanions}`);
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
        selectedHotel: null,
        travelAllowance: t('transport.none'),
        arrivalDate: '',
        roomCounts: {},
        extraBedCounts: {},
        maxExtraBeds: {}
      }
    }));

    if (city) {
      (async () => {
        try {
          const hotels = await getHotelsByCityFromServer(city, 'en');
          setHOTELS(prev => ({ ...prev, [city]: hotels }));

          const allowance = await getTransportAllowanceFromServer(employeeID, city, 'en');
          setColumns(prev => ({
            ...prev,
            [col]: {
              ...prev[col],
              travelAllowance: allowance?.label || t('transport.none')
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
      showToast('warning', t('alerts.selectCityTitle'), t('alerts.selectCity'));
      return;
    }
    try {
      const hotels = await getHotelsByCityFromServer(city, 'en');
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
  const resetRoomCounts: Record<string, number> = {};
  const resetExtraBeds: Record<string, number> = {};
  
  // Get the supported room types as an array
  const supportedRoomTypes = hotel.supportedRoomTypes 
    ? hotel.supportedRoomTypes.split(',').map(t => t.trim())
    : [];
  
  // Check if hotel has ANY supported room types
  const hasSupportedRoomTypes = supportedRoomTypes.length > 0;
  
  ROOM_TYPES.forEach(rt => {
    maxBeds[rt.key] = Math.floor(Math.random() * 3);
    
    // Check if room type is supported AND hotel has room types configured
    const isSupported = hasSupportedRoomTypes && supportedRoomTypes.includes(rt.key);
    
    if (isSupported) {
      // Keep existing counts for supported room types
      resetRoomCounts[rt.key] = columns[currentColumn].roomCounts[rt.key] || 0;
      resetExtraBeds[rt.key] = columns[currentColumn].extraBedCounts[rt.key] || 0;
    } else {
      // Not supported OR hotel has no room types - set to 0
      resetRoomCounts[rt.key] = 0;
      resetExtraBeds[rt.key] = 0;
    }
  });

  setColumns(prev => ({
    ...prev,
    [currentColumn]: {
      ...prev[currentColumn],
      selectedHotel: hotel,
      maxExtraBeds: maxBeds,
      roomCounts: resetRoomCounts,
      extraBedCounts: resetExtraBeds
    }
  }));

  setShowHotelPopup(false);

  try {
    const pricing = await getHotelRoomPricesFromServer(hotel.id);
    setHotelPricingCache(prev => {
      const updated = { ...prev, [hotel.id]: pricing };
      return updated;
    });

    // Show appropriate message based on room type availability
    if (!hasSupportedRoomTypes) {
      showToast('warning', t('hotel.selected'), t('hotel.noRoomTypes'));
    }
  } catch (e) {
    console.error('Failed to load room prices for hotel', hotel.id, e);
    showToast('warning', t('rooms.noPricesTitle'), t('rooms.NotAvailable'));
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
  
  setColumns(prev => {
    const updatedColumn = {
      ...prev[calendarColumn],
      arrivalDate: dateStr
    };
    
    const resetRoomCounts: Record<string, number> = {};
    const resetExtraBeds: Record<string, number> = {};
    
    const selectedHotel = prev[calendarColumn].selectedHotel;
    
    if (selectedHotel) {
      const supportedRoomTypes = selectedHotel.supportedRoomTypes 
        ? selectedHotel.supportedRoomTypes.split(',').map(t => t.trim())
        : [];
      
      const hasSupportedRoomTypes = supportedRoomTypes.length > 0;
      
      ROOM_TYPES.forEach(rt => {
        const price = priceFor(selectedHotel.id, rt.key, dateObj);
        
        // Check if room type is supported AND hotel has room types
        const isSupported = hasSupportedRoomTypes && supportedRoomTypes.includes(rt.key);
        
        // If hotel has no room types OR room type not supported OR price invalid, set to 0
        if (!hasSupportedRoomTypes || !isSupported || price.room_price === null || price.room_price === 0) {
          resetRoomCounts[rt.key] = 0;
          resetExtraBeds[rt.key] = 0;
        } else {
          // Keep existing counts for valid room types
          resetRoomCounts[rt.key] = prev[calendarColumn].roomCounts[rt.key] || 0;
          resetExtraBeds[rt.key] = prev[calendarColumn].extraBedCounts[rt.key] || 0;
        }
      });
    } else {
      // No hotel selected, reset all counts
      ROOM_TYPES.forEach(rt => {
        resetRoomCounts[rt.key] = 0;
        resetExtraBeds[rt.key] = 0;
      });
    }
    
    updatedColumn.roomCounts = resetRoomCounts;
    updatedColumn.extraBedCounts = resetExtraBeds;
    
    return {
      ...prev,
      [calendarColumn]: updatedColumn
    };
  });
  
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

//BUG-PR-26-10-2025.5 changed return to object instead of number to contain extra bed price
  const priceFor = (hotelId: string, roomTypeKey: string, dateObj?: Date): { room_price: number | null, extra_bed_price: string | null } => {
  let cacheKey = hotelId;
  if (dateObj) {
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const dateStr = yyyy+'-'+mm+'-'+dd;
    cacheKey = `${hotelId}_${dateStr}`;
  }

  const hotelPricing = hotelPricingCache[cacheKey];
  if (!hotelPricing) {
    return { room_price: null, extra_bed_price: null }; // No pricing data available
  }

  if (Array.isArray(hotelPricing)) {
    const foundRoom = hotelPricing.find(room => room.ROOM_TYPE === roomTypeKey);

    //console.log('priceFor foundRoom:', foundRoom,typeof foundRoom?.EXTRA_BED_PRICE   );
    //console.log(`typeof foundRoom.ROOM_EXTRABED_PRICE : ${foundRoom?.EXTRA_BED_PRICE}`, typeof foundRoom?.EXTRA_BED_PRICE  );
    return {
      room_price: foundRoom && typeof foundRoom.ROOM_PRICE === 'number' ? foundRoom.ROOM_PRICE : null,
      extra_bed_price: foundRoom && typeof foundRoom.EXTRA_BED_PRICE === 'string' ? foundRoom.EXTRA_BED_PRICE : null,      
    };
  } else {
    return {
      room_price: typeof hotelPricing.room_price === 'number' ? hotelPricing.room_price : null,
      extra_bed_price: typeof hotelPricing.extra_bed_price === 'string' ? hotelPricing.extra_bed_price : null
    };
  }
};
  const monthName = (y: number, m: number) => {
    const monthKeys = ['january','february','march','april','may','june','july','august','september','october','november','december'];
    return `${t(`months.${monthKeys[m]}`)} ${y}`;
  };

  const weekdayFull = (idx: number) => {
    const dayKeys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    return t(`weekdays.${dayKeys[idx]}`);
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

const handleTooltipShow = async (e: React.MouseEvent, dateObj: Date) => {
  //console.log('handleTooltipShow')
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const localDateStr = `${yyyy}-${mm}-${dd}`;

  const hotelId = calendarColumn !== null && columns[calendarColumn].selectedHotel
    ? columns[calendarColumn].selectedHotel!.id
    : null;

  // If no hotel selected, don't show tooltip
  if (!hotelId) {
    setTooltip({ show: false, x: 0, y: 0, content: '' });
    return;
  }

  // Fetch fresh pricing data for this hotel and date if not cached
  const dateStr = yyyy+'-'+mm+'-'+dd;
  const cacheKey = `${hotelId}_${dateStr}`;

  if (!hotelPricingCache[cacheKey]) {
    try {
      const pricing = await getHotelRoomPricesFromServer(hotelId, dateStr);
      setHotelPricingCache(prev => ({ ...prev, [cacheKey]: pricing }));
    } catch (error) {
      console.error('Failed to fetch pricing for tooltip:', error);
      setTooltip({ show: false, x: 0, y: 0, content: '' });
      return;
    }
  }

  // Filter room types to only show those with valid non-zero prices
  const roomTypesWithPrices = ROOM_TYPES.filter(rt => {
    const price = priceFor(hotelId, rt.key, dateObj);
    return price.room_price !== null && price.room_price > 0;
  });

  // Also check extra bed price
  const hotelPricing = hotelPricingCache[cacheKey];
  let extraBedPrice = "0";
  if (hotelPricing && !Array.isArray(hotelPricing) && typeof hotelPricing.extra_bed_price === 'number') {
    extraBedPrice = '"' + hotelPricing.extra_bed_price +'"';
  }

  // If no room types have prices and no extra bed price, don't show tooltip
  if (roomTypesWithPrices.length === 0 && extraBedPrice === "0") {
    setTooltip({ show: false, x: 0, y: 0, content: '' });
    return;
  }

  // Build tooltip HTML only for room types with valid non-zero prices
  let html = `<div style="font-weight:700;margin-bottom:6px">${weekdayFull(dateObj.getDay())} — ${localDateStr}</div>`;
  
  if (roomTypesWithPrices.length > 0) {
    html += `<table style="width:100%;font-size:13px;margin-bottom:6px"><thead><tr>
      <th style="padding:2px 8px">${t('pricing.roomType')}</th>
      <th style="padding:2px 8px">${t('pricing.price')}</th>
    </tr></thead><tbody>`;
    
    roomTypesWithPrices.forEach(rt => {
      const price = priceFor(hotelId, rt.key, dateObj);
      //console.log('price for hotelId:', hotelId, ':rt.key', rt.key);
      //console.log('extraBedPrice price for', rt.key, ':', extraBedPrice , price);
      if (extraBedPrice=="0") //BUG-PR-26-10-2025.5 changed type to string
        extraBedPrice=price.extra_bed_price || "0";
      // Price is guaranteed to be non-null here due to the filter above
      html += `<tr>
        <td style="padding:2px 8px">${rt.ar}</td>
        <td style="padding:2px 8px;text-align:left">EGP ${price.room_price}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  }

  if (extraBedPrice != "0") {
    //BUG-PR-26-10-2025.5 Fixing extra bed price display in tooltip
    if(/%/.test(extraBedPrice))
        html += `<div style="margin-top:8px;font-weight:bold;color:#e11d48;text-align:center;border-top:2px solid #e11d48;">${t('pricing.extraBedPrice')}: ${extraBedPrice}</div>`;
      else
        html += `<div style="margin-top:8px;font-weight:bold;color:#e11d48;text-align:center;border-top:2px solid #e11d48;">${t('pricing.extraBedPrice')}: EGP ${extraBedPrice}</div>`;
  } else if (roomTypesWithPrices.length > 0) {
    html += `<div style="margin-top:8px;font-weight:bold;color:#e11d48;text-align:center;border-top:2px solid #e11d48;">${t('pricing.extraBedPrice')}: ${t('pricing.notAvailable')}</div>`;
  }

  setTooltip({ show: true, x: e.clientX, y: e.clientY, content: html });
};

const renderCalendar = () => {
    const first = new Date(calendarYear, calendarMonth, 1);
    const start = first.getDay();
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const dayKeys = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const headers = dayKeys.map(key => t(`weekdays.${key}`));

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
            const priceText = selectedHotel ? t('pricing.clickForPrices') : t('pricing.selectHotelFirst');

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
                    {isDateValid ? t('date.selectButton') : t('date.notAvailable')}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const getArabicOrdinal = (num: number): string => {
    const ordinalKeys = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
    return t(`selection.${ordinalKeys[num - 1]}`) || `${num}`;
  };

  const renderColumn = (col: number) => {
    const colData = columns[col];

    let total = 0;
    let hasAnyPrice = false;
    
    if (colData.selectedHotel && colData.arrivalDate) {
      const dateObj = new Date(colData.arrivalDate);

      ROOM_TYPES.forEach(rt => {
        const count = colData.roomCounts[rt.key] || 0;
        const priceData = priceFor(colData.selectedHotel!.id, rt.key, dateObj);
        
    // Check if any room type has a valid non-zero price
    if (priceData.room_price !== null && priceData.room_price > 0) {
      hasAnyPrice = true;
    }
        
    // Only add to total if price is valid and count > 0
    if (count > 0 && priceData.room_price !== null && priceData.room_price > 0) {
      total += priceData.room_price * count;
    }
      });
    }

    const contributionPercent = empContribution > 0 ? empContribution : 60;
    const employee = (total * contributionPercent) / 100;

    return (
      <section key={col} className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold mb-3">
          {t('selection.title')} {getArabicOrdinal(col)}
        </h2>

        <select
          className="w-full border rounded p-3 mb-4 text-lg"
          value={colData.selectedCity}
          onChange={(e) => handleCityChange(col, e.target.value)}
        >
          <option value="">{t('city.select')}</option>
          {Object.keys(HOTELS).map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>

        <div className="flex items-center gap-3 mb-3">
          <button
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg"
            onClick={() => openHotelPopup(col)}
          >
            {t('hotel.select')}
          </button>
          <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '14px' }}>{t('transport.allowance')}</span>
          <input
            type="text"
            readOnly
            value={colData.travelAllowance ?? ''}
            placeholder={t('transport.none')}
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
              alt={colData.selectedHotel.en || colData.selectedHotel.ar}
              style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
              className="mb-2"
            />
            <div className="mb-2 text-lg font-semibold text-blue-700">
              {colData.selectedHotel.en || colData.selectedHotel.ar || 'Hotel Selected'}
            </div>
          </>
        )}
        {!colData.selectedHotel && (
          <div className="mb-2 text-lg font-semibold text-blue-700">{t('hotel.notSelected')}</div>
        )}

        <label className="block font-semibold mb-1">{t('rooms.types')}</label>
        
        {/* Show warning if hotel and date selected but no prices available */}
        {colData.selectedHotel && colData.arrivalDate && !hasAnyPrice && (
          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
              <div>
                <div className="font-semibold text-yellow-800 text-sm">{t('rooms.noPricesTitle')}</div>
                <div className="text-yellow-700 text-xs mt-1">{t('rooms.noPricesMessage')}</div>
              </div>
            </div>
          </div>
        )}
        
        <div>
{ROOM_TYPES.map(rt => {
  const maxBeds = colData.maxExtraBeds[rt.key] ?? 0;
  const roomCount = colData.roomCounts[rt.key] ?? 0;
  const reqBeds = colData.extraBedCounts[rt.key] ?? 0;
  
  // Check if this room type is supported by the selected hotel
  const supportedRoomTypes = colData.selectedHotel?.supportedRoomTypes 
    ? colData.selectedHotel.supportedRoomTypes.split(',').map(t => t.trim())
    : [];
  
  const hasSupportedRoomTypes = supportedRoomTypes.length > 0;
  const isSupported = hasSupportedRoomTypes && supportedRoomTypes.includes(rt.key);
  
  // Check pricing for this room type (only if date is selected)
  let priceData = { room_price: null as number | null, extra_bed_price: null as string | null };
  let hasValidPrice = true; // Assume valid until we check with date
  
  if (colData.selectedHotel && colData.arrivalDate) {
    const dateObj = new Date(colData.arrivalDate);
    priceData = priceFor(colData.selectedHotel.id, rt.key, dateObj);
    hasValidPrice = priceData.room_price !== null && priceData.room_price > 0;
  }
  
  // Room type is enabled if:
  // - Hotel is selected AND hotel has room types configured
  // - AND room type is supported by hotel
  // - AND (no date selected OR date selected with valid price)
  const isEnabled = colData.selectedHotel && 
                    hasSupportedRoomTypes &&
                    isSupported && 
                    (!colData.arrivalDate || hasValidPrice);

//{ room_price: number | null, extra_bed_price: string | null } => {                    
  let disabledReason = '';
  if (!colData.selectedHotel) {
    disabledReason = t('rooms.selectHotelFirst');
  } else if (!hasSupportedRoomTypes) {
    disabledReason = t('rooms.hotelNoRoomTypes');
  } else if (!isSupported) {
    disabledReason = t('rooms.notAvailable');
  } else if (colData.arrivalDate && !hasValidPrice) {
    if (priceData.room_price === 0) {
      disabledReason = t('rooms.priceZero');
    } else {
      disabledReason = t('rooms.noPrice');
    }
  }

  return (
    <div 
      key={rt.key} 
      className="flex items-center gap-2 mb-2" 
      style={{ 
        flexWrap: 'nowrap',
        opacity: isEnabled ? 1 : 0.6,
        pointerEvents: isEnabled ? 'auto' : 'none'
      }}
    >
      <span style={{ width: '110px' }}>
        {rt.ar}
      </span>
      <input
        type="number"
        min="0"
        value={roomCount}
        onChange={(e) => updateRoomCount(col, rt.key, parseInt(e.target.value) || 0)}
        disabled={!isEnabled}
        style={{ 
          width: '40px', 
          textAlign: 'center', 
          background: isEnabled ? '#fff' : '#f3f4f6', 
          border: isEnabled ? '1px solid #d1d5db' : '1px solid #e5e7eb', 
          marginRight: '6px',
          cursor: isEnabled ? 'text' : 'not-allowed'
        }}
      />
      <span className="text-xs text-gray-600" style={{ marginRight: '2px', whiteSpace: 'nowrap' }}>
        {t('rooms.allowedExtra')}
      </span>
      <input
        type="number"
        min="0"
        max="2"
        value={maxBeds}
        readOnly
        disabled={!isEnabled}
        style={{ 
          width: '32px', 
          textAlign: 'center', 
          background: '#f3f4f6', 
          border: '1px solid #e5e7eb', 
          marginRight: '6px',
          cursor: 'not-allowed'
        }}
      />
      <span className="text-xs text-gray-600" style={{ marginRight: '2px', whiteSpace: 'nowrap' }}>
        {t('rooms.extraCount')}
      </span>
      <input
        type="number"
        min="0"
        value={reqBeds}
        onChange={(e) => updateExtraBedCount(col, rt.key, parseInt(e.target.value) || 0)}
        disabled={!isEnabled}
        style={{ 
          width: '32px', 
          textAlign: 'center', 
          background: isEnabled ? '#fff' : '#f3f4f6', 
          border: isEnabled ? '1px solid #d1d5db' : '1px solid #e5e7eb', 
          marginRight: '6px',
          cursor: isEnabled ? 'text' : 'not-allowed'
        }}
      />
    </div>
  );
})}
        </div>

        <button
          className="bg-indigo-600 text-white px-10 py-2 rounded-lg mt-3"
          onClick={() => openCalendar(col)}
        >
          {t('date.select')}
        </button>

        <label className="block font-semibold mb-1 mt-2">{t('date.arrival')}</label>
        <input
          readOnly
          value={colData.arrivalDate}
          className="border p-1 rounded w-full bg-gray-50 text-lg"
          placeholder="—"
        />

        {total > 0 && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px' }} className="mt-4">
            <div className="font-semibold">
              {/* RQ_HSM_PR_27_10_25.01 */}
              {t('pricing.total')}: EGP {(total * 3).toFixed(2)}<br />
              {t('pricing.employee')}: ({empContribution > 0 ? empContribution : 60}%) EGP {(employee * 3).toFixed(2)}
            </div>
          </div>
        )}
      </section>
    );
  };

  function getSelectedHotelsData(): { hotelCode: string; hotelName:string; date: string; roomsData: string; }[] {
    const res=[];
    for (const col in columns) {
      const columnData = columns[Number(col)];
      console.log(columnData);
      const selectedHotel = columnData?.selectedHotel;
      
      const hotelName = selectedHotel?.en || selectedHotel?.ar || '';
      
      const date = new Date(columnData?.arrivalDate);
      const dateFormatted = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace(/ /g, ' ').toUpperCase();

      res.push({
        hotelCode: selectedHotel?.id ?? '',
        hotelName: hotelName,
        date: dateFormatted,
        // BUG-PR-AZ-26-10-2025.6 add ${columnData?.extraBedCounts[key]
        //BUG-PR-AZ-23-10-2025.4
        roomsData: Object.entries(columnData?.roomCounts || {}).map(([key, count]) => `${key},${count},${columnData?.extraBedCounts[key]}`).join('|')
      });
    }
    console.log('getSelectedHotelsData:', res);
    return res;
  }

  function getCompanionsFormated(): string {
    const result = selectedCompanions
      .map(item => item.split('|').pop())
      .join('|');
    return result;
  }

  return (
    <div className="bg-gray-100 min-h-screen" dir={isRTL ? 'rtl' : 'ltr'} lang={i18n.language} style={{ fontSize: '16px' }}>
      <header className="bg-white shadow p-4 mb-4">
        <div className="max-w-7xl mx-auto flex items-start justify-between relative">
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <img src="/Logo.png" width="300" height="200" alt="Logo" className="object-contain mx-auto" />
          </div>

          <div className={`${isRTL ? 'text-right ml-auto' : 'text-left mr-auto'}`}>
            <div style={{ display: 'inline-block', textAlign: 'center' }}>
              <div className="text-1.5xl font-extrabold pb-1"
                   style={{ color: '#0F4C9B', borderBottom: '4px solid #0F4C9B', fontFamily: "'GE Hili', sans-serif" }}>
                {t('header.publicRelations')}
              </div>
              <div className="text-1.5xl font-extrabold mt-3"
                   style={{ color: '#0F4C9B', fontFamily: "'GE Hili', sans-serif" }}>
                {t('header.shortTrips')}
              </div>
            </div>
          </div>

          <div>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
              onClick={toggleLanguage}
            >
              {t('header.english')}
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 pb-12">
        <div className="mt-6 mb-2 flex justify-center text-3xl font-bold gap-[300px]">
          <span>{t('employee.name')}: {employeeName}</span>
          <span>{t('employee.id')}: {employeeID}</span>
        </div>

        <div className="mt-4 mb-8">
          <section className="bg-white p-6 rounded-2xl shadow-lg">
            <label className="block font-semibold mb-2">{t('companions.title')} — {t('companions.max')} {maximumNoOfCompanions}</label>
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
          <button onClick={async function() {
            const result = await submitTripFromServer(employeeID, getCompanionsFormated(), getSelectedHotelsData());
            if (result.success) {
              showToast('success', t('success.submitTripTitle'), t('success.submitTrip'));
            } else if (result.errors && result.errors.length > 0) {
              showToast('error', t('validation.correctErrorsTitle'), result.errors.join('\n'));
            } else {
              showToast('error', t('errors.submitErrorTitle'), t('errors.submitError'));
            }
          }} className="w-full bg-green-600 text-white px-8 py-3 rounded-lg text-xl font-bold hover:bg-green-700 transition">
            {t('submit.button')}
          </button>
        </div>
      </main>

      {showHotelPopup && currentColumn !== null && columns[currentColumn].selectedCity && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl p-4 w-full max-w-2xl shadow-lg">
            <div className="flex justify-between mb-3">
              <div className="font-bold text-lg">{t('hotel.selectPopup')}</div>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded"
                onClick={() => setShowHotelPopup(false)}
              >
                {t('hotel.close')}
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {HOTELS[columns[currentColumn].selectedCity]
                .map(h => (
                <button
                  key={h.id}
                  className="block w-full text-left p-3 border rounded mb-2 hover:bg-blue-50"
                  onClick={() => selectHotel(h)}
                >
                  <img
                    src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60"
                    alt={h.en || h.ar}
                    style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
                    className="mb-2"
                  />
                  <strong className="text-lg">{h.en || h.ar}</strong><br />
                  <span className="text-sm text-gray-600">{h.ar || h.en}</span>
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
                  {t('date.prevMonth')}
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
                  {t('date.nextMonth')}
                </button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded"
                  onClick={() => {
                    setShowCalendar(false);
                    setTooltip({ show: false, x: 0, y: 0, content: '' });
                  }}
                >
                  {t('hotel.close')}
                </button>
              </div>
            </div>
            <div style={{ overflowY: 'auto', maxHeight: '500px' }}>
              {renderCalendar()}
            </div>
            <div className="mt-3 text-sm text-gray-600">{t('date.clickToSelect')}</div>
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
            <div className="text-lg font-bold">{t('footer.company')}</div>
            <div className="text-sm text-gray-600">{t('footer.companyAr')}</div>
          </div>
        </div>
      </footer>

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3" style={{ maxWidth: '380px' }}>
        {toasts.map((toast) => {
          const isExiting = exitingToasts.includes(toast.id);
          const styles = {
            success: {
              mainColor: '#10b981',
              lightBg: '#f0fdf4',
              darkText: '#065f46',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              )
            },
            error: {
              mainColor: '#ef4444',
              lightBg: '#fef2f2',
              darkText: '#991b1b',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              )
            },
            warning: {
              mainColor: '#f59e0b',
              lightBg: '#fffbeb',
              darkText: '#92400e',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
              )
            },
            info: {
              mainColor: '#3b82f6',
              lightBg: '#eff6ff',
              darkText: '#1e40af',
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              )
            }
          };
          
          const style = styles[toast.type];
          
          return (
            <div
              key={toast.id}
              style={{
                background: '#ffffff',
                borderRadius: '12px',
                boxShadow: isExiting 
                  ? '0 4px 16px rgba(0, 0, 0, 0.06)' 
                  : '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
                minWidth: '340px',
                maxWidth: '380px',
                animation: isExiting 
                  ? 'toastSlideOut 0.4s cubic-bezier(0.4, 0, 1, 1) forwards' 
                  : 'toastSlideIn 0.5s cubic-bezier(0.34, 1.15, 0.64, 1) forwards',
                position: 'relative',
                overflow: 'hidden',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                transform: isExiting ? 'translateX(0)' : 'translateX(120%)',
                opacity: isExiting ? 1 : 0,
                transition: isExiting ? 'box-shadow 0.3s ease' : 'none'
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: style.mainColor,
                  animation: isExiting ? 'none' : 'accentPulse 0.6s ease-out'
                }}
              />
              
              <div className="flex items-start gap-3" style={{ padding: '16px 16px 16px 20px' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: style.lightBg,
                    color: style.mainColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: `1.5px solid ${style.mainColor}20`,
                    animation: isExiting ? 'none' : 'iconBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                >
                  {style.icon}
                </div>
                
                <div className="flex-1 min-w-0" style={{ paddingTop: '2px' }}>
                  <div 
                    style={{ 
                      fontSize: '14.5px', 
                      lineHeight: '1.4',
                      fontWeight: '600',
                      color: '#111827',
                      marginBottom: '4px',
                      letterSpacing: '-0.01em',
                      animation: isExiting ? 'none' : 'fadeInUp 0.5s ease-out 0.1s backwards'
                    }}
                  >
                    {toast.title}
                  </div>
                  <div 
                    style={{ 
                      fontSize: '13.5px', 
                      lineHeight: '1.5',
                      whiteSpace: 'pre-line',
                      wordBreak: 'break-word',
                      color: '#6b7280',
                      letterSpacing: '-0.005em',
                      animation: isExiting ? 'none' : 'fadeInUp 0.5s ease-out 0.2s backwards'
                    }}
                  >
                    {toast.message}
                  </div>
                </div>
                
                <button
                  onClick={() => dismissToast(toast.id)}
                  className="flex-shrink-0 transition-all duration-150"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#9ca3af',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: '2px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#f3f4f6';
                    e.currentTarget.style.color = '#4b5563';
                    e.currentTarget.style.transform = 'rotate(90deg)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#9ca3af';
                    e.currentTarget.style.transform = 'rotate(0deg)';
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: `${style.mainColor}15`,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: style.mainColor,
                    animation: isExiting ? 'none' : 'toastProgress 5s linear',
                    transformOrigin: 'left',
                    width: isExiting ? '0%' : '100%'
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes toastSlideIn {
          0% {
            transform: translateX(120%) scale(0.9);
            opacity: 0;
          }
          60% {
            transform: translateX(-8px) scale(1);
            opacity: 1;
          }
          80% {
            transform: translateX(4px) scale(1);
          }
          100% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        
        @keyframes toastSlideOut {
          0% {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translateX(120%) scale(0.9);
            opacity: 0;
          }
        }
        
        @keyframes toastProgress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
        
        @keyframes iconBounce {
          0% {
            transform: scale(0) rotate(-180deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.15) rotate(10deg);
          }
          70% {
            transform: scale(0.95) rotate(-5deg);
          }
          100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
          }
        }
        
        @keyframes accentPulse {
          0% {
            transform: scaleY(0);
            opacity: 0;
          }
          50% {
            transform: scaleY(1.1);
            opacity: 1;
          }
          100% {
            transform: scaleY(1);
            opacity: 1;
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default App;