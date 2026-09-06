'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { LineAccordion } from './LineAccordion';
import type { OperatorWithLines } from '@/types';

type Props = {
  operators: OperatorWithLines[];
};

export function OperatorList({ operators }: Props) {
  const [expandedOperator, setExpandedOperator] = useState<string | null>(
    operators.length === 1 ? (operators[0]?.id ?? null) : null
  );

  return (
    <div className="space-y-3">
      {operators.map((operator) => (
        <div
          key={operator.id}
          className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <button
            onClick={() =>
              setExpandedOperator(
                expandedOperator === operator.id ? null : operator.id
              )
            }
            className="w-full px-5 py-4 text-left flex justify-between items-center hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-base text-gray-900">
              {operator.name}
            </span>
            <ChevronDown
              size={20}
              className={`text-gray-400 transition-transform duration-200 ${
                expandedOperator === operator.id ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedOperator === operator.id && (
            <div className="px-4 pb-3 border-t border-gray-100">
              {operator.lines.length > 0 ? (
                operator.lines.map((line) => (
                  <LineAccordion key={line.id} line={line} />
                ))
              ) : (
                <p className="text-gray-500 text-sm py-3">路線がありません</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
