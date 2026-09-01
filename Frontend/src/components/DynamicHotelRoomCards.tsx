/**
 * Prototype-aligned room lines (RTL short-trips flow). Aggregates to keyed roomCounts & extraBedCounts.
 */

import { useTranslation } from 'react-i18next';
import type { RoomType } from '../services/Services';

const DEFAULT_ROOM_ORDER = ['S', 'D', 'T', 'FR', 'FS', 'J'] as const;

export type RoomLine = {
  id: string;
  roomTypeKey: string;
  roomCount: number;
  extraBeds: number;
};

export function makeRoomLineId(): string {
  return `rl_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyRoomLine(): RoomLine {
  return { id: makeRoomLineId(), roomTypeKey: '', roomCount: 1, extraBeds: 0 };
}

export function countsToRoomLines(
  roomCounts: Record<string, number>,
  extraBedCounts: Record<string, number>,
  orderedKeys: string[] = [...DEFAULT_ROOM_ORDER]
): RoomLine[] {
  const lines: RoomLine[] = [];
  orderedKeys.forEach((key) => {
    const c = roomCounts[key] || 0;
    if (c > 0) {
      lines.push({
        id: makeRoomLineId(),
        roomTypeKey: key,
        roomCount: c,
        extraBeds: extraBedCounts[key] || 0,
      });
    }
  });
  return lines;
}

export function aggregateRoomLines(
  lines: RoomLine[],
  orderedKeys: string[] = [...DEFAULT_ROOM_ORDER]
): {
  roomCounts: Record<string, number>;
  extraBedCounts: Record<string, number>;
} {
  const roomCounts: Record<string, number> = {};
  const extraBedCounts: Record<string, number> = {};
  orderedKeys.forEach((k) => {
    roomCounts[k] = 0;
    extraBedCounts[k] = 0;
  });
  for (const line of lines) {
    if (!line.roomTypeKey) continue;
    if (!(line.roomTypeKey in roomCounts)) {
      roomCounts[line.roomTypeKey] = 0;
      extraBedCounts[line.roomTypeKey] = 0;
    }
    roomCounts[line.roomTypeKey] = (roomCounts[line.roomTypeKey] || 0) + line.roomCount;
    extraBedCounts[line.roomTypeKey] = (extraBedCounts[line.roomTypeKey] || 0) + line.extraBeds;
  }
  return { roomCounts, extraBedCounts };
}

function maxExtraForLine(
  roomTypeKey: string,
  roomCount: number,
  perRoomMax: Record<string, number>
): number {
  return (perRoomMax[roomTypeKey] || 0) * Math.max(0, roomCount);
}

interface DynamicHotelRoomCardsProps {
  lines: RoomLine[];
  onLinesChange: (next: RoomLine[]) => void;
  roomTypesMeta: RoomType[];
  /** Empty = all aggregation keys */
  availableRoomTypeKeys: string[];
  maxExtraBedsPerRoom: Record<string, number>;
  readonlyMode: boolean;
  i18nPrefix: string;
  aggregationKeys?: string[];
  isRTL?: boolean;
}

export default function DynamicHotelRoomCards({
  lines,
  onLinesChange,
  roomTypesMeta,
  availableRoomTypeKeys,
  maxExtraBedsPerRoom,
  readonlyMode,
  i18nPrefix,
  aggregationKeys = [...DEFAULT_ROOM_ORDER],
  isRTL = false,
}: DynamicHotelRoomCardsProps) {
  const { t } = useTranslation();

  const tk = (sub: string, opt?: Record<string, unknown>): string =>
    String(t(`${i18nPrefix}.${sub}`, opt as never));

  const selectableKeys =
    availableRoomTypeKeys.length > 0
      ? aggregationKeys.filter((k) => availableRoomTypeKeys.includes(k))
      : [...aggregationKeys];

  const labelForKey = (key: string): string => {
    const nameKey = `${i18nPrefix}.roomTypeNames.${key}`;
    const tr = String(t(nameKey));
    if (tr !== nameKey) return tr;
    const altKey = `${i18nPrefix}.roomTypes.${key}`;
    const tr2 = String(t(altKey));
    if (tr2 !== altKey) return tr2;
    return roomTypesMeta.find((r) => r.key === key)?.ar || key;
  };

  const updateLine = (id: string, patch: Partial<RoomLine>) => {
    const next = lines.map((line) => {
      if (line.id !== id) return line;
      const merged = { ...line, ...patch };
      if (patch.roomTypeKey !== undefined && patch.roomTypeKey !== line.roomTypeKey) {
        merged.extraBeds = 0;
        merged.roomCount = Math.min(Math.max(1, merged.roomCount), 5);
      }
      if (merged.roomTypeKey) {
        const cap = maxExtraForLine(merged.roomTypeKey, merged.roomCount, maxExtraBedsPerRoom);
        merged.extraBeds = Math.max(0, Math.min(merged.extraBeds, cap));
      } else {
        merged.extraBeds = 0;
      }
      merged.roomCount = Math.min(Math.max(1, merged.roomCount), 5);
      return merged;
    });
    onLinesChange(next);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) {
      onLinesChange([emptyRoomLine()]);
      return;
    }
    onLinesChange(lines.filter((l) => l.id !== id));
  };

  const addLine = () => {
    onLinesChange([...lines, emptyRoomLine()]);
  };

  /** Column flex shell so the padded inner row spans full width (row+one child was shrink-wrapping). */
  const stepperShellClass =
    'flex flex-col h-8 min-h-8 w-full min-w-[5.25rem] box-border overflow-hidden rounded-md border border-gray-300 px-2 py-1';
  const stepperRowClass =
    'flex min-h-0 min-w-0 flex-1 w-full flex-row items-center justify-between gap-1.5';
  const stepperBtnClass =
    'inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[11px] font-bold leading-none text-white disabled:opacity-40';

  return (
    <div className="mb-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <label className="block text-sm font-semibold mb-2 text-gray-800">{tk('types')}</label>

      <div className="space-y-3">
        {lines.map((line, index) => {
          const maxPerRoom = line.roomTypeKey ? maxExtraBedsPerRoom[line.roomTypeKey] || 0 : 0;
          const lineMaxExtra = maxExtraForLine(line.roomTypeKey, line.roomCount, maxExtraBedsPerRoom);
          const showMaxBox = !!line.roomTypeKey;

          return (
            <div
              key={line.id}
              className="room-card border border-gray-300 rounded-lg shadow-md p-3 bg-white"
            >
              <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-200">
                <span className="font-bold text-blue-600 text-sm">
                  🛏️ {tk('cardHeading', { n: index + 1 })}
                </span>
                <button
                  type="button"
                  disabled={readonlyMode}
                  className="remove-room-btn px-2 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-semibold flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => removeLine(line.id)}
                >
                  ✕ {tk('deleteLine')}
                </button>
              </div>

              <div className="overflow-x-auto -mx-1 px-1">
                <div
                  className="grid gap-1.5 sm:gap-2 items-end w-full"
                  style={{
                    gridTemplateColumns:
                      'minmax(8rem, 2.6fr) minmax(5.25rem, min-content) minmax(5.25rem, min-content) minmax(2.25rem, max-content)',
                    minWidth: 'min(100%, 40rem)',
                  }}
                >
                  <div className="min-w-0 flex flex-col gap-1">
                    <label className={`text-[11px] font-semibold text-gray-700 ${isRTL ? 'text-end' : 'text-start'}`}>
                      {tk('comboLabel')}
                    </label>
                    <select
                      className={`w-full h-8 box-border border border-gray-300 rounded-md py-1 px-2 text-xs leading-normal bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 ${isRTL ? 'text-end' : 'text-start'}`}
                      value={line.roomTypeKey}
                      disabled={readonlyMode}
                      onChange={(e) => updateLine(line.id, { roomTypeKey: e.target.value })}
                    >
                      <option value="">{tk('selectPlaceholder')}</option>
                      {selectableKeys.map((key) => (
                        <option key={key} value={key}>
                          {labelForKey(key)}
                        </option>
                      ))}
                    </select>
                  </div>

                <div className="min-w-0">
                  <label className={`text-xs font-semibold text-gray-700 block mb-1 ${isRTL ? 'text-end' : 'text-start'}`}>
                    {tk('roomCount')}
                  </label>
                  <div
                    className={`${stepperShellClass} bg-gradient-to-r from-purple-50 to-indigo-50`}
                    dir="ltr"
                    style={{ direction: 'ltr' }}
                  >
                    <div className={stepperRowClass}>
                      <button
                        type="button"
                        disabled={readonlyMode || line.roomCount >= 5}
                        className={`${stepperBtnClass} bg-green-500 hover:bg-green-600`}
                        onClick={() => updateLine(line.id, { roomCount: line.roomCount + 1 })}
                        aria-label="increase"
                      >
                        +
                      </button>
                      <span className="min-w-[1.5rem] flex-1 text-center text-xs font-bold text-gray-800 tabular-nums">
                        {line.roomCount}
                      </span>
                      <button
                        type="button"
                        disabled={readonlyMode || line.roomCount <= 1}
                        className={`${stepperBtnClass} bg-red-500 hover:bg-red-600`}
                        onClick={() => updateLine(line.id, { roomCount: line.roomCount - 1 })}
                        aria-label="decrease"
                      >
                        −
                      </button>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <label className={`text-[11px] font-semibold text-gray-700 block mb-0.5 ${isRTL ? 'text-end' : 'text-start'}`}>
                    {tk('extraBedsStepperLabel')}
                  </label>
                  <div
                    className={`${stepperShellClass} bg-gradient-to-r from-green-50 to-blue-50`}
                    dir="ltr"
                    style={{ direction: 'ltr' }}
                  >
                    <div className={stepperRowClass}>
                      <button
                        type="button"
                        disabled={
                          readonlyMode ||
                          !line.roomTypeKey ||
                          maxPerRoom === 0 ||
                          line.extraBeds >= lineMaxExtra
                        }
                        className={`${stepperBtnClass} bg-green-500 hover:bg-green-600`}
                        onClick={() => updateLine(line.id, { extraBeds: line.extraBeds + 1 })}
                        aria-label="increase"
                      >
                        +
                      </button>
                      <span className="min-w-[1.5rem] flex-1 text-center text-xs font-bold text-gray-800 tabular-nums">
                        {line.extraBeds}
                      </span>
                      <button
                        type="button"
                        disabled={readonlyMode || !line.roomTypeKey || line.extraBeds <= 0}
                        className={`${stepperBtnClass} bg-red-500 hover:bg-red-600`}
                        onClick={() => updateLine(line.id, { extraBeds: line.extraBeds - 1 })}
                        aria-label="decrease"
                      >
                        −
                      </button>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 flex flex-col items-stretch">
                  <label className={`text-[11px] font-semibold text-gray-700 block mb-0.5 cursor-help ${isRTL ? 'text-end' : 'text-start'}`}>
                    {tk('maxLimitLabel')}
                  </label>
                  <div
                    className="box-border mx-auto inline-flex h-7 w-max min-w-[1.75rem] max-w-[3rem] shrink-0 items-center justify-center rounded border border-green-600 bg-green-50 px-1.5 text-center"
                    title={tk('maxExtraBeds')}
                  >
                    <span className="font-bold text-[11px] tabular-nums leading-none text-green-700">
                      {showMaxBox ? maxPerRoom : 0}
                    </span>
                  </div>
                </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-center">
        <button
          type="button"
          disabled={readonlyMode}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold text-white shadow-sm bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={addLine}
        >
          <span className="text-base leading-none opacity-95" aria-hidden>
            ＋
          </span>
          {tk('addRoomType')}
        </button>
      </div>
    </div>
  );
}
