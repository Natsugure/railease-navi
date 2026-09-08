'use client';

import { useState } from 'react';
import type { StrollerDifficulty, WheelchairDifficulty } from '@furatora/database/enums';
import {
  STROLLER_DIFFICULTY_META,
  WHEELCHAIR_DIFFICULTY_META,
} from '@/constants/difficulty';

export type TransferConnection = {
  lineName: string;
  lineColor: string | null;
  strollerDifficulty: StrollerDifficulty | null;
  wheelchairDifficulty: WheelchairDifficulty | null;
  notesAboutStroller: string | null;
  notesAboutWheelchair: string | null;
};

type Props = {
  connections: TransferConnection[];
};

export function TransferDifficultySection({ connections }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (connections.length === 0) return null;

  // connections が縮んで selectedIndex が範囲外になっても先頭にフォールバックする
  const selected = connections[selectedIndex] ?? connections[0];
  if (!selected) return null;

  const strollerMeta = selected.strollerDifficulty
    ? STROLLER_DIFFICULTY_META[selected.strollerDifficulty]
    : null;
  const wheelchairMeta = selected.wheelchairDifficulty
    ? WHEELCHAIR_DIFFICULTY_META[selected.wheelchairDifficulty]
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        バリアフリールート整備状況
      </h2>

      {/* 路線ドロップダウン */}
      {connections.length > 1 ? (
        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">乗換先路線</label>
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            {connections.map((conn, i) => (
              <option key={i} value={i}>
                {conn.lineName}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2">
          {selected.lineColor && (
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: selected.lineColor }}
            />
          )}
          <span className="text-sm font-medium text-gray-700">{selected.lineName}</span>
        </div>
      )}

      {/* 難易度表示 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* ベビーカー */}
        <div className="rounded-lg border border-gray-100 p-3" style={{ backgroundColor: '#FCE4EC' }}>
          <p className="text-xs font-semibold text-gray-600 mb-2">ベビーカー</p>
          {strollerMeta ? (
            <div className="flex items-start gap-2">
              <span
                className="flex-shrink-0 mt-0.5"
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 20,
                  backgroundColor: strollerMeta.iconColorHex,
                  WebkitMaskImage: `url(${strollerMeta.iconPath})`,
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskImage: `url(${strollerMeta.iconPath})`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                }}
              />
              <p className="text-xs text-gray-700 leading-snug">{strollerMeta.label}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">情報なし</p>
          )}
          {selected.notesAboutStroller && (
            <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-pink-200 whitespace-pre-wrap">
              {selected.notesAboutStroller}
            </p>
          )}
        </div>

        {/* 車いす */}
        <div className="rounded-lg border border-gray-100 p-3" style={{ backgroundColor: '#E3F2FD' }}>
          <p className="text-xs font-semibold text-gray-600 mb-2">車いす</p>
          {wheelchairMeta ? (
            <div className="flex items-start gap-2">
              <span
                className="flex-shrink-0 mt-0.5"
                style={{
                  display: 'inline-block',
                  width: 20,
                  height: 20,
                  backgroundColor: wheelchairMeta.iconColorHex,
                  WebkitMaskImage: `url(${wheelchairMeta.iconPath})`,
                  WebkitMaskSize: 'contain',
                  WebkitMaskRepeat: 'no-repeat',
                  maskImage: `url(${wheelchairMeta.iconPath})`,
                  maskSize: 'contain',
                  maskRepeat: 'no-repeat',
                }}
              />
              <p className="text-xs text-gray-700 leading-snug">{wheelchairMeta.label}</p>
            </div>
          ) : (
            <p className="text-xs text-gray-500 italic">情報なし</p>
          )}
          {selected.notesAboutWheelchair && (
            <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-blue-200 whitespace-pre-wrap">
              {selected.notesAboutWheelchair}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
