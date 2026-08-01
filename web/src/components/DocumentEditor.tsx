'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, MonitorDown, PanelLeftClose, PanelLeftOpen, RefreshCw } from 'lucide-react';
import { useStore } from '@/lib/FormgenStore';
import { documentTitle, resolveDocument } from '@/lib/documentUtils';
import FormPanel from './FormPanel';
import PreviewPanel from './PreviewPanel';
import DocumentTypeTabs from './DocumentTypeTabs';
import Sidebar from './Sidebar';
import FileStatusBar from './FileStatusBar';
import WelcomeScreen from './WelcomeScreen';
import ConflictDialog from './ConflictDialog';
import IssuerSettingsDialog from './IssuerSettingsDialog';

const MIN_SIDEBAR = 200;
const MAX_SIDEBAR = 460;

export default function DocumentEditor() {
  const store = useStore();
  const { ui, connected, ready, activeProject } = store;

  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [issuerOpen, setIssuerOpen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const resolved = resolveDocument(store.file, ui.activeClientId, ui.activeProjectId, ui.activeType);

  // PWAインストールプロンプト
  useEffect(() => {
    const onPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => setInstallPrompt(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setInstallPrompt(null);
  };

  // プレビューのスケール計算（zoom を使うのは印刷時に等倍へ戻せるため）
  useEffect(() => {
    const container = previewContainerRef.current;
    if (!container) return;
    const update = () => {
      const available = container.clientWidth - 64; // p-8 (32px) × 2
      setPreviewScale(Math.min(1, available / 794));
    };
    const ro = new ResizeObserver(update);
    ro.observe(container);
    update();
    return () => ro.disconnect();
  }, [connected]);

  // ページタイトル（印刷時の既定ファイル名になる）
  useEffect(() => {
    document.title = documentTitle(resolved);
  }, [resolved]);

  // ⌘S で即保存
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void store.saveNow();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [store]);

  const handlePrint = useCallback(() => window.print(), []);

  // サイドバーの幅ドラッグ
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = ui.sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startWidth + ev.clientX - startX));
      store.patchUi({ sidebarWidth: next });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!ready) {
    return <div className="flex h-screen items-center justify-center text-sm text-gray-400">読み込み中…</div>;
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-neutral-100 font-sans text-slate-800">
      {/* ツールバー */}
      <div className="z-20 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-2.5 shadow-sm print:hidden">
        <div className="flex shrink-0 items-center gap-2">
          {connected && (
            <button
              onClick={() => store.patchUi({ sidebarCollapsed: !ui.sidebarCollapsed })}
              aria-label={ui.sidebarCollapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            >
              {ui.sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}
          <h1 className="text-lg font-bold text-gray-800">帳票作成ソフト</h1>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
          <FileStatusBar />
          {store.needsReconnect && (
            <button
              onClick={() => void store.reconnect()}
              className="flex shrink-0 items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <RefreshCw size={14} /> 再接続
            </button>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {installPrompt && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <MonitorDown size={16} /> インストール
            </button>
          )}
          <button
            onClick={() => setIssuerOpen(true)}
            className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
          >
            <Building2 size={16} /> 自社情報
          </button>
        </div>
      </div>

      {connected ? (
        <div className="flex h-full flex-1 overflow-hidden">
          {/* 左: 取引先 → 案件 ツリー */}
          {!ui.sidebarCollapsed && (
            <>
              <div style={{ width: ui.sidebarWidth }} className="h-full shrink-0 print:hidden">
                <Sidebar />
              </div>
              <div
                onMouseDown={startResize}
                className="w-1 shrink-0 cursor-col-resize bg-transparent transition-colors hover:bg-blue-400 print:hidden"
              />
            </>
          )}

          {/* 中央: 入力フォーム */}
          <div className="z-10 h-full w-1/3 min-w-[380px] max-w-[520px] shrink-0 overflow-y-auto border-r border-neutral-300 bg-white p-6 shadow-xl print:hidden">
            {activeProject && resolved ? (
              <FormPanel doc={resolved.doc} type={ui.activeType} onPrint={handlePrint}>
                <DocumentTypeTabs project={activeProject} />
              </FormPanel>
            ) : activeProject ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-800">{activeProject.name || '（無題の案件）'}</h2>
                <p className="text-sm text-gray-500">この案件にはまだ帳票がありません。</p>
                <DocumentTypeTabs project={activeProject} />
              </div>
            ) : (
              <EmptyState hasClients={store.file.clients.length > 0} />
            )}
          </div>

          {/* 右: プレビュー */}
          <div
            ref={previewContainerRef}
            className="flex h-full flex-1 justify-center overflow-y-auto bg-neutral-200 p-8 print:overflow-visible print:bg-white print:p-0"
          >
            {resolved ? (
              <div className="preview-zoom-wrapper" style={{ zoom: previewScale }}>
                <PreviewPanel data={resolved} />
              </div>
            ) : (
              <p className="mt-24 text-sm text-gray-400 print:hidden">案件を選ぶとプレビューが表示されます</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <WelcomeScreen />
        </div>
      )}

      <ConflictDialog />
      {issuerOpen && <IssuerSettingsDialog onClose={() => setIssuerOpen(false)} />}
    </div>
  );
}

function EmptyState({ hasClients }: { hasClients: boolean }) {
  return (
    <div className="mt-16 text-center">
      <p className="text-sm text-gray-500">
        {hasClients ? '左のツリーから案件を選んでください。' : '左下の「取引先を追加」から始めてください。'}
      </p>
    </div>
  );
}
