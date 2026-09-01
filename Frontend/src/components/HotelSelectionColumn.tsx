import { useState, useEffect, useRef, useMemo } from 'react';
import type { TFunction } from 'i18next';
import { getApiBase, getProtocol } from '../config';
import {
  getHotelRoomPricesFromServer,
  getHotelPriceListFromServer,
  type Hotel,
  type RoomType,
  type City,
} from '../services/Services';
import DynamicHotelRoomCards, {
  emptyRoomLine,
  countsToRoomLines,
  aggregateRoomLines,
  type RoomLine,
} from './DynamicHotelRoomCards';

/** Mirrors ColumnState in App.tsx */
export interface HotelColumnState {
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

function formatPriceListNumber(n: number, locale?: string): string {
  return new Intl.NumberFormat(locale || undefined, {
    maximumFractionDigits: 10,
    useGrouping: true,
  }).format(n);
}

function formatPriceListCell(value: unknown, locale?: string): string {
  if (value === null || value === undefined || value === '') return '—';

  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatPriceListNumber(value, locale);
  }
  if (typeof value === 'bigint') {
    return formatPriceListNumber(Number(value), locale);
  }
  if (typeof value === 'string') {
    const t = value.trim();
    if (t === '') return '—';
    if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(t)) {
      const n = Number(t);
      if (Number.isFinite(n)) return formatPriceListNumber(n, locale);
    }
    return value;
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value !== null) {
    if (Array.isArray(value)) {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    const n = Number(value as unknown);
    if (Number.isFinite(n) && !Number.isNaN(n)) {
      return formatPriceListNumber(n, locale);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function priceListCellIsEmpty(value: unknown, locale?: string): boolean {
  const display = formatPriceListCell(value, locale).trim();
  return display === '' || display === '—';
}

function visiblePriceListColumns(rows: Record<string, unknown>[], locale?: string): string[] {
  if (rows.length === 0) return [];
  const keyOrder = Object.keys(rows[0]);
  const allKeys = new Set<string>();
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => allKeys.add(k));
  });
  const ordered = [
    ...keyOrder.filter((k) => allKeys.has(k)),
    ...[...allKeys].filter((k) => !keyOrder.includes(k)),
  ];
  return ordered.filter((col) => rows.some((row) => !priceListCellIsEmpty(row[col], locale)));
}

function priceListColumnKind(col: string): 'numeric' | 'period' | 'text' {
  if (/فترة|PERIOD|DATE|تاريخ/i.test(col)) return 'period';
  if (
    /سعر|PRICE/i.test(col) &&
    !/ROOM_TYPE|ROOM_DESC|نوع الغرفة|TYPE_DESC|LABEL_NAME|SKU_COMBO|فترة/i.test(col)
  ) {
    return 'numeric';
  }
  if (/BED|سرير/i.test(col) && /سعر|PRICE|PR/i.test(col)) return 'numeric';
  return 'text';
}

function priceListThClass(kind: 'numeric' | 'period' | 'text'): string {
  const base =
    'px-3 py-2.5 align-middle text-center font-semibold text-xs leading-snug border border-gray-200 bg-gray-100 whitespace-normal break-words';
  if (kind === 'numeric') return `${base} tabular-nums min-w-[5.5rem]`;
  if (kind === 'period') return `${base} min-w-[9rem] max-w-[16rem]`;
  return `${base} min-w-[12rem] max-w-[22rem]`;
}

function priceListTdClass(kind: 'numeric' | 'period' | 'text'): string {
  const base = 'px-3 py-2.5 align-middle text-center text-sm border border-gray-200';
  if (kind === 'numeric') return `${base} tabular-nums whitespace-nowrap`;
  if (kind === 'period') return `${base} whitespace-normal break-words min-w-[9rem] max-w-[16rem]`;
  return `${base} whitespace-normal break-words min-w-[12rem] max-w-[22rem]`;
}

