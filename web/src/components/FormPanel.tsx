'use client';

import React from 'react';
import { Printer } from 'lucide-react';
import { DocumentEntry, DocumentType } from '@/types';
import { useStore } from '@/lib/FormgenStore';
import LineItemsTable from './LineItemsTable';

interface FormPanelProps {
  doc: DocumentEntry;
  type: DocumentType;
  onPrint: () => void;
  children?: React.ReactNode; // DocumentTypeTabs を受け取るスロット
}

export default function FormPanel({ doc, type, onPrint, children }: FormPanelProps) {
  const store = useStore();
  const { activeClient, activeProject } = store;

  return (
    <div className="space-y-8 pb-12">
      {/* ヘッダー: 取引先 / 案件 + タブ + 印刷 */}
      <div className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 py-2 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xs text-gray-500" title={activeClient?.name}>
              {activeClient?.name || '取引先未設定'}　{activeClient?.honorific}
            </p>
            <h2 className="truncate text-lg font-bold text-gray-800" title={activeProject?.name}>
              {activeProject?.name || '（無題の案件）'}
            </h2>
          </div>
          <button
            onClick={onPrint}
            className="flex shrink-0 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Printer size={18} />
            印刷・PDF化
          </button>
        </div>
        {children}
      </div>

      {/* 基本情報 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">基本情報</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs text-gray-500">文書番号</label>
            <input
              type="text"
              value={doc.documentNumber}
              onChange={e => store.updateDocument({ documentNumber: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2"
            />
          </div>
          {type !== '見積書' && (
            <div>
              <label className="mb-1 block text-xs text-gray-500">見積書番号</label>
              <input
                type="text"
                value={doc.estimateNumber}
                onChange={e => store.updateDocument({ estimateNumber: e.target.value })}
                placeholder="例: 20260617-001"
                className="w-full rounded-md border border-gray-300 p-2"
              />
            </div>
          )}
          <div className={type !== '見積書' ? 'col-span-2' : ''}>
            <label className="mb-1 block text-xs text-gray-500">日付</label>
            <input
              type="text"
              value={doc.date}
              onChange={e => store.updateDocument({ date: e.target.value })}
              placeholder="例: 2026年6月17日"
              className="w-full rounded-md border border-gray-300 p-2"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-gray-500">ご発注書番号（任意）</label>
            <input
              type="text"
              value={doc.referenceNumber}
              onChange={e => store.updateDocument({ referenceNumber: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2"
            />
          </div>
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-gray-500">有効期限 / 支払条件</label>
            <input
              type="text"
              value={doc.condition}
              onChange={e => store.updateDocument({ condition: e.target.value })}
              className="w-full rounded-md border border-gray-300 p-2"
            />
          </div>
        </div>
        <p className="text-xs text-gray-400">
          宛先と件名は、左のツリーの取引先名・案件名がそのまま使われます。
        </p>
      </section>

      {/* 特記事項 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">特記事項</h3>
        <textarea
          value={doc.notes}
          onChange={e => store.updateDocument({ notes: e.target.value })}
          placeholder="必要に応じて特記事項を入力してください"
          rows={3}
          className="w-full rounded-md border border-gray-300 p-2 text-sm font-sans"
        />
      </section>

      {/* 明細行 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">明細行</h3>
        <LineItemsTable
          key={`${store.ui.activeClientId}-${store.ui.activeProjectId}-${type}`}
          items={doc.items}
          onChange={store.updateItems}
        />
      </section>
    </div>
  );
}
