'use client';

import React, { useRef } from 'react';
import { AlertTriangle, CalendarDays, Lock, LockOpen, Printer, RefreshCw } from 'lucide-react';
import { DocumentEntry, DocumentType } from '@/types';
import { useStore } from '@/lib/FormgenStore';
import { differsFromEstimate } from '@/lib/documentUtils';
import LineItemsTable from './LineItemsTable';

interface FormPanelProps {
  doc: DocumentEntry;
  type: DocumentType;
  onPrint: () => void;
  children?: React.ReactNode; // DocumentTypeTabs を受け取るスロット
}

/** 「2026年11月3日」→「2026-11-03」（解釈できなければ空文字） */
function toIsoDate(text: string): string {
  const m = text.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return '';
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

/** 「2026-11-03」→「2026年11月3日」 */
function fromIsoDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 手入力もできる日付欄。右のボタンでカレンダーから選べる */
function DateField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const pickerRef = useRef<HTMLInputElement>(null);
  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };
  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 p-2 pr-10"
      />
      <button
        type="button"
        onClick={openPicker}
        title="カレンダーから選ぶ"
        aria-label="カレンダーから日付を選ぶ"
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-400 hover:text-blue-600"
      >
        <CalendarDays size={18} />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={toIsoDate(value)}
        onChange={e => e.target.value && onChange(fromIsoDate(e.target.value))}
        className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}

export default function FormPanel({ doc, type, onPrint, children }: FormPanelProps) {
  const store = useStore();
  const { activeClient, activeProject } = store;

  // 請求書・納品書などが、見積書の最新内容とずれているときに知らせる
  const estimate = activeProject?.documents['見積書'];
  const locked = !!doc.locked;
  const outOfSync = type !== '見積書' && !!estimate && !locked && differsFromEstimate(doc, estimate);

  const handleRegenerate = () => {
    if (!window.confirm(`${type}の明細を見積書の最新内容で作り直します。\n現在の明細の編集内容は失われます（日付・番号・特記事項は変わりません）。よろしいですか？`)) return;
    store.regenerateFromEstimate();
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
          <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => store.updateDocument({ locked: !locked })}
            title={locked ? 'ロックを解除して編集できるようにする' : 'ロックして誤編集を防ぐ'}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              locked
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {locked ? <Lock size={16} /> : <LockOpen size={16} />}
            {locked ? 'ロック中' : 'ロック'}
          </button>
          <button
            onClick={onPrint}
            className="flex shrink-0 items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            <Printer size={18} />
            印刷・PDF化
          </button>
          </div>
        </div>
        {children}
      </div>

      {outOfSync && (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">見積書と内容が異なります</p>
            <p className="mt-0.5 text-xs">
              明細または見積書番号が、現在の見積書と一致していません。意図した変更でなければ作り直してください。
            </p>
          </div>
          <button
            onClick={handleRegenerate}
            className="flex shrink-0 items-center gap-1.5 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
          >
            <RefreshCw size={14} /> 見積書から再生成
          </button>
        </div>
      )}

      {locked && (
        <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">
          <Lock size={14} className="shrink-0" />
          この帳票はロックされています。編集するには「ロック中」を押して解除してください。
        </div>
      )}

      <fieldset disabled={locked} className="m-0 min-w-0 space-y-8 border-0 p-0">
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
            <DateField
              value={doc.date}
              onChange={v => store.updateDocument({ date: v })}
              placeholder="例: 2026年6月17日"
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
          locked={locked}
        />
      </section>
      </fieldset>
    </div>
  );
}
