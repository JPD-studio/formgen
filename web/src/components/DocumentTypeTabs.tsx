'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { DOCUMENT_TYPES, Project } from '@/types';
import { useStore } from '@/lib/FormgenStore';

export default function DocumentTypeTabs({ project }: { project: Project }) {
  const store = useStore();
  const activeType = store.ui.activeType;

  return (
    <div className="mt-2 flex gap-1">
      {DOCUMENT_TYPES.map(type => {
        const exists = !!project.documents[type];
        const active = activeType === type && exists;
        return (
          <button
            key={type}
            onClick={() => (exists ? store.setActiveType(type) : store.ensureDocument(type))}
            title={exists ? type : `${type}を作成`}
            className={[
              'flex items-center gap-1 rounded-md border px-3 py-1 text-sm transition-colors',
              active
                ? 'border-blue-600 bg-blue-600 text-white'
                : exists
                  ? 'border-blue-300 bg-white text-blue-600 hover:bg-blue-50'
                  : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600',
            ].join(' ')}
          >
            {!exists && <Plus size={12} />}
            {type}
          </button>
        );
      })}
    </div>
  );
}
