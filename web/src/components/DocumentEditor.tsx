"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DocumentData, DocumentSet, DocumentType, FormgenFileV2 } from '@/types';
import { Download, FolderOpen } from 'lucide-react';
import FormPanel from './FormPanel';
import PreviewPanel from './PreviewPanel';
import DocumentTypeTabs from './DocumentTypeTabs';
import DocumentSetSelector from './DocumentSetSelector';
import {
  createNewSet,
  generateFromEstimate,
  parseFormgenFile,
  typeKeyOf,
} from '@/lib/documentUtils';

const defaultIssuer = {
  companyName: '日本プロセス開発株式会社',
  address1: '〒577-0034 大阪府東大阪市御厨南2-4-18',
  address2: 'フィールドパーク2番館301号室',
  tel: 'TEL: 090-1131-5277',
  email: 'daiji.nagahara@j-p-d.co.jp',
  registrationNumber: '登録番号: T3122001036512',
  message: '平素は格別のご厚情を賜り、ありがたくお礼申し上げます。',
  bankInfo: 'PayPay銀行(0033) ビジネス営業部(005) 普通6652172 ニホンプロセスカイハツ（カ\n※ 支払条件：月末締め翌月末払い\n※ 恐れ入りますが、振込手数料はお客様ご負担にてお願い申し上げます。',
};

function makeInitialSet(): DocumentSet {
  const id = `set-${Date.now()}`;
  const today = new Date();
  const ymd = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
  const prefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
  const estimate: DocumentData = {
    info: {
      type: '見積書',
      documentNumber: `${prefix}-001`,
      referenceNumber: '',
      date: ymd,
      estimateNumber: '',
      recipientName: '株式会社マツムラ　様',
      subject: 'パイプ切断半自動機',
      condition: '見積有効期限　2週間',
    },
    issuer: defaultIssuer,
    items: [
      { id: '1', code: 'ISTEC200', name: 'ISTEC200', quantity: 1, unit: '式', unitPrice: 862500, taxRate: 10 },
      { id: '2', code: '', name: 'ISTEC200用専用刃（10枚組　1/4,3/8,1/2用）', quantity: 1, unit: '式', unitPrice: 47725, taxRate: 10 },
    ],
  };
  return { id, estimate, invoice: null, delivery: null };
}

