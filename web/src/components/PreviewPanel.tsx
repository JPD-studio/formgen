import React from 'react';
import { DocumentData, LineItem, TaxRate } from '@/types';
import { cn } from '@/lib/utils';

interface PreviewPanelProps {
  data: DocumentData;
}

export default function PreviewPanel({ data }: PreviewPanelProps) {
  const { info, issuer, items } = data;

  // 計算ロジック
  const calculateTotals = () => {
    let subtotal = 0;
    let tax10 = 0;
    let tax8 = 0;

    items.forEach(item => {
      const amount = item.quantity * item.unitPrice;
      subtotal += amount;
      if (item.taxRate === 10) tax10 += amount * 0.1;
      if (item.taxRate === 8) tax8 += amount * 0.08;
    });

    const totalTax = tax10 + tax8;
    const total = subtotal + totalTax;

    return { subtotal, tax10, tax8, totalTax, total };
  };

  const totals = calculateTotals();

  // 金額フォーマット
  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(num);
  };

  return (
    // A4サイズアスペクト比 (210x297mm)
    <div className="bg-white w-[210mm] min-h-[297mm] shadow-md print:shadow-none pt-[25mm] pb-[35mm] pl-[25mm] pr-[30mm] text-[10pt] font-serif flex flex-col relative mx-auto">
      
      {/* ページ上部 */}
      <div className="flex justify-between items-start mb-6">
        <div className="w-1/2"></div>
        <div className="text-right text-[9pt] space-y-1">
          <p>1 / 1</p>
          <p>{info.date}</p>
          <p>{info.type === '見積書' ? '見積番号' : info.type === '請求書' ? '請求番号' : '納品書番号'}: {info.documentNumber}</p>
        </div>
      </div>

      {/* タイトル */}
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-widest">{info.type}</h1>
      </div>

      {/* 宛先と発行者 */}
      <div className="flex justify-between mb-8">
        <div className="w-[50%] pr-4 space-y-4">
          <div className="border-b border-black pb-1 mb-4 text-lg">
            {info.recipientName}
          </div>
          <p>件名 : {info.subject}</p>
          
          <div className="mt-6 text-xl border-b-2 border-black pb-1 inline-block min-w-[80%] whitespace-nowrap">
            ご請求金額　{formatCurrency(totals.total)}({info.type === '見積書' ? '外税' : '内税'})
          </div>
          
          {info.condition && (
            <p className="mt-2 text-[10pt]">
              {info.type === '見積書' ? '見積有効期限' : '支払条件'}： {info.condition}
            </p>
          )}

          {info.referenceNumber && (
            <p className="text-[9pt] mt-1">ご発注書番号: {info.referenceNumber}</p>
          )}
        </div>

        <div className="w-[45%] text-[9pt] space-y-1 relative">
          <p className="text-[11pt] font-bold mb-2">{issuer.companyName}</p>
          <p>{issuer.address1}</p>
          {issuer.address2 && <p>{issuer.address2}</p>}
          <p>{issuer.tel}</p>
          <p>{issuer.email}</p>
          <p>{issuer.registrationNumber}</p>
          {/* 印鑑 */}
          <img src="/stamp.png" alt="社印" className="absolute top-0 right-4 w-16 h-16 object-contain opacity-90" />
        </div>
      </div>

      {/* 明細表 */}
      <table className="w-full border-collapse border border-black mb-4">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-black py-1 px-2 text-center w-1/2">品番・品名</th>
            <th className="border border-black py-1 px-2 text-center w-[10%]">数量</th>
            <th className="border border-black py-1 px-2 text-center w-[10%]">単位</th>
            <th className="border border-black py-1 px-2 text-center w-[15%]">単価</th>
            <th className="border border-black py-1 px-2 text-center w-[15%]">金額</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id || idx}>
              <td className="border border-black py-1 px-2">
                {item.code && <div className="text-[8pt] text-gray-600">{item.code}</div>}
                <div>{item.name}</div>
              </td>
              <td className="border border-black py-1 px-2 text-center">{item.quantity}</td>
              <td className="border border-black py-1 px-2 text-center">{item.unit}</td>
              <td className="border border-black py-1 px-2 text-right">{formatCurrency(item.unitPrice).replace('￥', '¥')}</td>
              <td className="border border-black py-1 px-2 text-right">{formatCurrency(item.quantity * item.unitPrice).replace('￥', '¥')}</td>
            </tr>
          ))}
          {/* 余白行 */}
          <tr>
            <td className="border border-black py-1 px-2 text-center text-gray-500">以下余白</td>
            <td className="border border-black py-1 px-2"></td>
            <td className="border border-black py-1 px-2"></td>
            <td className="border border-black py-1 px-2"></td>
            <td className="border border-black py-1 px-2"></td>
          </tr>
        </tbody>
      </table>

      {/* 金額サマリ */}
      <div className="flex justify-end mb-8">
        <div className="w-[30%]">
          <table className="w-full border-collapse border border-black">
            <tbody>
              <tr>
                <td className="border border-black py-1 px-2 bg-gray-100">小計</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.subtotal).replace('￥', '¥')}</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.totalTax).replace('￥', '¥')}</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 bg-gray-100">合計</td>
                <td className="border border-black py-1 px-2 text-right font-bold">{formatCurrency(totals.total).replace('￥', '¥')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 税率ごとの内訳（インボイス対応） */}
      <div className="flex justify-end mb-8">
        <div className="w-[50%]">
          <table className="w-full border-collapse border border-black text-[8pt]">
            <tbody>
              <tr>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">10%対象</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.subtotal).replace('￥', '¥')}</td>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.tax10).replace('￥', '¥')}</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">8％対象</td>
                <td className="border border-black py-1 px-2 text-right">¥0</td>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">¥0</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">対象外</td>
                <td className="border border-black py-1 px-2 text-right">¥0</td>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">¥0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 備考と振込先 */}
      <div className="mt-auto pt-8 space-y-4 text-[9pt]">
        <p>{issuer.message}</p>
        <div className="whitespace-pre-wrap">{issuer.bankInfo}</div>
      </div>

    </div>
  );
}
