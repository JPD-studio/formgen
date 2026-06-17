import React from 'react';
import { DocumentSet } from '@/types';
import { Plus } from 'lucide-react';

interface DocumentSetSelectorProps {
  sets: DocumentSet[];
  activeSetId: string;
  onSelect: (id: string) => void;
  onAddSet: () => void;
}

function setLabel(set: DocumentSet): string {
  const recipient = set.estimate.info.recipientName.replace(/様/g, '').trim();
  const number = set.estimate.info.documentNumber;
  if (!recipient && !number) return '(未入力)';
  if (!recipient) return number;
  return `${recipient} - ${number}`;
}

export default function DocumentSetSelector({ sets, activeSetId, onSelect, onAddSet }: DocumentSetSelectorProps) {
  return (
    <div className="flex items-center gap-1">
      <select
        value={activeSetId}
        onChange={(e) => onSelect(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white max-w-[200px] truncate"
      >
        {sets.map((set, i) => (
          <option key={set.id} value={set.id}>
            #{i + 1} {setLabel(set)}
          </option>
        ))}
      </select>
      <button
        onClick={onAddSet}
        title="新規セットを追加"
        className="flex items-center justify-center w-7 h-7 rounded-md border border-gray-300 bg-white hover:bg-gray-100 text-gray-600 transition"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
