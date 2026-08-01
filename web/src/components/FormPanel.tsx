'use client';

import React from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { DocumentEntry, DocumentType, LineItem, TaxRate } from '@/types';
import { useStore } from '@/lib/FormgenStore';
import { newId } from '@/lib/formgenFile';

interface FormPanelProps {
  doc: DocumentEntry;
  type: DocumentType;
  onPrint: () => void;
  children?: React.ReactNode; // DocumentTypeTabs を受け取るスロット
}

export default function FormPanel({ doc, type, onPrint, children }: FormPanelProps) {
  const store = useStore();
  const { activeClient, activeProject } = store;

  const patchItem = (id: string, field: keyof LineItem, value: string | number) => {
    store.updateItems(items => items.map(item => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const addItem = () => {
    store.updateItems(items => [
      ...items,
      { id: newId('i'), code: '', name: '', quantity: 1, unit: '式', unitPrice: 0, taxRate: 10 },
    ]);
  };

  const removeItem = (id: string) => {
    store.updateItems(items => items.filter(item => item.id !== id));
  };

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

      {/* 明細行 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">明細行</h3>
          <button onClick={addItem} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Plus size={14} /> 追加
          </button>
        </div>

        <div className="space-y-3">
          {doc.items.length === 0 && (
            <p className="rounded-md border border-dashed border-gray-300 py-6 text-center text-xs text-gray-400">
              明細行がありません
            </p>
          )}
          {doc.items.map(item => (
            <div key={item.id} className="group relative rounded-md border border-gray-200 bg-gray-50 p-3">
              <button
                onClick={() => removeItem(item.id)}
                aria-label="この行を削除"
                className="absolute right-2 top-2 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
              >
                <Trash2 size={16} />
              </button>

              <div className="grid grid-cols-12 gap-2 pr-6">
                <div className="col-span-12">
                  <input
                    type="text"
                    placeholder="品名"
                    value={item.name}
                    onChange={e => patchItem(item.id, 'name', e.target.value)}
                    className="w-full rounded border border-gray-300 p-1.5 text-sm"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="text"
                    placeholder="品番(任意)"
                    value={item.code}
                    onChange={e => patchItem(item.id, 'code', e.target.value)}
                    className="w-full rounded border border-gray-300 p-1.5 text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="数量"
                    value={item.quantity}
                    onChange={e => patchItem(item.id, 'quantity', Number(e.target.value))}
                    className="w-full rounded border border-gray-300 p-1.5 text-sm"
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="text"
                    placeholder="単位"
                    value={item.unit}
                    onChange={e => patchItem(item.id, 'unit', e.target.value)}
                    className="w-full rounded border border-gray-300 p-1.5 text-center text-sm"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    inputMode="numeric"
                    placeholder="単価"
                    value={item.unitPrice}
                    onChange={e => patchItem(item.id, 'unitPrice', Number(e.target.value))}
                    className="w-full rounded border border-gray-300 p-1.5 text-right text-sm"
                  />
                </div>
                <div className="col-span-4 flex items-center gap-2">
                  <label className="text-xs text-gray-500">税率</label>
                  <select
                    value={item.taxRate}
                    onChange={e => patchItem(item.id, 'taxRate', Number(e.target.value) as TaxRate)}
                    className="flex-1 rounded border border-gray-300 p-1.5 text-sm"
                  >
                    <option value={10}>10%</option>
                    <option value={8}>8%（軽減）</option>
                    <option value={0}>対象外</option>
                  </select>
                </div>
                <div className="col-span-8 flex items-center justify-end text-sm text-gray-500 tabular-nums">
                  小計 ¥{(item.quantity * item.unitPrice).toLocaleString('ja-JP')}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