export interface HotelSelectionColumnProps {
  col: number;
  colData: HotelColumnState;
  readonlyMode: boolean;
  CITIES: City[];
  ROOM_TYPES: RoomType[];
  getArabicOrdinal: (num: number) => string;
  handleCityChange: (col: number, city: string) => void;
  openHotelPopup: (col: number) => void;
  syncRoomAggregates: (
    col: number,
    roomCounts: Record<string, number>,
    extraBedCounts: Record<string, number>
  ) => void;
  openCalendar: (col: number) => void;
  priceFor: (
    hotelId: string,
    roomTypeKey: string,
    dateObj?: Date
  ) => { room_price: number | null; extra_bed_price: string | null };
  showToast: (
    type: 'success' | 'error' | 'warning' | 'info',
    title: string,
    message: string
  ) => void;
  t: TFunction;
  isRTL: boolean;
}

const PRIMARY_BLUE = '#4a6fa5';
const PRIMARY_BLUE_HOVER = '#3a5a8f';

export default function HotelSelectionColumn({
  col,
  colData,
  readonlyMode,
  CITIES,
  ROOM_TYPES,
  getArabicOrdinal,
  handleCityChange,
  openHotelPopup,
  syncRoomAggregates,
  openCalendar,
  priceFor,
  showToast,
  t,
  isRTL,
}: HotelSelectionColumnProps) {
  const priceListLocale = isRTL ? 'ar' : 'en';
  const [showPriceListModal, setShowPriceListModal] = useState(false);
  const [priceListLoading, setPriceListLoading] = useState(false);
  const [priceListRows, setPriceListRows] = useState<Record<string, unknown>[]>([]);

  const priceListColumns = useMemo(
    () => visiblePriceListColumns(priceListRows, priceListLocale),
    [priceListRows, priceListLocale]
  );
  const [roomLines, setRoomLines] = useState<RoomLine[]>([]);
  const lastRoomInitSigRef = useRef('');
  const aggregationKeys = useMemo(() => ROOM_TYPES.map((r) => r.key), [ROOM_TYPES]);

  useEffect(() => {
    const hotelId = colData.selectedHotel?.id ?? '';
    if (!hotelId) {
      lastRoomInitSigRef.current = '';
      setRoomLines([]);
      return;
    }
    const sig = `${hotelId}|${aggregationKeys.join(',')}`;
    if (sig === lastRoomInitSigRef.current) {
      return;
    }
    lastRoomInitSigRef.current = sig;
    const fromCounts = countsToRoomLines(
      colData.roomCounts,
      colData.extraBedCounts,
      aggregationKeys
    );
    setRoomLines(fromCounts.length > 0 ? fromCounts : [emptyRoomLine()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-init only on hotel or RT list changes
  }, [colData.selectedHotel?.id, aggregationKeys]);

  const handleRoomLinesChange = (next: RoomLine[]) => {
    setRoomLines(next);
    if (!colData.selectedHotel || readonlyMode) return;
    const { roomCounts, extraBedCounts } = aggregateRoomLines(next, aggregationKeys);
    syncRoomAggregates(col, roomCounts, extraBedCounts);
  };

  const supportedRoomTypeKeys = colData.selectedHotel?.supportedRoomTypes
    ? colData.selectedHotel.supportedRoomTypes.split(',').map((x) => x.trim()).filter(Boolean)
    : [];

  let hasAnyPrice = false;
  if (colData.selectedHotel && colData.arrivalDate) {
    const dateObj = new Date(colData.arrivalDate);
    ROOM_TYPES.forEach((rt) => {
      const priceData = priceFor(colData.selectedHotel!.id, rt.key, dateObj);
      if (priceData.room_price !== null && priceData.room_price > 0) {
        hasAnyPrice = true;
      }
    });
  }

  const transportDisplay =
    colData.selectedCity && colData.travelAllowance
      ? colData.travelAllowance
      : colData.selectedCity
        ? '--'
        : '';

  const openPriceListModal = async () => {
    if (!colData.selectedHotel) return;
    setShowPriceListModal(true);
    setPriceListLoading(true);
    setPriceListRows([]);
    try {
      const rows = await getHotelPriceListFromServer(
        colData.selectedHotel.id,
        isRTL ? 'ar' : 'en'
      );
      setPriceListRows(Array.isArray(rows) ? rows : []);
    } catch {
      showToast('error', t('errors.fetchHotelRoomPrices'), t('hotel.priceListError'));
      setPriceListRows([]);
    } finally {
      setPriceListLoading(false);
    }
  };

  const hotelImageUrl = (() => {
    if (!colData.selectedHotel) return '';
    const withTypes =
      (colData.selectedHotel as unknown as { hotelPicName?: string; hotelPic?: string }) || {};
    const preferred =
      withTypes.hotelPic && withTypes.hotelPic.trim() !== ''
        ? withTypes.hotelPic
        : withTypes.hotelPicName || '';
    const isHttp = /^https?:\/\//i.test(preferred);
    return preferred
      ? isHttp
        ? preferred
        : `${getProtocol()}://${getApiBase()}/shorttrips/api/hotel-image?path=${encodeURIComponent(preferred)}&v=${Date.now()}`
      : 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60';
  })();

  return (
    <section className="bg-white p-6 rounded-2xl shadow-lg">
      <h2 className="text-xl font-bold mb-3 text-gray-900">
        {t('selection.titlePrefix')} {getArabicOrdinal(col)}: {t('selection.titleSuffix')}
      </h2>

      <select
        className="w-full border border-gray-300 rounded-xl p-3 mb-3 text-lg shadow-sm bg-white"
        value={colData.selectedCity}
        onChange={(e) => handleCityChange(col, e.target.value)}
        disabled={readonlyMode}
      >
        <option value="">{t('city.select')}</option>
        {CITIES.map((city) => (
          <option key={city.code} value={city.name}>
            {city.name}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button
          type="button"
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '0.5rem',
            backgroundColor: readonlyMode ? '#9ca3af' : PRIMARY_BLUE,
            color: 'white',
            border: 'none',
            cursor: readonlyMode ? 'not-allowed' : 'pointer',
            opacity: readonlyMode ? 0.7 : 1,
          }}
          onMouseEnter={(e) => {
            if (!readonlyMode) e.currentTarget.style.backgroundColor = PRIMARY_BLUE_HOVER;
          }}
          onMouseLeave={(e) => {
            if (!readonlyMode) e.currentTarget.style.backgroundColor = PRIMARY_BLUE;
          }}
          onClick={() => openHotelPopup(col)}
          disabled={readonlyMode}
        >
          {t('hotel.select')}
        </button>
        {colData.selectedCity ? (
          <>
            <span className="text-green-700 font-bold text-sm whitespace-nowrap">
              {t('transport.allowance')}
            </span>
            <input
              type="text"
              readOnly
              value={transportDisplay}
              className="min-w-[5rem] px-2 py-1.5 rounded-lg bg-green-50 text-green-800 border border-green-200 text-center font-semibold cursor-not-allowed"
            />
          </>
        ) : null}
      </div>

      {colData.selectedHotel ? (
        <div className="mb-3">
          <img
            src={hotelImageUrl}
            alt={colData.selectedHotel?.en || colData.selectedHotel?.ar || 'hotel'}
            className="w-full h-[120px] object-cover rounded-lg mb-2 border border-gray-100"
            onError={(e) => {
              e.currentTarget.src =
                'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=60';
            }}
          />
          {/* LTR row: price list left, hotel strip right (matches RTL prototype screenshots) */}
          <div className="flex flex-row items-stretch gap-2 w-full" dir="ltr">
            <button
              type="button"
              onClick={openPriceListModal}
              disabled={readonlyMode}
              className="shrink-0 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap text-white disabled:opacity-50 disabled:cursor-not-allowed self-center"
              style={{ backgroundColor: readonlyMode ? '#9ca3af' : '#2b4f7e', border: 'none' }}
              onMouseEnter={(e) => {
                if (!readonlyMode) e.currentTarget.style.backgroundColor = '#1e3d62';
              }}
              onMouseLeave={(e) => {
                if (!readonlyMode) e.currentTarget.style.backgroundColor = '#2b4f7e';
              }}
            >
              {t('hotel.priceListButton')}
            </button>
            <div
              className={`flex-1 min-w-0 text-base font-bold text-blue-700 py-2 px-3 bg-blue-50 rounded-lg border-s-4 border-blue-500 ${isRTL ? 'text-end' : 'text-start'}`}
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div className="break-words">
                {colData.selectedHotel.en || colData.selectedHotel.ar || 'Hotel'}
              </div>
              {(colData.selectedHotel as { desc?: string }).desc?.trim() ? (
                <div className="text-sm font-normal text-gray-600 mt-1">
                  {(colData.selectedHotel as { desc?: string }).desc}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3 text-base font-bold text-blue-700 py-2 px-3 bg-blue-50 rounded-lg border-s-4 border-blue-500">
          {t('hotel.notSelected')}
        </div>
      )}

      {colData.selectedHotel && colData.arrivalDate && !hasAnyPrice && !readonlyMode && !(colData.totalCost || colData.empCost) && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '2px' }}
            >
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

      {colData.selectedHotel ? (
        <div className="mb-4">
          <DynamicHotelRoomCards
            lines={roomLines}
            onLinesChange={handleRoomLinesChange}
            roomTypesMeta={ROOM_TYPES}
            availableRoomTypeKeys={supportedRoomTypeKeys}
            maxExtraBedsPerRoom={colData.maxExtraBeds}
            readonlyMode={readonlyMode}
            i18nPrefix="rooms"
            aggregationKeys={aggregationKeys}
            isRTL={isRTL}
          />
        </div>
      ) : null}

      <button
        type="button"
        className={`w-full px-4 py-3 mb-3 border-2 rounded-xl font-semibold transition ${
          readonlyMode
            ? 'bg-gray-100 border-gray-400 text-gray-500 cursor-not-allowed opacity-60'
            : 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50'
        }`}
        onClick={() => openCalendar(col)}
        disabled={readonlyMode}
      >
        {t('date.select')}
      </button>

      <label className="block font-semibold mb-1 text-gray-800">{t('date.arrival')}</label>
      <input
        readOnly
        value={colData.arrivalDate}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-base mb-2"
        placeholder="—"
        disabled={readonlyMode}
      />

      {colData.totalCost != null && colData.empCost != null && (
        <div
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '8px' }}
          className="mt-4"
        >
          <div className="font-semibold">
            {t('pricing.total')}: EGP {colData.totalCost}
            <br />
            {t('pricing.employee')}: EGP {colData.empCost}
          </div>
        </div>
      )}

      {showPriceListModal && colData.selectedHotel && (
        <div className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 z-[60]" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div
            className="bg-white rounded-2xl p-4 sm:p-5 w-full min-w-0 max-w-[min(96vw,1280px)] shadow-lg max-h-[90vh] flex flex-col min-h-0"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            <div className="flex justify-between items-start gap-2 mb-3 shrink-0">
              <div className="font-bold text-lg leading-tight min-w-0 flex-1 text-start">
                {(colData.selectedHotel.en || colData.selectedHotel.ar) + ' — ' + t('hotel.priceListTitleSuffix')}
              </div>
              <button
                type="button"
                className="shrink-0 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm"
                onClick={() => setShowPriceListModal(false)}
              >
                {t('hotel.close')}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-2 shrink-0">{t('hotel.priceListHint')}</p>
            <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
              {priceListLoading ? (
                <div className="p-6 text-center text-gray-500">{t('hotel.priceListLoading')}</div>
              ) : priceListRows.length === 0 || priceListColumns.length === 0 ? (
                <div className="p-6 text-center text-gray-500">{t('hotel.priceListEmpty')}</div>
              ) : (
                <table className="w-full min-w-max border-collapse table-auto text-gray-900">
                  <thead className="sticky top-0 z-[1] shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                    <tr>
                      {priceListColumns.map((col) => {
                        const kind = priceListColumnKind(col);
                        return (
                          <th key={col} scope="col" className={priceListThClass(kind)}>
                            {col}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {priceListRows.map((row, idx) => (
                      <tr key={idx} className="bg-white even:bg-slate-50/80">
                        {priceListColumns.map((col) => {
                          const kind = priceListColumnKind(col);
                          return (
                            <td key={col} className={priceListTdClass(kind)}>
                              {formatPriceListCell(row[col], priceListLocale)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
