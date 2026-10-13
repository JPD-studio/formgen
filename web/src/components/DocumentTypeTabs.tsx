'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { DOCUMENT_TYPES, Project } from '@/types';
import { useStore } from '@/lib/FormgenStore';

export default function DocumentTypeTabs({ project }: { project: Project }) {
  const store = useStore();
  const activeType = store.ui.activeType;

  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <div className="mt-2 flex items-center justify-between">
      <div className="flex gap-1 flex-wrap">
        {DOCUMENT_TYPES.map(type => {
          const exists = !!project.documents[type];
          const enabled = project.enabledDocumentTypes?.includes(type) ?? true;

          // チェックを外した帳票は、作成済みでもタブから隠す（データは残る）
          if (!enabled) return null;

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

      <div className="relative ml-4">
        <button
          onClick={() => setSettingsOpen(!settingsOpen)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 p-1 rounded hover:bg-gray-100"
          title="表示する帳票を選ぶ"
        >
          表示設定
        </button>

        {settingsOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setSettingsOpen(false)} />
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-gray-200 bg-white p-3 shadow-xl">
              <p className="mb-2 text-xs font-bold text-gray-700">利用する帳票</p>
              <div className="flex flex-col gap-2">
                {DOCUMENT_TYPES.map(type => {
                  const enabled = project.enabledDocumentTypes?.includes(type) ?? true;
                  return (
                    <label key={type} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={e => {
                          const current = project.enabledDocumentTypes ?? [...DOCUMENT_TYPES];
                          const next = e.target.checked
                            ? [...current, type]
                            : current.filter(t => t !== type);
                          const sorted = DOCUMENT_TYPES.filter(t => next.includes(t));
                          if (sorted.length === 0) return; // 最低1つは残す
                          store.updateActiveProject({ enabledDocumentTypes: sorted });
                          // 表示中の帳票を隠したときは、残った帳票へ切り替える
                          if (!e.target.checked && type === activeType) {
                            const existing = sorted.find(t => project.documents[t]);
                            if (existing) store.setActiveType(existing);
                            else store.ensureDocument(sorted[0]);
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      {type}
                    </label>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
