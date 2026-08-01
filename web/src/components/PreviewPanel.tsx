import React from 'react';
import { ResolvedDocument } from '@/types';

interface PreviewPanelProps {
  data: ResolvedDocument;
}

export default function PreviewPanel({ data }: PreviewPanelProps) {
  const { type, clientName, honorific, subject, issuer, doc } = data;
  const items = doc.items;

  // 税率ごとに集計する（インボイスの内訳表がこれを使う）
  const calculateTotals = () => {
    const base = { 10: 0, 8: 0, 0: 0 } as Record<number, number>;

    items.forEach(item => {
      const amount = item.quantity * item.unitPrice;
      base[item.taxRate] = (base[item.taxRate] ?? 0) + amount;
    });

    const subtotal = base[10] + base[8] + base[0];
    const tax10 = Math.floor(base[10] * 0.1);
    const tax8 = Math.floor(base[8] * 0.08);
    const totalTax = tax10 + tax8;

    return { subtotal, base10: base[10], base8: base[8], base0: base[0], tax10, tax8, totalTax, total: subtotal + totalTax };
  };

  const totals = calculateTotals();

  const formatCurrency = (num: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(num).replace('￥', '¥');

  return (
    // A4サイズアスペクト比 (210x297mm)
    <div className="bg-white w-[794px] shadow-md print:shadow-none pt-[57px] pb-[57px] pl-[95px] pr-[114px] text-[10pt] font-serif flex flex-col relative mx-auto">

      {/* ページ上部 */}
      <div className="flex justify-between items-start mb-2">
        <div className="w-1/2"></div>
        <div className="text-right text-[9pt] space-y-1">
          <p>1 / 1</p>
          <p>{doc.date}</p>
          <p>{type === '見積書' ? '見積番号' : type === '請求書' ? '請求番号' : '納品書番号'}: {doc.documentNumber}</p>
        </div>
      </div>

      {/* タイトル */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-widest">{type}</h1>
      </div>

      {/* 宛先と発行者 */}
      <div className="flex justify-between mb-4">
        <div className="w-[50%] pr-4 space-y-4">
          <div className="border-b border-black pb-1 mb-2 text-[11pt] flex items-end justify-between gap-2">
            <span>{clientName}</span>
            <span className="shrink-0">{honorific}</span>
          </div>
          <p>件名 : {subject}</p>

          <div className="mt-2 text-[13pt] border-b-2 border-black pb-1 inline-block min-w-[80%] whitespace-nowrap">
            {type === '見積書' ? '御見積金額' : 'ご請求金額'}　{formatCurrency(totals.total)}({type === '見積書' ? '外税' : '内税'})
          </div>

          {doc.condition && (
            <p className="mt-2 text-[10pt]">
              {type === '見積書' ? '見積有効期限' : '支払条件'}： {doc.condition}
            </p>
          )}

          {doc.referenceNumber && (
            <p className="text-[9pt] mt-1">ご発注書番号: {doc.referenceNumber}</p>
          )}
          {doc.estimateNumber && (
            <p className="text-[9pt] mt-1">見積書番号: {doc.estimateNumber}</p>
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
          {items.map(item => (
            <tr key={item.id}>
              <td className="border border-black py-1 px-2">
                {item.code && <div className="text-[8pt] text-gray-600">{item.code}</div>}
                <div>
                  {item.name}
                  {item.taxRate === 8 && <span className="text-[8pt]"> ※</span>}
                </div>
              </td>
              <td className="border border-black py-1 px-2 text-center">{item.quantity}</td>
              <td className="border border-black py-1 px-2 text-center">{item.unit}</td>
              <td className="border border-black py-1 px-2 text-right">{formatCurrency(item.unitPrice)}</td>
              <td className="border border-black py-1 px-2 text-right">{formatCurrency(item.quantity * item.unitPrice)}</td>
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
      <div className="flex justify-end mb-3">
        <div className="w-[30%]">
          <table className="w-full border-collapse border border-black">
            <tbody>
              <tr>
                <td className="border border-black py-1 px-2 bg-gray-100">小計</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.subtotal)}</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.totalTax)}</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 bg-gray-100">合計</td>
                <td className="border border-black py-1 px-2 text-right font-bold">{formatCurrency(totals.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 税率ごとの内訳（インボイス対応） */}
      <div className="flex justify-end mb-3">
        <div className="w-[50%]">
          <table className="w-full border-collapse border border-black text-[8pt]">
            <tbody>
              <tr>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">10%対象</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.base10)}</td>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.tax10)}</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">8％対象 ※</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.base8)}</td>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.tax8)}</td>
              </tr>
              <tr>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">対象外</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(totals.base0)}</td>
                <td className="border border-black py-1 px-2 text-center bg-gray-100">消費税</td>
                <td className="border border-black py-1 px-2 text-right">{formatCurrency(0)}</td>
              </tr>
            </tbody>
          </table>
          {totals.base8 > 0 && <p className="mt-1 text-[8pt]">※ は軽減税率(8%)対象</p>}
        </div>
      </div>

      {/* 備考と振込先 */}
      <div className="mt-4 pt-2 space-y-2 text-[9pt]">
        <p>{issuer.message}</p>
        <div className="whitespace-pre-wrap">{issuer.bankInfo}</div>
      </div>

    </div>
  );
}
