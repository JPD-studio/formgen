import React from 'react';
import { DocumentType } from '@/types';
import { Plus } from 'lucide-react';

interface DocumentTypeTabsProps {
  activeType: DocumentType;
  hasInvoice: boolean;
  hasDelivery: boolean;
  onSwitch: (type: DocumentType) => void;
}

const TABS: { type: DocumentType; label: string }[] = [
  { type: '見積書', label: '見積書' },
  { type: '請求書', label: '請求書' },
  { type: '納品書', label: '納品書' },
];

export default function DocumentTypeTabs({ activeType, hasInvoice, hasDelivery, onSwitch }: DocumentTypeTabsProps) {
  function isGenerated(type: DocumentType): boolean {
    if (type === '見積書') return true;
    if (type === '請求書') return hasInvoice;
    return hasDelivery;
  }

  return (
    <div className="flex gap-1 mt-2">
      {TABS.map(({ type, label }) => {
        const active = type === activeType;
        const generated = isGenerated(type);
        return (
          <button
            key={type}
            onClick={() => onSwitch(type)}
            className={[
              'flex items-center gap-1 px-3 py-1 text-sm rounded-md border transition-colors',
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : generated
                ? 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50 hover:text-gray-600',
            ].join(' ')}
          >
            {!generated && <Plus size={12} />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
