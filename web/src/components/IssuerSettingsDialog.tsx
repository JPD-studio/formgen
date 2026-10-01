'use client';

import React from 'react';
import { X } from 'lucide-react';
import { IssuerInfo } from '@/types';
import { useStore } from '@/lib/FormgenStore';

const FIELDS: { key: keyof IssuerInfo; label: string; multiline?: boolean; placeholder?: string }[] = [
  { key: 'companyName', label: '会社名' },
  { key: 'address1', label: '住所', placeholder: '〒000-0000 ...' },
  { key: 'address2', label: '住所（建物名など）' },
  { key: 'tel', label: '電話番号', placeholder: 'TEL: 000-0000-0000' },
  { key: 'email', label: 'メールアドレス' },
  { key: 'registrationNumber', label: '登録番号（インボイス）', placeholder: '登録番号: T0000000000000' },
  { key: 'message', label: '挨拶文', multiline: true },
  { key: 'bankInfo', label: '備考・振込先', multiline: true },
];

export default function IssuerSettingsDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 print:hidden"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h2 className="font-bold text-gray-800">自社情報</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <p className="text-xs text-gray-500">
            すべての帳票で共通して使われます。ファイル内にも 1 か所だけ保存されます。
          </p>
          {FIELDS.map(({ key, label, multiline, placeholder }) => (
            <div key={key}>
              <label className="mb-1 block text-xs text-gray-500">{label}</label>
              {multiline ? (
                <textarea
                  rows={key === 'bankInfo' ? 4 : 2}
                  value={store.file.issuer[key]}
                  placeholder={placeholder}
                  onChange={e => store.updateIssuer({ [key]: e.target.value })}
                  className="w-full resize-y rounded-md border border-gray-300 p-2 text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={store.file.issuer[key]}
                  placeholder={placeholder}
                  onChange={e => store.updateIssuer({ [key]: e.target.value })}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-gray-200 px-5 py-3 text-right">
          <button
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
