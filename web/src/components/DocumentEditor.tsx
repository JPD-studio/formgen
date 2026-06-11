"use client";

import React, { useState, useRef, useEffect } from 'react';
import { DocumentData, LineItem, DocumentType } from '@/types';
import { Download, FolderOpen } from 'lucide-react';
import FormPanel from './FormPanel';
import PreviewPanel from './PreviewPanel';

const defaultData: DocumentData = {
  info: {
    type: '見積書',
    documentNumber: '20260416-001',
    referenceNumber: '',
    date: '2026年4月16日',
    recipientName: '株式会社マツムラ　様',
    subject: 'パイプ切断半自動機',
    condition: '見積有効期限　2週間',
  },
  issuer: {
    companyName: '日本プロセス開発株式会社',
    address1: '〒577-0034 大阪府東大阪市御厨南2-4-18',
    address2: 'フィールドパーク2番館301号室',
    tel: 'TEL: 090-1131-5277',
    email: 'daiji.nagahara@j-p-d.co.jp',
    registrationNumber: '登録番号: T3122001036512',
    message: '平素は格別のご厚情を賜り、ありがたくお礼申し上げます。',
    bankInfo: 'PayPay銀行(0033) ビジネス営業部(005) 普通6652172 ニホンプロセスカイハツ（カ\n※ 支払条件：月末締め翌月末払い\n※ 恐れ入りますが、振込手数料はお客様ご負担にてお願い申し上げます。',
  },
  items: [
    { id: '1', code: 'ISTEC200', name: 'ISTEC200', quantity: 1, unit: '式', unitPrice: 862500, taxRate: 10 },
    { id: '2', code: '', name: 'ISTEC200用専用刃（10枚組　1/4,3/8,1/2用）', quantity: 1, unit: '式', unitPrice: 47725, taxRate: 10 },
  ]
};

export default function DocumentEditor() {
  const [data, setData] = useState<DocumentData>(defaultData);
  const [isLoaded, setIsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初回マウント時に localStorage から復元
  useEffect(() => {
    const saved = localStorage.getItem('formgen_saved_data');
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (err) {
        console.error('データの復元に失敗しました', err);
      }
    }
    setIsLoaded(true);
  }, []);

  // データが更新されるたびに localStorage に保存
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('formgen_saved_data', JSON.stringify(data));
    }
  }, [data, isLoaded]);

  // PDF保存時のデフォルトファイル名（ページタイトル）を動的に変更
  useEffect(() => {
    const recipient = data.info.recipientName.replace(/様/g, '').trim() || '名称未設定';
    document.title = `${recipient}様_${data.info.documentNumber}`;
  }, [data.info.recipientName, data.info.documentNumber]);

  const handlePrint = () => {
    window.print();
  };

  const handleSave = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // 宛先名から「様」を取り除いてファイル名を生成
    const recipient = data.info.recipientName.replace(/様/g, '').trim() || '名称未設定';
    const filename = `${recipient}様_${data.info.documentNumber}.formgen`;
    
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string);
        setData(json);
      } catch (err) {
        alert('ファイルの読み込みに失敗しました。対応していないファイル形式です。');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // reset
  };

  // Launch Queue (PWA File Handling API) の設定
  useEffect(() => {
    if ('launchQueue' in window) {
      (window as any).launchQueue.setConsumer(async (launchParams: any) => {
        if (!launchParams.files.length) return;
        const fileHandle = launchParams.files[0];
        const file = await fileHandle.getFile();
        const text = await file.text();
        try {
          const json = JSON.parse(text);
          setData(json);
        } catch (err) {
          alert('ファイルの読み込みに失敗しました。');
        }
      });
    }
  }, []);

  return (
    <div className="flex h-screen w-full flex-col bg-neutral-100 overflow-hidden font-sans text-slate-800">
      
      {/* ツールバー (印刷時は非表示) */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm z-20 print:hidden">
        <h1 className="font-bold text-lg text-gray-800">帳票作成ソフト</h1>
        <div className="flex items-center gap-3">
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
        <FormPanel data={data} setData={setData} onPrint={handlePrint} />
      </div>

      {/* 右側：プレビュー (印刷時はここだけ全画面化) */}
      <div className="flex-1 h-full overflow-y-auto bg-neutral-200 p-8 flex justify-center print:p-0 print:bg-white print:overflow-visible">
        <PreviewPanel data={data} />
      </div>
    </div>
    </div>
  );
}
