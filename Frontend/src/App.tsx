import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCompanionsFromServer,
  getHotelsFromServer,
  getHotelsByCityFromServer,
  getHotelRoomPricesFromServer,
  getRoomTypesFromServer,
  getTransportOptionsFromServer,
  getTransportAllowanceFromServer,
  getCitiesFromServer,
  Hotel,
  Companion,
  RoomType,
  City,
  getEmployeeNameFromServer,
  getPolicyDataFromServer,
  getLastCompanionsFromServer,
  getLastHotelsFromServer,
  reviewTripAndCalculateCostFromServer,
  checkTripSubmissionFromServer,
  ReviewHotelResult,
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
  totalCost?: number;
  empCost?: number;
}

interface AppProps {
  employeeID: number;
}

// Define types for hotel pricing cache
type RoomPricing = { ROOM_TYPE: string; ROOM_PRICE: number ,EXTRA_BED_PRICE: string };
type PricingPayload = RoomPricing[] | (Record<string, number> & { room_price?: number; extra_bed_price?: number });

// Typed shape for rows returned by P_GET_STRIP_GET_LAST_HOTELS
interface LastHotelRow {
  CITY_CODE?: string;
  CITY_NAME?: string;
  HOTEL_CODE?: string;
  HOTEL_NAME?: string;
  REQ_DATE?: string;
  SELECTED_ROOMS?: string;
  TOTAL_COST?: number | string;
  EMP_COST?: number | string;
  // alternative keys (defensive)
  cityCode?: string;
  hotelCode?: string;
  reqDate?: string;
  selectedRooms?: string;
}

