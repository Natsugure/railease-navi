'use client';

import { useState } from 'react';
import { PlatformDisplay } from './PlatformDisplay';
import type { DirectionTabDTO } from '@furatora/platform-diagram/domain';

type Props = {
  tabs: DirectionTabDTO[];
};

export function PlatformTabs({ tabs }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div>
      {/* Tab header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab, i) => (
            <button
              key={tab.directionId ?? 'all'}
              onClick={() => setActiveIndex(i)}
              className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${
                i === activeIndex
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab.directionName}
            </button>
          ))}
        </div>
      </div>

      {/* Active tab platforms */}
      <div className="space-y-4">
        {tabs[activeIndex]?.platforms.map((platform) => (
          <PlatformDisplay key={platform.id} platform={platform} />
        ))}
      </div>
    </div>
  );
}
