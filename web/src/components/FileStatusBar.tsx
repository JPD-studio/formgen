'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CloudOff,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  Loader2,
  Pencil,
  Unlink,
} from 'lucide-react';
import { useStore } from '@/lib/FormgenStore';

export default function FileStatusBar() {
  const store = useStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  const status = describe(store);
  const close = () => setOpen(false);

  return (
    <div className="relative">
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
        className={`flex max-w-[440px] items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ${status.className}`}
      >
        {status.icon}
        <span className="truncate font-medium">{store.fileName || 'ファイル未接続'}</span>
        <span className="shrink-0 text-xs opacity-80">· {status.label}</span>
        <ChevronDown size={14} className="shrink-0 opacity-60" />
      </button>

      {open && (
        <div
          className="absolute left-1/2 top-full z-40 mt-1 w-72 -translate-x-1/2 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
          onClick={e => e.stopPropagation()}
        >
          {store.connected && (
            <MenuItem icon={<Check size={14} />} label="今すぐ保存" onClick={() => void store.saveNow()} close={close} />
          )}
          <MenuItem icon={<FolderOpen size={14} />} label="別のファイルを開く" onClick={() => void store.openFile()} close={close} />
          <MenuItem
            icon={<FilePlus2 size={14} />}
            label={store.connected ? '別名で新しいファイルに保存' : '新しいファイルを作成'}
            onClick={() => void store.createFile()}
            close={close}
          />
          <MenuItem icon={<Download size={14} />} label="バックアップを書き出す" onClick={store.exportBackup} close={close} />
          {store.connected && (
            <>
              <div className="my-1 border-t border-gray-100" />
              <MenuItem
                icon={<Unlink size={14} />}
                label="このファイルとの接続を解除"
                onClick={() => {
                  if (confirm('接続を解除します。ファイルはそのまま残ります。')) void store.disconnect();
                }}
                close={close}
              />
            </>
          )}
          <div className="border-t border-gray-100 px-3 py-2 text-[11px] leading-relaxed text-gray-500">
            編集内容は 1.5 秒後に自動でファイルへ書き込まれます。Dropbox フォルダに置いておけば、そのまま同期されます。
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  close,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  close: () => void;
}) {
  return (
    <button
      onClick={() => {
        close();
        onClick();
      }}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-neutral-100"
    >
      {icon} {label}
    </button>
  );
}

function describe(store: ReturnType<typeof useStore>) {
  if (store.needsReconnect) {
    return {
      icon: <AlertTriangle size={15} />,
      label: '再接続が必要',
      className: 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100',
    };
  }
  if (!store.connected) {
    return {
      icon: <CloudOff size={15} />,
      label: '保存されません',
      className: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
    };
  }
  switch (store.saveStatus) {
    case 'saving':
      return {
        icon: <Loader2 size={15} className="animate-spin" />,
        label: '保存中…',
        className: 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100',
      };
    case 'dirty':
      return {
        icon: <Pencil size={15} />,
        label: '未保存の変更',
        className: 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100',
      };
    case 'error':
      return {
        icon: <AlertTriangle size={15} />,
        label: store.errorMessage ? `保存できません: ${store.errorMessage}` : '保存できません',
        className: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100',
      };
    default:
      return {
        icon: <FileText size={15} />,
        label: 'すべて保存済み',
        className: 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
      };
  }
}
