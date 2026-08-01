'use client';

import React from 'react';
import { AlertTriangle, FilePlus2, FolderOpen, RefreshCw } from 'lucide-react';
import { useStore } from '@/lib/FormgenStore';
import { isFileSystemAccessSupported } from '@/lib/fileLink';

export default function WelcomeScreen() {
  const store = useStore();
  const supported = isFileSystemAccessSupported();

  const pendingCount = store.pendingMigration?.clients.reduce((n, c) => n + c.projects.length, 0) ?? 0;

  return (
    <div className="flex h-full items-center justify-center bg-neutral-100 p-8">
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
        <h2 className="text-xl font-bold text-gray-800">帳票データファイルを選んでください</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-600">
          すべての取引先・案件・帳票を <strong>1 つのファイル</strong> に保存します。
          Dropbox フォルダの中に置けば、そのまま同期・バックアップされます。
        </p>

        {!supported && (
          <div className="mt-5 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>
              このブラウザはファイルへの直接保存に対応していません。Mac の Chrome または Edge で開いてください。
            </span>
          </div>
        )}

        {store.needsReconnect && (
          <button
            onClick={() => void store.reconnect()}
            className="mt-6 flex w-full items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 p-4 text-left transition hover:bg-blue-100"
          >
            <RefreshCw size={20} className="shrink-0 text-blue-600" />
            <span>
              <span className="block font-semibold text-blue-900">{store.fileName} に再接続</span>
              <span className="block text-xs text-blue-700">前回のファイルを開きます</span>
            </span>
          </button>
        )}

        {store.pendingMigration && (
          <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-900">
              このブラウザに保存されていた旧データが見つかりました（案件 {pendingCount} 件）
            </p>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800">
              下の「新しいファイルを作成」を選ぶと、このデータを引き継いで保存します。
            </p>
            <button
              onClick={store.dismissPendingMigration}
              className="mt-2 text-xs text-emerald-700 underline hover:text-emerald-900"
            >
              引き継がずに始める
            </button>
          </div>
        )}

        <div className="mt-6 space-y-3">
          <button
            onClick={() => void store.openFile()}
            disabled={!supported}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-300 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FolderOpen size={20} className="shrink-0 text-blue-600" />
            <span>
              <span className="block font-semibold text-gray-800">既存のファイルを開く</span>
              <span className="block text-xs text-gray-500">Dropbox 内の .formgen ファイルを選びます</span>
            </span>
          </button>

          <button
            onClick={() => void store.createFile()}
            disabled={!supported}
            className="flex w-full items-center gap-3 rounded-lg border border-gray-300 p-4 text-left transition hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FilePlus2 size={20} className="shrink-0 text-blue-600" />
            <span>
              <span className="block font-semibold text-gray-800">新しいファイルを作成</span>
              <span className="block text-xs text-gray-500">保存先に Dropbox フォルダを選んでください</span>
            </span>
          </button>
        </div>

        {store.errorMessage && (
          <p className="mt-4 text-sm text-red-600">{store.errorMessage}</p>
        )}
      </div>
    </div>
  );
}