export default function DocumentEditor() {
  const initialSet = useRef(makeInitialSet());
  const [sets, setSets] = useState<DocumentSet[]>([initialSet.current]);
  const [activeSetId, setActiveSetId] = useState<string>(initialSet.current.id);
  const [activeType, setActiveType] = useState<DocumentType>('見積書');
  const [isLoaded, setIsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  // プレビューのスケール計算
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
  }, []);

  // 初回マウント: localStorage復元（v2 → v1フォールバック）
  useEffect(() => {
    const tryLoad = (key: string): FormgenFileV2 | null => {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      try {
        return parseFormgenFile(JSON.parse(raw));
      } catch {
        return null;
      }
    };

    const v2 = tryLoad('formgen_v2_data') ?? tryLoad('formgen_saved_data');
    if (v2) {
      setSets(v2.sets);
      setActiveSetId(v2.activeSetId);
      setActiveType(v2.activeType);
    } else {
      const initial = makeInitialSet();
      setSets([initial]);
      setActiveSetId(initial.id);
    }
    setIsLoaded(true);
  }, []);

  // データ変更のたびにlocalStorage保存
  useEffect(() => {
    if (!isLoaded) return;
    const file: FormgenFileV2 = { version: 2, activeSetId, activeType, sets };
    localStorage.setItem('formgen_v2_data', JSON.stringify(file));
  }, [sets, activeSetId, activeType, isLoaded]);

  // 初回ロード後にactiveSetIdがまだ空なら先頭セットをセット
  useEffect(() => {
    if (isLoaded && !activeSetId && sets.length > 0) {
      setActiveSetId(sets[0].id);
    }
  }, [isLoaded, activeSetId, sets]);

  const activeSet = sets.find(s => s.id === activeSetId) ?? sets[0];
  const activeData: DocumentData = activeSet
    ? (activeSet[typeKeyOf(activeType)] ?? activeSet.estimate)
    : sets[0].estimate;

  // ページタイトル更新
  useEffect(() => {
    const recipient = activeData.info.recipientName.replace(/様/g, '').trim() || '名称未設定';
    document.title = `${recipient}様_${activeData.info.documentNumber}`;
  }, [activeData.info.recipientName, activeData.info.documentNumber]);

  // FormPanelに渡す setData（アクティブスロットだけ更新）
  const setActiveData = useCallback((updater: React.SetStateAction<DocumentData>) => {
    setSets(prev => prev.map(set => {
      if (set.id !== activeSetId) return set;
      const key = typeKeyOf(activeType);
      const current = set[key] ?? set.estimate;
      const next = typeof updater === 'function' ? updater(current) : updater;
      return { ...set, [key]: next };
    }));
  }, [activeSetId, activeType]);

  // 帳票種別タブ切り替え
  const handleTypeSwitch = useCallback((type: DocumentType) => {
    if (type !== '見積書') {
      setSets(prev => {
        const set = prev.find(s => s.id === activeSetId);
        if (!set) return prev;
        const key = typeKeyOf(type);
        const existing = set[key];
        // 既存の場合も、見積書番号が空なら再生成（古いデータを更新）
        if (existing && existing.info.estimateNumber) return prev;
        const generated = generateFromEstimate(set.estimate, type as '請求書' | '納品書', prev);
        return prev.map(s => s.id === activeSetId ? { ...s, [key]: generated } : s);
      });
    }
    setActiveType(type); // 必ず setSets の外で呼ぶ（同一バッチで処理される）
  }, [activeSetId]);

  // セット切り替え
  const handleSetSelect = (id: string) => {
    setActiveSetId(id);
    setActiveType('見積書');
  };

  // 新規セット追加
  const handleAddSet = () => {
    const newId = `set-${Date.now()}`;
    setSets(prev => [...prev, createNewSet(activeSet?.estimate.issuer, prev, newId)]);
    setActiveSetId(newId);
    setActiveType('見積書');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    const file: FormgenFileV2 = { version: 2, activeSetId, activeType, sets };
    const jsonString = JSON.stringify(file, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const recipient = activeSet.estimate.info.recipientName.replace(/様/g, '').trim() || '名称未設定';
    a.href = url;
    a.download = `${recipient}様_${activeSet.estimate.info.documentNumber}.formgen`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseFormgenFile(JSON.parse(ev.target?.result as string));
        setSets(parsed.sets);
        setActiveSetId(parsed.activeSetId);
        setActiveType(parsed.activeType);
      } catch {
        alert('ファイルの読み込みに失敗しました。対応していないファイル形式です。');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Launch Queue (PWA File Handling API)
  useEffect(() => {
    if ('launchQueue' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files.length) return;
        const fileHandle = launchParams.files[0];
        const file = await fileHandle.getFile();
        const text = await file.text();
        try {
          const parsed = parseFormgenFile(JSON.parse(text));
          setSets(parsed.sets);
          setActiveSetId(parsed.activeSetId);
          setActiveType(parsed.activeType);
        } catch {
          alert('ファイルの読み込みに失敗しました。');
        }
      });
    }
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-100 overflow-hidden font-sans text-slate-800">

      {/* ツールバー */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-20 print:hidden">
        <h1 className="font-bold text-lg text-gray-800 shrink-0">帳票作成ソフト</h1>
        <div className="flex items-center gap-3 mx-4 flex-1 justify-center">
          <DocumentSetSelector
            sets={sets}
            activeSetId={activeSetId || sets[0]?.id || ''}
            onSelect={handleSetSelect}
            onAddSet={handleAddSet}
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="file"
            accept=".formgen"
            className="hidden"
            ref={fileInputRef}
            onChange={handleOpen}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
          >
            <FolderOpen size={16} /> 開く
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition"
          >
            <Download size={16} /> 保存
          </button>
        </div>
      </div>

      <div className="flex flex-1 h-full overflow-hidden">
        {/* 左側：入力フォーム */}
        <div className="w-1/3 min-w-[400px] h-full overflow-y-auto border-r border-neutral-300 bg-white p-6 shadow-xl z-10 print:hidden">
          <FormPanel data={activeData} setData={setActiveData} onPrint={handlePrint}>
            <DocumentTypeTabs
              activeType={activeType}
              hasInvoice={!!activeSet?.invoice}
              hasDelivery={!!activeSet?.delivery}
              onSwitch={handleTypeSwitch}
            />
          </FormPanel>
        </div>

        {/* 右側：プレビュー */}
        <div
          ref={previewContainerRef}
          className="flex-1 h-full overflow-y-auto bg-neutral-200 p-8 flex justify-center items-start print:p-0 print:bg-white print:overflow-visible"
        >
          <div
            className="preview-zoom-wrapper"
            style={{ zoom: previewScale }}
          >
            <PreviewPanel data={activeData} />
          </div>
        </div>
      </div>
    </div>
  );
}
