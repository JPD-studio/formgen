'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useStore } from '@/lib/FormgenStore';

/**
 * ファイルが外部（テキストエディタや別マシンからの Dropbox 同期）で書き換えられ、
 * かつこちらにも未保存の変更がある場合にどちらを残すか選ばせる。
 */
export default function ConflictDialog() {
  const store = useStore();
  if (!store.conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6 print:hidden">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
        <div className="flex gap-3">
          <AlertTriangle size={22} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-bold text-gray-800">ファイルが外部で変更されました</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">
              <span className="font-medium">{store.fileName}</span> が別の場所で書き換えられていますが、
              この画面にも未保存の変更があります。どちらを残しますか？
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <button
            onClick={() => void store.resolveConflict('reload')}
            className="w-full rounded-lg border border-gray-300 p-3 text-left transition hover:border-blue-400 hover:bg-blue-50"
          >
            <span className="block text-sm font-semibold text-gray-800">ファイルの内容を読み込む</span>
            <span className="block text-xs text-gray-500">この画面の未保存の変更は破棄されます</span>
          </button>
          <button
            onClick={() => void store.resolveConflict('overwrite')}
            className="w-full rounded-lg border border-gray-300 p-3 text-left transition hover:border-red-400 hover:bg-red-50"
          >
            <span className="block text-sm font-semibold text-gray-800">この画面の内容で上書きする</span>
            <span className="block text-xs text-gray-500">ファイル側の変更は失われます</span>
          </button>
        </div>
      </div>
    </div>
  );
}