function App({ employeeID }: AppProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  // BUG-AZ-PR-29-10-2025.1: Normalize i18n.language to 'ar'|'en' (e.g., 'en-US' -> 'en')
  // Reason: Backend stored procedures invert language bits and non-exact values defaulted to Arabic
  const currentLang: 'ar' | 'en' = (i18n.language || '').toLowerCase().startsWith('en') ? 'en' : 'ar';

  const [ROOM_TYPES, setROOM_TYPES] = useState<RoomType[]>([]);
  const [HOTELS, setHOTELS] = useState<Record<string, Hotel[]>>({});
  // BUG-AZ-PR-29-10-2025.1: Fixed by AG - Added separate CITIES state to store localized city names
  // Issue: Cities were embedded in HOTELS object keys in Arabic only
  // Solution: Fetch cities separately from /api/cities endpoint with language support
  const [CITIES, setCITIES] = useState<City[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<string[]>([]);
  const [showHotelPopup, setShowHotelPopup] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [COMPANIONS, setCOMPANIONS] = useState<Companion[]>([]);
  const [employeeName, setEmployeeName] = useState<string>('');
  const [maximumNoOfCompanions, setMaximumNoOfCompanions] = useState<number>(0);
  const [maximumNoOfHotels, setMaximumNoOfHotels] = useState<number>(0);
  const [policyStartDate, setPolicyStartDate] = useState<string | null>(null);
  const [policyEndDate, setPolicyEndDate] = useState<string | null>(null);
  // RQ-AZ-PR-31-10-2024.1: empContribution no longer needed - costs come from database via review button
  // const [empContribution, setEmpContribution] = useState<number>(0);
  const [hotelPricingCache, setHotelPricingCache] = useState<Record<string, PricingPayload>>({});
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [exitingToasts, setExitingToasts] = useState<number[]>([]);
  const [readonlyMode, setReadonlyMode] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [/*forceRefresh*/, setForceRefresh] = useState(0);
  const [isReviewSuccessful, setIsReviewSuccessful] = useState(false);


  const dismissToast = useCallback((id: number) => {
    setExitingToasts(prev => [...prev, id]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
      setExitingToasts(prev => prev.filter(toastId => toastId !== id));
    }, 400);
  }, []);

const showToast = useCallback(
  (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      dismissToast(id);
    }, 5000);
  },
  [dismissToast]
);
// BUG-PR-26-10-2025.3: Batch load pricing for entire month to prevent flicker
// Used useCallback instead of useEffect because:
// 1. This function is called from multiple places (useEffect and openCalendar)
// 2. useCallback prevents the function from being recreated on every render
// 3. This ensures the useEffect dependency array works correctly without infinite loops
// 4. Moving it here (before the useEffect that uses it) prevents "used before declaration" errors
const batchLoadMonthPricing = useCallback(async (hotelId: string, year: number, month: number) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pricingPromises = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cacheKey = `${hotelId}_${dateStr}`;
    
    // Check cache directly, not inside setState
    if (!hotelPricingCache[cacheKey]) {
      pricingPromises.push(
        getHotelRoomPricesFromServer(hotelId, dateStr)
          .then(pricing => ({ cacheKey, pricing }))
          .catch(() => null)
      );
    }
  }
  
  const results = await Promise.all(pricingPromises);
  const newCache: Record<string, PricingPayload> = {};
  
  results.forEach(result => {
    if (result) {
      newCache[result.cacheKey] = result.pricing;
    }
  });
  
  if (Object.keys(newCache).length > 0) {
    setHotelPricingCache(prev => ({ ...prev, ...newCache }));
  }
}, [hotelPricingCache]); // Include hotelPricingCache in dependencies

  useEffect(() => {
  // Only run once on mount or when explicitly triggered
  if (initialDataLoaded) return;

    const fetchInitialData = async () => {
      // BUG-AZ-PR-29-10-2025.1: Use normalized 'lang' for all initial API calls
      const lang: 'ar' | 'en' = (i18n.language || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
      const [hotelsData, citiesData, companionsData, roomTypesData, , employeeName, policyData] = await Promise.all([
        getHotelsFromServer(lang),
        getCitiesFromServer(lang),
        getCompanionsFromServer(employeeID, lang),
        getRoomTypesFromServer(),
        getTransportOptionsFromServer(employeeID),
        getEmployeeNameFromServer(employeeID, lang),
        getPolicyDataFromServer(employeeID),
      ]);

      setHOTELS(hotelsData);
      setCITIES(citiesData);
      setROOM_TYPES(Array.isArray(roomTypesData) ? roomTypesData : []);
      setEmployeeName(employeeName)
      setMaximumNoOfCompanions(policyData.maxCompanions || 0)
      setMaximumNoOfHotels(policyData.maxHotels || 0)
      setPolicyStartDate(policyData.startDate)
      setPolicyEndDate(policyData.endDate)
    // setEmpContribution(policyData.empContribution || 0) // No longer needed - costs come from database
    
    const policyEnabled = policyData?.allColumns?.POLICY_STRIP_ENABLED === 1 || policyData?.allColumns?.POLICY_STRIP_ENABLED === '1';
    if (policyEnabled) {
      // Load all companions for checkbox list
      const allComps: Companion[] = Array.isArray(companionsData) ? companionsData as Companion[] : [];
      setCOMPANIONS(allComps);
      
      // Fetch latest submitted selections
      const [lastCompanions, lastHotels] = await Promise.all([
        getLastCompanionsFromServer(employeeID, currentLang),
        getLastHotelsFromServer(employeeID, currentLang)
      ]);
      
      // Build fresh columns with prefilled city/hotel/date/rooms from lastHotels
      const freshColumns: Record<number, ColumnState> = {};
      for (let i = 1; i <= (policyData.maxHotels || 0); i++) {
        freshColumns[i] = {
          selectedCity: '',
          selectedHotel: null,
          travelAllowance: '',
          arrivalDate: '',
          roomCounts: {},
          extraBedCounts: {},
          maxExtraBeds: {},
          totalCost: undefined,
          empCost: undefined
        };
      }
      (lastHotels as LastHotelRow[] || []).forEach((h: LastHotelRow, idx: number) => {
        const colIndex = idx + 1;
        if (!freshColumns[colIndex]) return;
        const cityName = ((citiesData as City[]).find((c: City) => c.code === (h.CITY_CODE || h.cityCode))?.name) || '';
        const hotelList = (hotelsData as Record<string, Hotel[]>)[cityName] || [];
        const selectedHotel = hotelList.find((ht: Hotel) => ht.id === (h.HOTEL_CODE || h.hotelCode)) || null;
        const roomsStr: string = (h.SELECTED_ROOMS || h.selectedRooms || '').toString();
        const roomCounts: Record<string, number> = {};
        const extraBedCounts: Record<string, number> = {};
        if (roomsStr) {
          roomsStr.split('|').map((s: string) => s.trim()).filter(Boolean).forEach((part: string) => {
            const [type, countStr, extraStr] = part.split(',');
            const key = (type || '').trim();
            const count = Number(countStr || 0) || 0;
            const extra = Number(extraStr || 0) || 0;
            if (key) {
              roomCounts[key] = count;
              extraBedCounts[key] = extra;
            }
          });
        }
        const reqDate: string = (h.REQ_DATE || h.reqDate || '').toString().slice(0, 10);
        freshColumns[colIndex] = {
          ...freshColumns[colIndex],
          selectedCity: cityName,
          selectedHotel,
          arrivalDate: reqDate,
          roomCounts,
          extraBedCounts,
          totalCost: h.TOTAL_COST !== undefined ? Number(h.TOTAL_COST) : undefined,
          empCost: h.EMP_COST !== undefined ? Number(h.EMP_COST) : undefined
        };
      });
      setColumns(freshColumns);
      
      // Load transport allowances for each column with a city
      const transportPromises = (lastHotels as LastHotelRow[] || []).map(async (h: LastHotelRow, idx: number) => {
        const colIndex = idx + 1;
        const cityName = ((citiesData as City[]).find((c: City) => c.code === (h.CITY_CODE || h.cityCode))?.name) || '';
        
        if (cityName) {
          try {
            const allowance = await getTransportAllowanceFromServer(employeeID, cityName, currentLang);
            return { colIndex, allowance: allowance?.label || '' };
          } catch (e) {
            console.error('Failed to load transport allowance for city', cityName, e);
            return { colIndex, allowance: '' };
          }
        }
        return { colIndex, allowance: '' };
      });
      
      const transportResults = await Promise.all(transportPromises);
      
      // Update columns with transport allowances
      setColumns(prev => {
        const updated = { ...prev };
        transportResults.forEach(result => {
          if (updated[result.colIndex]) {
            updated[result.colIndex] = {
              ...updated[result.colIndex],
              travelAllowance: result.allowance
            };
          }
        });
        return updated;
      });
      
      // Warm pricing cache for the selected hotel/date pairs to avoid false warnings
      // DO NOT await this - let it run in background
      (lastHotels as LastHotelRow[] || []).forEach((h: LastHotelRow) => {
        const hotelCode = (h.HOTEL_CODE || h.hotelCode);
        const reqDateStr = (h.REQ_DATE || h.reqDate || '').toString().slice(0, 10);
        if (hotelCode && reqDateStr) {
          const d = new Date(reqDateStr);
          if (!isNaN(d.getTime())) {
            // Load pricing in background - don't await
            batchLoadMonthPricing(hotelCode, d.getFullYear(), d.getMonth());
          }
        }
      });
      
      // Pre-check companions from last companions data
      const companionRelIds = (Array.isArray(lastCompanions) ? lastCompanions.map((c: Companion) => c.RELID) : []);
      setCheckedCompanions(companionRelIds);
      
      const preselected = allComps
        .filter(c => companionRelIds.includes(c.RELID))
        .map(c => `${c.rel}|${c.name}|${c.RELID}`);
      setSelectedCompanions(preselected);
      setReadonlyMode(false);
    } else if (policyData?.allColumns?.POLICY_STRIP_ENABLED === 0 || policyData?.allColumns?.POLICY_STRIP_ENABLED === '0') {
      setReadonlyMode(true);
      // Fetch and set last saved data
      const [lastCompanions, lastHotels] = await Promise.all([
        getLastCompanionsFromServer(employeeID, currentLang),
        getLastHotelsFromServer(employeeID, currentLang),
      ]);
      setCOMPANIONS(Array.isArray(lastCompanions) ? lastCompanions : []);
      const checked: string[] = (Array.isArray(lastCompanions) ? lastCompanions.map((c: Companion) => c.RELID) : []);
      setCheckedCompanions(checked);
      setSelectedCompanions([]); // not used in readonly, clear to prevent confusion

      // Prefill columns as a numbered object
      const freshColumns: Record<number, ColumnState> = {};
      ((lastHotels as LastHotelRow[]) || []).forEach((h: LastHotelRow, idx: number) => {
        const colIndex: number = idx + 1;
        const cityName = (citiesData.find((c: City) => c.code === (h.CITY_CODE || h.cityCode))?.name) || '';
        const hotelList = ((hotelsData as Record<string, Hotel[]>)[cityName] as Hotel[]) || [];
        const selectedHotel = hotelList.find((ht: Hotel) => ht.id === (h.HOTEL_CODE || h.hotelCode)) || null;
        const roomsStr: string = (h.SELECTED_ROOMS || h.selectedRooms || '').toString();
        const roomCounts: Record<string, number> = {};
        const extraBedCounts: Record<string, number> = {};
        if (roomsStr) {
          roomsStr.split('|').map((s: string) => s.trim()).filter(Boolean).forEach((part: string) => {
            const [type, countStr, extraStr] = part.split(',');
            const key: string = (type || '').trim();
            const count: number = Number(countStr || 0) || 0;
            const extra: number = Number(extraStr || 0) || 0;
            if (key) {
              roomCounts[key] = count;
              extraBedCounts[key] = extra;
            }
          });
        }
        const reqDate: string = (h.REQ_DATE || h.reqDate || '').toString().slice(0, 10);
        freshColumns[colIndex] = {
          selectedCity: cityName,
          selectedHotel,
          arrivalDate: reqDate,
          roomCounts,
          extraBedCounts,
          travelAllowance: '',
          maxExtraBeds: {},
          totalCost: h.TOTAL_COST !== undefined ? Number(h.TOTAL_COST) : undefined,
          empCost: h.EMP_COST !== undefined ? Number(h.EMP_COST) : undefined
        };
      });
      setColumns(freshColumns);
      
      // Load transport allowances for readonly mode
      const transportPromises = ((lastHotels as LastHotelRow[]) || []).map(async (h: LastHotelRow, idx: number) => {
        const colIndex = idx + 1;
        const cityName = (citiesData.find((c: City) => c.code === (h.CITY_CODE || h.cityCode))?.name) || '';
        
        if (cityName) {
          try {
            const allowance = await getTransportAllowanceFromServer(employeeID, cityName, currentLang);
            return { colIndex, allowance: allowance?.label || '' };
          } catch (e) {
            console.error('Failed to load transport allowance for city in readonly mode', cityName, e);
            return { colIndex, allowance: '' };
          }
        }
        return { colIndex, allowance: '' };
      });
      
      const transportResults = await Promise.all(transportPromises);
      
      // Update columns with transport allowances
      setColumns(prev => {
        const updated = { ...prev };
        transportResults.forEach(result => {
          if (updated[result.colIndex]) {
            updated[result.colIndex] = {
              ...updated[result.colIndex],
              travelAllowance: result.allowance
            };
          }
        });
        return updated;
      });
      
      setCheckedCompanions(checked);
    }
    
    // Mark as loaded at the very end
    setInitialDataLoaded(true);
    };

    fetchInitialData();
  
  // SIMPLIFIED DEPENDENCY ARRAY - only things that should trigger a full reload
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [employeeID, i18n.language, initialDataLoaded]);

  // BUG-AZ-PR-29-10-2025.1: Refresh localized datasets when language changes
  // Reason: Cities list and hotels-by-city keys are language-specific
  useEffect(() => {
    const lang: 'ar' | 'en' = (i18n.language || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
    (async () => {
      try {
        const [hotelsData, citiesData] = await Promise.all([
          getHotelsFromServer(lang),
          getCitiesFromServer(lang)
        ]);
        setHOTELS(hotelsData);
        setCITIES(citiesData);
      } catch (e) {
        console.error('Failed to refresh localized datasets on language change', e);
      }
    })();
  }, [i18n.language]);

  // BUG-AZ-PR-29-10-2025.1: Also refresh companions and employee name on language change
  // Reason: These were loaded only on initial fetch, causing wrong language after toggling
  useEffect(() => {
    const lang: 'ar' | 'en' = (i18n.language || '').toLowerCase().startsWith('en') ? 'en' : 'ar';
    (async () => {
      try {
        const [companions, name] = await Promise.all([
          getCompanionsFromServer(employeeID, lang),
          getEmployeeNameFromServer(employeeID, lang)
        ]);
        setCOMPANIONS(Array.isArray(companions) ? companions : []);
        setEmployeeName(typeof name === 'string' ? name : '');
      } catch (e) {
        console.error('Failed to refresh companions/employee name on language change', e);
      }
    })();
  }, [i18n.language, employeeID]);





  const [currentColumn, setCurrentColumn] = useState<number | null>(null);
  const [calendarColumn, setCalendarColumn] = useState<number | null>(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [tooltip, setTooltip] = useState<{show: boolean, x: number, y: number, content: string}>({
    show: false, x: 0, y: 0, content: ''
  });

  const [columns, setColumns] = useState<Record<number, ColumnState>>({});
  const [checkedCompanions, setCheckedCompanions] = useState<string[]>([]);

  // BUG-PR-26-10-2025.3: Removed useEffect that was recreating all columns unnecessarily
  // when hotelPricingCache or empContribution changed, causing transport allowance flicker
  // The columns now update naturally when their specific data changes

  useEffect(() => {
    if (readonlyMode || maximumNoOfHotels === 0 || Object.keys(columns).length > 0) return;

    const newColumns: Record<number, ColumnState> = {};
    for (let i = 1; i <= maximumNoOfHotels; i++) {
      newColumns[i] = {
        selectedCity: '',
        selectedHotel: null,
        // BUG-PR-26-10-2025.3: Initialize with empty string to prevent transport allowance flicker
        // when transport allowance is being loaded from server
        travelAllowance: '',
        arrivalDate: '',
        roomCounts: {},
        extraBedCounts: {},
        maxExtraBeds: {}
      };
    }
    setColumns(newColumns);
  }, [readonlyMode, maximumNoOfHotels, t, columns]);



// BUG-PR-26-10-2025.3: useEffect for calendar pricing loading
// This useEffect calls batchLoadMonthPricing when calendar is shown and month/year changes
// batchLoadMonthPricing is defined above using useCallback to prevent infinite re-renders
// and ensure stable function reference for the dependency array
useEffect(() => {
  if (showCalendar && calendarColumn !== null) {
    const selectedHotel = columns[calendarColumn]?.selectedHotel;
    if (selectedHotel) {
      batchLoadMonthPricing(selectedHotel.id, calendarYear, calendarMonth);
    }
  }
}, [calendarYear, calendarMonth, showCalendar, calendarColumn, batchLoadMonthPricing, columns]);

  
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
    // Reset review state when companions change
    setIsReviewSuccessful(false);
  };

  

  const handleCityChange = (col: number, city: string) => {
    setIsReviewSuccessful(false); // Clear costs when city changes
    setColumns(prev => ({
      ...prev,
      [col]: {
        ...prev[col],
        selectedCity: city,
        selectedHotel: null,
        // BUG-PR-26-10-2025.3: Set empty string instead of t('transport.none') to prevent flicker
        // when transport allowance is being loaded from server
        travelAllowance: '',
        arrivalDate: '',
        roomCounts: {},
        extraBedCounts: {},
        maxExtraBeds: {},
        totalCost: undefined,
        empCost: undefined
      }
    }));
    // Reset review state when city changes
    setIsReviewSuccessful(false);

    if (city) {
      (async () => {
        try {
          const hotels = await getHotelsByCityFromServer(city, currentLang);
          //console.log('Fetched hotels for city', city, hotels);
          setHOTELS(prev => ({ ...prev, [city]: hotels }));

          const allowance = await getTransportAllowanceFromServer(employeeID, city, currentLang);
          // BUG-PR-26-10-2025.3: Update transport allowance only after successful fetch
          // to prevent flicker during loading
          setColumns(prev => ({
            ...prev,
            [col]: {
              ...prev[col],
              travelAllowance: allowance?.label || ''
            }
          }));
        } catch (e) {
          console.error('Failed to load data for city', city, e);
          // BUG-PR-26-10-2025.3: Set transport allowance to empty string on error
          // to prevent flicker - the UI will not show the section if empty
          setColumns(prev => ({
            ...prev,
            [col]: {
              ...prev[col],
              travelAllowance: ''
            }
          }));
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
      const hotels = await getHotelsByCityFromServer(city, currentLang);
      //console.log('Fetched hotels for city 2', city, hotels);
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
    //console.log('hotel: ',hotel)  
    maxBeds[rt.key] =getMaxAllowedExtrabeds(hotel.supportedRoomExtraBeds,rt.key)!;//Math.floor(Math.random() * 3);
    
    
    // Check if room type is supported AND hotel has room types configured
    const isSupported = hasSupportedRoomTypes && supportedRoomTypes.includes(rt.key);
    
    if (isSupported) {
      // Keep existing counts for supported room types   maxExtraBeds
      //console.log('columns[currentColumn]',columns[currentColumn]);
      //maxBeds[rt.key] = columns[currentColumn].maxExtraBeds[rt.key] || 0;
      resetRoomCounts[rt.key] = columns[currentColumn].roomCounts[rt.key] || 0;
      resetExtraBeds[rt.key] = columns[currentColumn].extraBedCounts[rt.key] || 0;
    } else {
      // Not supported OR hotel has no room types - set to 0
      maxBeds[rt.key] =  0;
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
        extraBedCounts: resetExtraBeds,
        totalCost: undefined,
        empCost: undefined
    }
  }));

  // Reset review state when hotel changes
  setIsReviewSuccessful(false);
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

  
const openCalendar = async (col: number) => {  // ADD async here
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
  
  // ADD THIS - Pre-load pricing data for the entire month when calendar opens
  const selectedHotel = columns[col].selectedHotel;
  if (selectedHotel) {
    const yearToLoad = policyStartDate ? new Date(policyStartDate).getFullYear() : new Date().getFullYear();
    const monthToLoad = policyStartDate ? new Date(policyStartDate).getMonth() : new Date().getMonth();
    
    // Load pricing in background without blocking calendar display
    batchLoadMonthPricing(selectedHotel.id, yearToLoad, monthToLoad);
  }
};

const selectDate = async (dateObj: Date) => {
  //console.log('selectDate called with:', dateObj);
  if (calendarColumn === null) return;
  
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
  const dd = String(dateObj.getDate()).padStart(2, "0");
  const dateStr = yyyy+'-'+mm+'-'+dd;
  
  // Get the CURRENT column's hotel (not from old state)
  const currentColumn = columns[calendarColumn];
  const selectedHotel = currentColumn?.selectedHotel;
  
  //console.log('Calendar column:', calendarColumn);
  //console.log('Current column data:', currentColumn);
  //console.log('Selected hotel:', selectedHotel);
  
  if (!selectedHotel) {
    showToast('warning', t('alerts.selectHotelTitle'), t('alerts.selectHotel'));
    setShowCalendar(false);
    return;
  }
  
  // Load pricing for this specific date if not cached
  const cacheKey = `${selectedHotel.id}_${dateStr}`;
  //console.log('Cache key:', cacheKey);
  //console.log('Cached pricing before fetch:', hotelPricingCache[cacheKey]);
  
  if (!hotelPricingCache[cacheKey]) {
    try {
      //console.log('Fetching pricing for:', selectedHotel.id, dateStr);
      const pricing = await getHotelRoomPricesFromServer(selectedHotel.id, dateStr);
      //console.log('Fetched pricing:', pricing);
      
      setHotelPricingCache(prev => {
        const updated = { ...prev, [cacheKey]: pricing };
       // console.log('Updated cache:', updated);
        return updated;
      });
      
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (e) {
      console.error('Failed to load pricing for date', dateStr, e);
      showToast('error', t('rooms.noPricesTitle'), t('rooms.NotAvailable'));
      setShowCalendar(false);
      return;
    }
  }
  
  // Now update the column with the selected date
  setColumns(prev => {
    const updatedColumn = {
      ...prev[calendarColumn],
      arrivalDate: dateStr,
      totalCost: undefined,
      empCost: undefined
    };
    // Reset review state when date changes
    setIsReviewSuccessful(false);
    
    const resetRoomCounts: Record<string, number> = {};
    const resetExtraBeds: Record<string, number> = {};
    
    // Use the hotel from the current column (already verified above)
      const supportedRoomTypes = selectedHotel.supportedRoomTypes 
        ? selectedHotel.supportedRoomTypes.split(',').map(t => t.trim())
        : [];
      
      const hasSupportedRoomTypes = supportedRoomTypes.length > 0;
      
      ROOM_TYPES.forEach(rt => {
      // Get price using the CORRECT hotel and date
        const price = priceFor(selectedHotel.id, rt.key, dateObj);
      //console.log('Price check for room type:', rt.key, 'Price data:', price);
      
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
    
    updatedColumn.roomCounts = resetRoomCounts;
    updatedColumn.extraBedCounts = resetExtraBeds;
    
    //console.log('Updated column state:', updatedColumn);
    
    return {
      ...prev,
      [calendarColumn]: updatedColumn
    };
  });
  
  setShowCalendar(false);
  setTooltip({ show: false, x: 0, y: 0, content: '' });
};



const updateRoomCount = (col: number, roomKey: string, value: number) => {
  //console.log('updateRoomCount called with value:', value);
    const val = Math.max(0, value);
    setColumns(prev => {
      ///////////////////////////// BUG-AZ-PR-29-10-2025.3
      if(val<prev[col].roomCounts[roomKey]){
        //reset extra bed count if room count decreased below extra bed count
        updateExtraBedCount(col, roomKey, 0);
      }
      //////////////////////////////
      //console.log('Previous state:', prev[col].roomCounts);
      const updated = {
        ...prev,
        [col]: {
          ...prev[col],
          roomCounts: { ...prev[col].roomCounts, [roomKey]: val },
          totalCost: undefined,
          empCost: undefined
        }
      };
      // Reset review state when room count changes
      setIsReviewSuccessful(false);
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
        extraBedCounts: { ...prev[col].extraBedCounts, [roomKey]: val },
        totalCost: undefined,
        empCost: undefined
      }
    }));
    // Reset review state when extra bed count changes
    setIsReviewSuccessful(false);
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
  //console.log(`priceFor hotelId: ${hotelId}, roomTypeKey: ${roomTypeKey}, date: ${dateObj ? dateObj.toISOString().split('T')[0] : 'N/A'}`);
  //console.log('hotelPricing from cache:', hotelPricing);
  if (!hotelPricing) {
    return { room_price: null, extra_bed_price: null }; // No pricing data available
  }

  if (Array.isArray(hotelPricing)) {
    const foundRoom = hotelPricing.find(room => room.ROOM_TYPE === roomTypeKey);

    //console.log('priceFor foundRoom:', foundRoom,typeof foundRoom?.EXTRA_BED_PRICE   );
    //console.log(`typeof foundRoom.ROOM_EXTRABED_PRICE : ${foundRoom?.EXTRA_BED_PRICE}`, typeof foundRoom?.EXTRA_BED_PRICE  );
    return {
      room_price: foundRoom && typeof foundRoom.ROOM_PRICE === 'number' ? foundRoom.ROOM_PRICE : null,
      extra_bed_price: foundRoom ? foundRoom.EXTRA_BED_PRICE : null,      
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
  //console.log(1);
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
//console.log(2);
  // Fetch fresh pricing data for this hotel and date if not cached
  const dateStr = yyyy+'-'+mm+'-'+dd;
  const cacheKey = `${hotelId}_${dateStr}`;

  if (!hotelPricingCache[cacheKey]) {
        setTooltip({ 
      show: true, 
      x: e.clientX, 
      y: e.clientY, 
      content: '<div style="text-align:center;padding:8px;">Loading prices...</div>' 
    });
    return;
  
  }
//console.log(3);
  // Filter room types to only show those with valid non-zero prices
  const roomTypesWithPrices = ROOM_TYPES.filter(rt => {
    const price = priceFor(hotelId, rt.key, dateObj);
    //console.log('Filtering room type:', rt.key, 'with price:', price);
    return price.room_price !== null && price.room_price > 0;
  });

  // Also check extra bed price
  const hotelPricing = hotelPricingCache[cacheKey];
  let extraBedPrice = "0";
  if (hotelPricing && !Array.isArray(hotelPricing) && typeof hotelPricing.extra_bed_price === 'number') {
    extraBedPrice = '"' + hotelPricing.extra_bed_price +'"';
  }

  //console.log(4);
  //console.log('hotelPricing :', hotelPricing);
  //console.log('extraBedPrice fetched for tooltip:', extraBedPrice);
  // If no room types have prices and no extra bed price, don't show tooltip
  if (roomTypesWithPrices.length === 0 && extraBedPrice === "0") {
    setTooltip({ show: false, x: 0, y: 0, content: '' });
    return;
  }
//console.log(5);
  // Build tooltip HTML only for room types with valid non-zero prices
  let html = `<div style="font-weight:700;margin-bottom:6px">${weekdayFull(dateObj.getDay())} — ${localDateStr}</div>`;
  //console.log('roomTypesWithPrices:', roomTypesWithPrices);
  if (roomTypesWithPrices.length > 0) {
    html += `<table style="width:100%;font-size:13px;margin-bottom:6px"><thead><tr>
      <th style="padding:2px 8px">${t('pricing.roomType')}</th>
      <th style="padding:2px 8px">${t('pricing.price')}</th>
    </tr></thead><tbody>`;
    
    roomTypesWithPrices.forEach(rt => {
      const price = priceFor(hotelId, rt.key, dateObj);
      //console.log('price object for room type:', rt.key, price);
      //console.log('price for hotelId:', hotelId, ':rt.key', rt.key);
      //console.log('extraBedPrice price for', rt.key, ':', extraBedPrice , price);
      if (extraBedPrice=="0") //BUG-PR-26-10-2025.5 changed type to string
        extraBedPrice=price.extra_bed_price || "0";
      // Price is guaranteed to be non-null here due to the filter above
      html += `<tr>
        <td style="padding:2px 8px">${getRoomTypeName(rt)}</td>
        <td style="padding:2px 8px;text-align:left">EGP ${price.room_price}</td>
      </tr>`;
    });

    html += `</tbody></table>`;
  }
  //console.log('extraBedPrice in tooltip:', extraBedPrice);
  if (extraBedPrice != "0") {
    //BUG-PR-26-10-2025.5 Fixing extra bed price display in tooltip
    //console.log('Displaying extra bed price in tooltip:', extraBedPrice);
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

  // BUG-AZ-PR-29-10-2025.1: Fixed by AG - Added helper to get localized room type names
  // Issue: Room types were always showing in Arabic from database
  // Solution: Check i18n translations first, fallback to Arabic if translation not found
  const getRoomTypeName = (roomType: RoomType): string => {
    // Try to get translation first, fallback to Arabic name
    const translatedName = t(`rooms.roomTypes.${roomType.key}`);
    if (translatedName && translatedName !== `rooms.roomTypes.${roomType.key}`) {
      return translatedName;
    }
    // Log missing translations for debugging
    //console.log(`Missing translation for room type key: ${roomType.key}, ar: ${roomType.ar}`);
    return roomType.ar; // Fallback to Arabic name
  };

  const renderColumn = (col: number) => {
    const colData = columns[col];

    // RQ-AZ-PR-31-10-2024.1: Removed automatic cost calculation
    // Costs are only shown after clicking review button (from database)
    let hasAnyPrice = false;
    
    if (colData.selectedHotel && colData.arrivalDate) {
      const dateObj = new Date(colData.arrivalDate);

      ROOM_TYPES.forEach(rt => {
        const priceData = priceFor(colData.selectedHotel!.id, rt.key, dateObj);
        // Check if any room type has a valid non-zero price (for warning only)
        // RQ-AZ-PR-31-10-2024.1: No automatic cost calculation - costs come from review button
    if (priceData.room_price !== null && priceData.room_price > 0) {
      hasAnyPrice = true;
    }




    // console.log('readonlyMode:', readonlyMode, colData);
      });
    }


    return (
      <section key={col} className="bg-white p-6 rounded-2xl shadow-lg">
        <h2 className="text-xl font-bold mb-3">
          {t('selection.title')} {getArabicOrdinal(col)}
        </h2>

        <select
          className="w-full border rounded p-3 mb-4 text-lg"
          value={colData.selectedCity}
          onChange={(e) => handleCityChange(col, e.target.value)}
          disabled={readonlyMode}
          
        >
          <option value="">{t('city.select')}</option>
          {/* BUG-AZ-PR-29-10-2025.1: Fixed by AG - Use city.code as key and city.name for display */}
          {CITIES.map(city => (
            <option key={city.code} value={city.name}>{city.name}</option>
          ))}
        </select>
  {/* BUG-PR-26-10-2025.3  Transportation Flicker */}

        <div className="flex items-center gap-3 mb-3">
          <button
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg"
            onClick={() => openHotelPopup(col)}
            disabled={readonlyMode}
          >
            {t('hotel.select')}
          </button>
          {/* BUG-PR-26-10-2025.3: Only show transport allowance when both city and allowance are available
              to prevent flicker during loading */}
          {colData.selectedCity && colData.travelAllowance && (
            <>
              <span style={{ color: '#16a34a', fontWeight: '700', fontSize: '14px' }}>{t('transport.allowance')}</span>
              <input
                type="text"
                readOnly
                value={colData.travelAllowance}
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
            </>
          )}
        </div>

        {colData.selectedHotel && (
          <>
            <img
              src={(() => {
                const withTypes = (colData.selectedHotel as unknown as { hotelPicName?: string; hotelPic?: string }) || {};
                const preferred = (withTypes.hotelPic && withTypes.hotelPic.trim() !== '')
                  ? withTypes.hotelPic
                  : (withTypes.hotelPicName || '');
                const isHttp = /^https?:\/\//i.test(preferred);
                const url = preferred
                  ? (isHttp ? preferred : `/api/hotel-image?path=${encodeURIComponent(preferred)}&v=${Date.now()}`)
                  : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60';
                return url;
              })()}
              alt={colData.selectedHotel?.en || colData.selectedHotel?.ar || 'hotel'}
              style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
              className="mb-2"
              onError={(e) => {
                e.currentTarget.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60';
              }}
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
        {colData.selectedHotel && colData.arrivalDate && !hasAnyPrice && !readonlyMode && !(colData.totalCost || colData.empCost) && (
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
  const maxBeds = (colData.maxExtraBeds?.[rt.key] ?? 0);
  const roomCount = (colData.roomCounts?.[rt.key] ?? 0);
  const reqBeds = (colData.extraBedCounts?.[rt.key] ?? 0);
  
  // Check if this room type is supported by the selected hotel
  const supportedRoomTypes = colData.selectedHotel?.supportedRoomTypes 
    ? colData.selectedHotel.supportedRoomTypes.split(',').map(t => t.trim())
    : [];
  
  const hasSupportedRoomTypes = supportedRoomTypes.length > 0;
  const isSupported = hasSupportedRoomTypes ? supportedRoomTypes.includes(rt.key) : true;
  
  // Check pricing for this room type (only if date is selected)
  let priceData = { room_price: null as number | null, extra_bed_price: null as string | null };
  let hasValidPrice = true; // Assume valid until we check with date
  
  if (colData.selectedHotel && colData.arrivalDate) {
    const dateObj = new Date(colData.arrivalDate);
    priceData = priceFor(colData.selectedHotel.id, rt.key, dateObj);
    //console.log('Room type:', rt.key, 'Price data on date', colData.arrivalDate, ':', priceData);
    hasValidPrice = priceData.room_price !== null && priceData.room_price > 0;
  }
  
  // Room type is enabled if:
  // - Hotel is selected AND (no restriction list or room type is supported)
  // - AND (no date selected OR date selected with valid price)
  const isEnabled = !!colData.selectedHotel && 
                    isSupported && 
                    (!colData.arrivalDate || hasValidPrice);

//{ room_price: number | null, extra_bed_price: string | null } => {

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
        {getRoomTypeName(rt)}
      </span>
      <input
        type="number"
        min="0"
        value={roomCount}
        onChange={(e) => updateRoomCount(col, rt.key, parseInt(e.target.value) || 0)}
        disabled={!isEnabled || readonlyMode}
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
        disabled={!isEnabled || readonlyMode}
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
        disabled={!isEnabled || readonlyMode}
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
          disabled={readonlyMode}
        >
          {t('date.select')}
        </button>

        <label className="block font-semibold mb-1 mt-2">{t('date.arrival')}</label>
        <input
          readOnly
          value={colData.arrivalDate}
          className="border p-1 rounded w-full bg-gray-50 text-lg"
          placeholder="—"
          disabled={readonlyMode}
        />

              {/* RQ-AZ-PR-31-10-2024.1: Only show costs from database after review button */}
              {colData.totalCost != null && colData.empCost != null && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px' }} className="mt-4">
            <div className="font-semibold">
      {t('pricing.total')}: EGP {colData.totalCost}<br />
      {t('pricing.employee')}: EGP {colData.empCost}
            </div>
          </div>
        )}
      </section>
      
    );
    
    
  };

  function validateChoicesOrder(choices: ColumnState[]): { valid: boolean; message: string } {  let foundEmpty = false;
  for (let i = 0; i < choices.length; i++) {
    if (choices[i].selectedCity === '') {
      foundEmpty = true;
    } else if (foundEmpty) {
      // Found a filled element after an empty one
      return { valid: false, message: 'Please fill elements in order' };
    }
  }
  
  return { valid: true, message: 'Valid' };
}
  function getSelectedHotelsData(): { hotelCode: string; hotelName:string; date: string; roomsData: string; }[] {
    const res=[];
    //console.log('getSelectedHotelsData columns:', columns);
    const r= validateChoicesOrder(Object.values(columns));
    //console.log('validateChoicesOrder result:', r);
    if(!r.valid){
      return [];
    }

    for (const col in columns) {
      const columnData = columns[Number(col)];
      //console.log(columnData);
      const selectedHotel = columnData?.selectedHotel;
      
      // Only include columns that have a complete hotel selection (hotel, date, and rooms)
      if (!selectedHotel || !selectedHotel.id) {
        continue; // Skip columns without hotel
      }
      
      // Check if date and rooms are present
      if (!columnData?.arrivalDate || columnData.arrivalDate.trim() === '' || columnData.arrivalDate === 'INVALID DATE') {
        continue; // Skip columns without date
      }
      
      const hasAnyRooms = columnData?.roomCounts && Object.values(columnData.roomCounts).some(count => (count || 0) > 0);
      if (!hasAnyRooms) {
        continue; // Skip columns without rooms
      }
      
      const hotelName = selectedHotel.en || selectedHotel.ar || '';
      
      const date = new Date(columnData.arrivalDate);
      const dateFormatted = date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).replace(/ /g, ' ').toUpperCase();

      res.push({
        hotelCode: selectedHotel.id,
        hotelName: hotelName,
        date: dateFormatted,
        // BUG-PR-AZ-26-10-2025.6 add ${columnData?.extraBedCounts[key]
        //BUG-PR-AZ-23-10-2025.4
        roomsData: Object.entries(columnData.roomCounts || {}).map(([key, count]) => `${key},${count},${columnData?.extraBedCounts[key]}`).join('|')
      });
    }
    //console.log('getSelectedHotelsData:', res);
    return res;
  }

  function getCompanionsFormated(): string {
    const result = selectedCompanions
      .map(item => item.split('|').pop())
      .join('|');
    return result;
  }

  // RQ-AZ-PR-31-10-2024.1: Review Trip and Calculate Cost
  // No validation - just call stored procedures and get costs
  const handleReviewRequest = async () => {
    console.log("handleReviewRequest");
    // If review was already successful, just show costs without re-calculating
    // BUG-AZ-PR-04-11-2025.1: Review Message — remove costs from confirmation message
    // Previously (deleted): Show total/employee costs in the toast when review already succeeded
    // const sum = Object.values(columns).reduce((acc, col) => ({
    //   total: acc.total + (Number(col.totalCost) || 0),
    //   emp: acc.emp + (Number(col.empCost) || 0)
    // }), { total: 0, emp: 0 });
    // const msg = `${t('review.totalCost')}: ${sum.total}` + (sum.emp ? `\n${t('review.employeeCost')}: ${Math.round(sum.emp)}` : '');
    if (isReviewSuccessful) {
      showToast('info', t('review.title'), t('success.readyToSubmit'));
      return;
    }

    // Validate: If city is selected, hotel with date and rooms must be selected
    // If hotel is selected, rooms and date must be selected
    const validationErrors: string[] = [];
    let validHotelsCount = 0;
    
    Object.values(columns).forEach((colData, index) => {
      const columnNumber = index + 1;
      
      // If city is selected, hotel must also be selected
      if (colData.selectedCity && colData.selectedCity.trim() !== '' && !colData.selectedHotel) {
        validationErrors.push(t('validation.cityMissingHotel', { cityName: colData.selectedCity, columnNumber }));
        return; // Skip rest of validation for this column
      }
      
      // If hotel is selected, validate it's complete
      if (colData.selectedHotel) {
        let hasErrors = false;
        
        // Hotel is selected - check if date is filled
        if (!colData.arrivalDate || colData.arrivalDate.trim() === '' || colData.arrivalDate === 'INVALID DATE') {
          const hotelName = colData.selectedHotel?.en || colData.selectedHotel?.ar || `Hotel ${columnNumber}`;
          validationErrors.push(t('validation.hotelMissingDate', { hotelName }));
          hasErrors = true;
        }
        
        // Hotel is selected - check if at least one room is selected
        const hasAnyRooms = colData.roomCounts && Object.values(colData.roomCounts).some(count => (count || 0) > 0);
        if (!hasAnyRooms) {
          const hotelName = colData.selectedHotel?.en || colData.selectedHotel?.ar || `Hotel ${columnNumber}`;
          validationErrors.push(t('validation.hotelEmptyRooms', { hotelName }));
          hasErrors = true;
        }
        
        // If hotel is selected and has no errors, count it as valid
        if (!hasErrors) {
          validHotelsCount++;
        }
      }
    });
    
    // User must enter at least 1 complete option (hotel with date and rooms)
    if (validHotelsCount === 0) {
      if (validationErrors.length > 0) {
        // Show specific validation errors
        showToast('error', t('validation.correctErrorsTitle'), validationErrors.join('\n'));
      } else {
        // No hotels selected at all
        showToast('error', t('validation.correctErrorsTitle'), t('validation.atLeastOneHotelRequired'));
      }
      return;
    }
    
    if (validationErrors.length > 0) {
      showToast('error', t('validation.correctErrorsTitle'), validationErrors.join('\n'));
      return;
    }
    
    // Get hotels and companions data
    const hotels = getSelectedHotelsData();
    const companions = getCompanionsFormated();
    
    if (hotels.length === 0) {
      showToast('error', t('validation.correctErrorsTitle'), t('validation.noHotelsSelected'));
      return;
    }

    showToast('info', t('review.title'), t('review.calculating'));

    // RQ-AZ-PR-31-10-2024.1: Call review trip API (no validation)
    const langForReview = currentLang;
    const result = await reviewTripAndCalculateCostFromServer(
      employeeID,
      companions,
      hotels,
      langForReview
    );

    if (!result.success) {
      setIsReviewSuccessful(false);
      showToast('error', t('validation.correctErrorsTitle'), result.message || 'Failed to review trip');
      return;
    }

    // Update columns with costs returned from review
    if (result.hotels && result.hotels.length > 0) {
      setColumns(prev => {
        const updated = { ...prev };
        result.hotels.forEach((hotelResult: ReviewHotelResult, idx: number) => {
          const colIndex = idx + 1;
          if (updated[colIndex]) {
            updated[colIndex] = {
              ...updated[colIndex],
              totalCost: hotelResult.totalCost,
              empCost: hotelResult.empCost
            };
          }
        });
        return updated;
      });
    }

    // BUG-AZ-PR-04-11-2025.1: Review Message — remove costs from confirmation message
    // Previously (deleted): Show aggregated total/employee costs in the success toast
    // const totals = result.hotels.reduce((acc, h) => ({
    //   total: acc.total + (h.totalCost || 0),
    //   emp: acc.emp + (h.empCost || 0)
    // }), { total: 0, emp: 0 });
    // const costInfo = totals.total > 0
    //   ? `\n${t('review.totalCost')}: ${totals.total}` + (totals.emp > 0 ? `\n${t('review.employeeCost')}: ${Math.round(totals.emp)}` : '')
    //   : '';
    // showToast('success', t('review.title'), `${t('success.readyToSubmit')}${costInfo}`);
    // Enable submit button on successful review
    setIsReviewSuccessful(true);
    showToast('success', t('review.title'), t('success.readyToSubmit') || 'Trip reviewed');
  };

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
      <div className="mt-6 mb-2 employee-info-header">
      <span>{t('employee.name')}: {employeeName}</span>
          <span>{t('employee.id')}: {employeeID}</span>
        </div>

        <div className="mt-4 mb-8">
          <section className="bg-white p-6 rounded-2xl shadow-lg">
            <label className="block font-semibold mb-2">{t('companions.title')} — {t('companions.max')} {maximumNoOfCompanions}</label>
            <div className="grid grid-cols-4 gap-2">
            {COMPANIONS.slice(0, 12).map((c: Companion, i: number) => {
                const companionValue = `${c.rel}|${c.name}|${c.RELID}`;
                  const isChecked = readonlyMode 
    ? checkedCompanions.includes(String(c.RELID))
    : selectedCompanions.includes(companionValue);

                return (
                  <div key={`companion-${c.RELID}-${i}`} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                    checked={isChecked}
                      onChange={(e) => handleCompanionChange(companionValue, e.target.checked)}
                      style={{ width: '20px', height: '20px' }}
                    disabled={readonlyMode}
                    />
                  <span> {c.rel} — {c.name} </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="hotels-grid">
          {Object.keys(columns).map(colKey => renderColumn(Number(colKey)))}
        </div>

        <div className="flex gap-4 mt-8 mb-1 w-full" style={{ backgroundColor: '#F8F8F8', padding: '16px', borderRadius: '8px' }}>
          <button 
            onClick={handleReviewRequest}
            disabled={readonlyMode}
            className="flex-1"
            style={{
              backgroundColor: '#007BFF',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              border: 'none',
              cursor: readonlyMode ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(0, 123, 255, 0.3)',
              transition: 'all 0.3s ease',
              opacity: readonlyMode ? 0.6 : 1,
              fontFamily: 'inherit',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              if (!readonlyMode) {
                e.currentTarget.style.backgroundColor = '#0056b3';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!readonlyMode) {
                e.currentTarget.style.backgroundColor = '#007BFF';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 123, 255, 0.3)';
              }
            }}
          >
            {t('review.button')}
          </button>
          <button 
            onClick={async function() {
              // RQ-AZ-PR-31-10-2024.1: Submit - call P_STRIP_SUBMIT_CHECK
              const result = await checkTripSubmissionFromServer(employeeID, currentLang);
              
            if (result.success) {
                showToast('success', t('success.submitTripTitle'), t('success.submitTrip'));
                // Reset review state after successful submission
                setIsReviewSuccessful(false);
                // Force refresh the data from server
                setInitialDataLoaded(false); // This will trigger the useEffect to run again
                setForceRefresh(prev => prev + 1);
            } else {
                // Show error message from stored procedure
                showToast('error', t('errors.submitErrorTitle'), result.message || t('errors.submitError'));
                // Reset review state if submission fails
                setIsReviewSuccessful(false);
              }
            }} 
            disabled={readonlyMode || !isReviewSuccessful}
            className="flex-1"
            style={{
              backgroundColor: '#28A745',
              color: 'white',
              padding: '16px 24px',
              borderRadius: '12px',
              fontSize: '18px',
              fontWeight: '600',
              border: 'none',
              cursor: (readonlyMode || !isReviewSuccessful) ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 8px rgba(40, 167, 69, 0.3)',
              transition: 'all 0.3s ease',
              opacity: (readonlyMode || !isReviewSuccessful) ? 0.6 : 1,
              fontFamily: 'inherit',
              width: '100%'
            }}
            onMouseEnter={(e) => {
              if (!readonlyMode && isReviewSuccessful) {
                e.currentTarget.style.backgroundColor = '#218838';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!readonlyMode && isReviewSuccessful) {
                e.currentTarget.style.backgroundColor = '#28A745';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(40, 167, 69, 0.3)';
              }
            }}
          >
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
                  disabled={readonlyMode}
                >
<img
  src={(() => {
    const withTypes = (h as unknown as { hotelPicName?: string; hotelPic?: string });
    // Prefer full absolute path from DB when available; fallback to filename
    const preferred = (withTypes.hotelPic && withTypes.hotelPic.trim() !== '')
      ? withTypes.hotelPic
      : (withTypes.hotelPicName || '');
    const isHttp = /^https?:\/\//i.test(preferred);
    const safe = preferred
      ? (isHttp
          ? `${preferred}`
          : `/api/hotel-image?path=${encodeURIComponent(preferred)}&v=${Date.now()}`)
      : '';
    const url = safe || "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60";
    console.log('Image URL:', url);
    return url;
  })()}
  alt={h.en || h.ar}
  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px' }}
  className="mb-2"
  onError={(e) => {
    const withTypes = (h as unknown as { hotelPicName?: string; hotelPic?: string });
    console.log('Image failed to load:', withTypes.hotelPic || withTypes.hotelPicName || '');
    e.currentTarget.src = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60";
  }}
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
                  disabled={readonlyMode}
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
                  disabled={readonlyMode}
                >
                  {t('date.nextMonth')}
                </button>
                <button
                  className="px-4 py-2 bg-red-600 text-white rounded"
                  onClick={() => {
                    setShowCalendar(false);
                    setTooltip({ show: false, x: 0, y: 0, content: '' });
                  }}
                  disabled={readonlyMode}
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
/* FORCE everything to fit screen */
* {
  box-sizing: border-box;
}

html, body {
  overflow-x: hidden !important;
  max-width: 100vw !important;
  width: 100% !important;
}

/* Force all containers to respect viewport */
.bg-gray-100,
header,
main,
footer,
section {
  max-width: 100vw !important;
  width: 100% !important;
  overflow-x: hidden !important;
}

/* Employee Info Header - SIMPLIFIED */
.employee-info-header {
  display: flex;
  justify-content: space-around;
  font-size: 1.5rem;
  font-weight: 700;
  gap: 2rem;
  flex-wrap: wrap;
  padding: 0 1rem;
}

/* Hotels Grid - FORCE single column on mobile */
.hotels-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  width: 100%;
}

/* Companions grid */
.companions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

/* Calendar grid */
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  width: 100%;
  min-width: 100%;
}

/* Header container */
.header-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* Action buttons container */
.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 2rem;
}

/* Room inputs */
.room-inputs {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

/* Modal container */
.modal-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
}

/* Toast container */
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 50;
}

/* ===== TOAST ANIMATIONS ===== */
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

/* ===== MOBILE RESPONSIVE STYLES ===== */
@media (max-width: 768px) {
  /* Employee Info Header */
  .employee-info-header {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    font-size: 1rem;
    text-align: center;
    padding: 0 0.5rem;
  }

  /* Hotels Grid */
  .hotels-grid {
    grid-template-columns: 1fr !important;
    gap: 1rem;
    padding: 0 0.5rem;
  }

  /* Companions grid */
  .companions-grid {
    grid-template-columns: 1fr !important;
    font-size: 0.875rem;
    gap: 0.75rem;
  }

  /* Section cards */
  section.bg-white {
    padding: 1rem !important;
    margin: 0.5rem !important;
    border-radius: 0.5rem;
  }
  
  section.bg-white h2 {
    font-size: 1.125rem !important;
    margin-bottom: 1rem;
  }
  
  section.bg-white h3 {
    font-size: 1rem !important;
    margin-bottom: 0.75rem;
  }
  
  section.bg-white select {
    font-size: 0.875rem !important;
    padding: 0.625rem !important;
    width: 100%;
  }
  
  section.bg-white button {
    font-size: 0.875rem !important;
    padding: 0.625rem 1rem !important;
    white-space: nowrap;
  }
  
  /* Ensure proper spacing for room sections */
  section.bg-white > div {
    margin-bottom: 1rem;
  }
  
  section.bg-white > div:last-child {
    margin-bottom: 0;
  }

  /* Room inputs */
  .room-inputs {
    font-size: 0.813rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
  }
  
  .room-inputs > div {
    display: grid;
    grid-template-columns: 100px 60px 1fr 60px 1fr;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 48px;
  }
  
  .room-inputs input {
    width: 48px !important;
    height: 40px !important;
    font-size: 0.875rem;
    text-align: center;
    justify-self: center;
  }
  
  .room-inputs span,
  .room-inputs label {
    font-size: 0.875rem;
    line-height: 1.3;
  }
  
  /* Room type labels - fixed width for perfect alignment */
  .room-inputs > div > *:first-child {
    width: 100px;
    text-align: right;
    padding-right: 0.5rem;
  }
  
  /* Center align the input numbers */
  .room-inputs > div > *:nth-child(2),
  .room-inputs > div > *:nth-child(4) {
    justify-self: center;
    text-align: center;
  }
  
  /* Right align the labels */
  .room-inputs > div > *:nth-child(3),
  .room-inputs > div > *:nth-child(5) {
    text-align: right;
    padding-right: 0.5rem;
  }
  
  /* Room type section title */
  .room-inputs .font-medium,
  .room-inputs > h3,
  .room-inputs > div > .font-medium {
    font-size: 0.938rem !important;
    margin-bottom: 0.5rem;
    display: block;
    width: 100%;
    grid-column: 1 / -1;
    text-align: right;
  }

  /* Action buttons */
  .action-buttons {
    flex-direction: column !important;
    gap: 0.75rem !important;
    padding: 0 0.5rem;
  }
  
  .action-buttons button {
    font-size: 1rem !important;
    padding: 0.75rem 1rem !important;
    width: 100%;
  }

  /* Header */
  .header-container {
    flex-direction: column !important;
    align-items: center !important;
    gap: 1rem !important;
    padding: 1rem 0.5rem;
  }
  
  .header-center {
    position: relative !important;
    left: auto !important;
    transform: none !important;
    text-align: center;
    order: -1;
  }
  
  header img {
    max-width: 180px !important;
    height: auto !important;
  }
  
  .header-title {
    font-size: 0.875rem !important;
    text-align: center;
  }

  /* Calendar */
  .calendar-grid {
    gap: 3px;
    padding: 0 !important;
    margin: 0 !important;
    min-width: 100%;
  }
  
  .calendar-grid > div {
    min-height: 75px !important;
    height: auto !important;
    padding: 8px 3px !important;
    font-size: 0.875rem !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: visible !important;
    min-width: 0;
  }
  
  .calendar-grid button {
    font-size: 1rem !important;
    padding: 12px 4px !important;
    min-height: 52px !important;
    height: auto !important;
    width: 100% !important;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    white-space: normal;
    line-height: 1.3;
    word-wrap: break-word;
  }
  
  /* Calendar day headers */
  .calendar-grid > div:nth-child(-n+7) {
    font-weight: 700;
    font-size: 0.875rem !important;
    min-height: 48px !important;
    padding: 10px 3px !important;
    background-color: rgba(0, 0, 0, 0.02);
  }
  
  /* Calendar container responsiveness */
  .calendar-grid {
    overflow-x: auto !important;
    -webkit-overflow-scrolling: touch;
    scroll-behavior: smooth;
  }
  
  /* Ensure calendar parent containers don't compress */
  section:has(.calendar-grid) {
    padding: 1rem 0.5rem !important;
    overflow-x: visible !important;
    overflow-y: visible !important;
  }
  
  /* Calendar text wrapping for Arabic */
  .calendar-grid button > * {
    display: block;
    width: 100%;
    text-align: center;
  }

  /* Modals */
  .modal-container .bg-white {
    max-width: 95vw !important;
    max-height: 90vh !important;
    margin: 1rem !important;
    width: 100% !important;
  }

  /* Toasts */
  .toast-container {
    left: 0.5rem !important;
    right: 0.5rem !important;
    bottom: 0.5rem !important;
  }
  
  .toast-container > div {
    min-width: 100% !important;
    max-width: 100% !important;
    width: 100%;
  }

  /* Footer */
  footer img {
    width: 48px !important;
    height: 48px !important;
  }
  
  footer .text-lg {
    font-size: 0.875rem !important;
  }
}

/* Medium screens (tablets) */
@media (max-width: 1200px) and (min-width: 769px) {
  .hotels-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .companions-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Prevent horizontal scrolling on all devices */
@media (max-width: 480px) {
  html, body {
    overflow-x: hidden !important;
  }
  
  main, .container, .mx-auto {
    padding-left: 0.25rem !important;
    padding-right: 0.25rem !important;
  }
}
      `}</style>

        
    </div>
  );
}

export default App;

// function getValueByKey(data:any, key:any): number {
//   // Split the string by comma to get individual pairs
//   const pairs = data.split(',');
  
//   // Loop through each pair
//   for (let pair of pairs) {
//     // Split by colon to get key and value
//     const [k, v] = pair.split(':');
    
//     // If the key matches, return the value as a number
//     if (k === key) {
//       return parseInt(v);
//     }
//   }
  
//   // If key not found, return 0
//   return 0;
// }
function getMaxAllowedExtrabeds(supportedRoomExtraBeds: string | undefined, roomTybe: string): number {
  //console.log('supportedRoomExtraBeds:', supportedRoomExtraBeds ,'roomTybe: ' , roomTybe);
  // Split the string by comma to get individual pairs
  const pairs = supportedRoomExtraBeds?.split(',') ?? [];
  
  // Loop through each pair
  for (const pair of pairs) {
    // Split by colon to get key and value
    const [k, v] = pair.split(':');
    
    // If the key matches, return the value as a number
    if (k === roomTybe) {
      return parseInt(v);
    }
  }
  
  // If key not found, return 0
  return 0;
//  return Math.floor(Math.random() * 3);
}
