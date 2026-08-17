import React, { useLayoutEffect, useRef, useState } from 'react';
import { LineItem, ResolvedDocument } from '@/types';

interface PreviewPanelProps {
  data: ResolvedDocument;
}

// A4サイズ (210x297mm ≒ 794x1123px @96dpi)
const PAGE_WIDTH = 794;
const PAGE_HEIGHT = 1123;
const PAGE_PAD_TOP = 57;
const PAGE_PAD_BOTTOM = 57;
const PAGE_PAD_LEFT = 95;
const PAGE_PAD_RIGHT = 114;
const TABLE_MARGIN_BOTTOM = 16; // 明細表の mb-4
const SAFETY_MARGIN = 6; // 実測値の誤差吸収用の余白
// ページ内で明細行・以下余白・合計欄などに使える実高さ
const CONTENT_HEIGHT = PAGE_HEIGHT - PAGE_PAD_TOP - PAGE_PAD_BOTTOM - SAFETY_MARGIN;

interface PageLayout {
  items: LineItem[];
  showHeader: boolean;
  showSummary: boolean;
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

  // ------------------------------------------------------------------
  // 共通パーツ。実測用と実描画用の両方でまったく同じ JSX を使うことで、
  // 「測った高さ」と「実際に描画される高さ」がズレる（＝ページ割れの位置がおかしくなる）事故を防ぐ。
  // ------------------------------------------------------------------

  // これらは JSX を返す「ただの関数」であり、JSXタグとして使うコンポーネントではない
  // （コンポーネントとして定義するとレンダーのたびに型が再生成され、無駄な再マウントを招くため関数呼び出しで統一する）
  const renderHeader = (pageNumText: React.ReactNode) => (
    <>
      <div className="flex justify-between items-start mb-2">
        <div className="w-1/2"></div>
        <div className="text-right text-[9pt] space-y-1">
          <p>{pageNumText}</p>
          <p>{doc.date}</p>
          <p>{type === '見積書' ? '見積番号' : type === '請求書' ? '請求番号' : '納品書番号'}: {doc.documentNumber}</p>
        </div>
      </div>

      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold tracking-widest">{type}</h1>
      </div>

      <div className="flex justify-between mb-4">
        <div className="w-[50%] pr-4 space-y-4">
          <div className="border-b border-black pb-1 mb-2 text-[11pt] flex items-end justify-between gap-2">
            <span>{clientName}</span>
            <span className="shrink-0">{honorific}</span>
          </div>
          <p>件名 : {subject}</p>

          <div className="mt-2 text-[13pt] border-b-2 border-black pb-1 inline-block min-w-[80%] whitespace-nowrap">
            {type === '見積書' ? '御見積金額' : 'ご請求金額'}　{formatCurrency(totals.total)}(内税)
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
          <img src="/stamp.png" alt="社印" className="absolute top-0 right-4 w-16 h-16 object-contain opacity-90" />
        </div>
      </div>
    </>
  );

  const renderPageNumOnly = (pageNumText: React.ReactNode) => (
    <div className="text-right text-[9pt] mb-2">
      <p>{pageNumText}</p>
    </div>
  );

  const renderTableHeadRow = () => (
    <tr className="bg-gray-100">
      <th className="border border-black py-1 px-2 text-center w-1/2">品番・品名</th>
      <th className="border border-black py-1 px-2 text-center w-[10%]">数量</th>
      <th className="border border-black py-1 px-2 text-center w-[10%]">単位</th>
      <th className="border border-black py-1 px-2 text-center w-[15%]">単価</th>
      <th className="border border-black py-1 px-2 text-center w-[15%]">金額</th>
    </tr>
  );

  const renderItemRowCells = (item: LineItem) => (
    <>
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
    </>
  );

  const renderBlankRowCells = () => (
    <>
      <td className="border border-black py-1 px-2 text-center text-gray-500">以下余白</td>
      <td className="border border-black py-1 px-2"></td>
      <td className="border border-black py-1 px-2"></td>
      <td className="border border-black py-1 px-2"></td>
      <td className="border border-black py-1 px-2"></td>
    </>
  );

  const renderSummary = () => (
    <>
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

      <div className="mt-4 pt-2 space-y-2 text-[9pt]">
        <p>{issuer.message}</p>
        {doc.notes && <div className="whitespace-pre-wrap">{doc.notes}</div>}
        <div className="whitespace-pre-wrap">{issuer.bankInfo}</div>
      </div>

      <p className="mt-6 text-center text-[9pt] text-gray-500">－　以下余白　－</p>
    </>
  );

  // ------------------------------------------------------------------
  // 実測に基づくページ分割
  // 固定の「1ページ○行」という見積もりではなく、実際にDOMへ描画した各パーツの
  // 高さを測ってから配分することで、画面プレビューと印刷(PDF)のページ割れを一致させる。
  // ------------------------------------------------------------------

  const measureRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<PageLayout[] | null>(null);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;

    const headerEl = root.querySelector<HTMLElement>('[data-m="header"]');
    const theadEl = root.querySelector<HTMLElement>('[data-m="thead"]');
    const blankRowEl = root.querySelector<HTMLElement>('[data-m="blankrow"]');
    const summaryEl = root.querySelector<HTMLElement>('[data-m="summary"]');
    const pagenumEl = root.querySelector<HTMLElement>('[data-m="pagenum"]');
    const rowEls = root.querySelectorAll<HTMLElement>('[data-m="row"]');

    const headerH = headerEl?.offsetHeight ?? 0;
    const theadH = theadEl?.offsetHeight ?? 0;
    const blankRowH = blankRowEl?.offsetHeight ?? 0;
    const summaryH = summaryEl?.offsetHeight ?? 0;
    const pagenumH = pagenumEl?.offsetHeight ?? 0;
    const rowHeights = Array.from(rowEls).map(el => el.offsetHeight);

    type Bucket = { itemIdx: number[]; showHeader: boolean; showSummary: boolean };

    // まず合計欄のことは考えず、通常どおり先頭のページから明細を目一杯詰める。
    // これで最後のページ以外は常にフル（自然な見た目）になる。
    const bodyPages: Bucket[] = [];
    {
      let idx = 0;
      while (idx < items.length) {
        const isFirst = bodyPages.length === 0;
        const overhead = isFirst ? headerH : pagenumH;
        const budget = CONTENT_HEIGHT - overhead - theadH - TABLE_MARGIN_BOTTOM;
        const itemIdx: number[] = [];
        let used = 0;
        while (idx < items.length) {
          const rh = rowHeights[idx] ?? 0;
          // 最低1行は必ず載せる（1行が丸ごとページ予算を超える極端なケースの無限ループ防止）
          if (used + rh <= budget || itemIdx.length === 0) {
            itemIdx.push(idx);
            used += rh;
            idx++;
          } else {
            break;
          }
        }
        bodyPages.push({ itemIdx, showHeader: isFirst, showSummary: false });
      }
      if (bodyPages.length === 0) {
        bodyPages.push({ itemIdx: [], showHeader: true, showSummary: false });
      }
    }

    // 最後のページに合計欄・振込先などのまとめを付けたい。
    // 収まらない場合は、末尾の明細を1件ずつ追い出して収まるまで詰め直す
    // （＝合計欄だけのために中身がほぼ空のページができるのを避けつつ、
    //   途中のページを不必要に削らない）。
    const carry: number[] = [];
    {
      const last = bodyPages[bodyPages.length - 1];
      const overhead = last.showHeader ? headerH : pagenumH;
      const pageBudget = CONTENT_HEIGHT - overhead - theadH - TABLE_MARGIN_BOTTOM;
      while (true) {
        const used = last.itemIdx.reduce((s, i) => s + (rowHeights[i] ?? 0), 0);
        if (used + blankRowH + summaryH <= pageBudget) break;
        if (last.itemIdx.length === 0) break; // これ以上は追い出せない
        carry.unshift(last.itemIdx.pop() as number);
      }
    }

    let pages: Bucket[];
    if (carry.length > 0) {
      pages = [...bodyPages, { itemIdx: carry, showHeader: false, showSummary: true }];
    } else {
      bodyPages[bodyPages.length - 1].showSummary = true;
      pages = bodyPages;
    }

    setLayout(
      pages.map(p => ({
        items: p.itemIdx.map(i => items[i]),
        showHeader: p.showHeader,
        showSummary: p.showSummary,
      }))
    );
    // data は呼び出し元 (DocumentEditor) で再レンダリングのたびに新しいオブジェクト参照になるため、
    // 参照ではなく実内容のシリアライズ値を依存にする（でないと setLayout → 再レンダリング → 新しい data
    // 参照 → 再計測 … の無限ループになる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data)]);

  const renderPage = (pageNum: number, page: PageLayout, totalPages: number) => {
    const isLastOfAll = pageNum === totalPages;
    return (
      <div
        key={pageNum}
        className={`bg-white w-[794px] min-h-[1123px] shadow-md print:shadow-none pt-[57px] pb-[57px] pl-[95px] pr-[114px] text-[10pt] font-serif flex flex-col relative mx-auto ${isLastOfAll ? '' : 'mb-6 print:mb-0 print-page-break'}`}
      >
        {page.showHeader
          ? renderHeader(`${pageNum} / ${totalPages}`)
          : renderPageNumOnly(`${pageNum} / ${totalPages}`)}

        <table className="w-full border-collapse border border-black mb-4">
          <thead>{renderTableHeadRow()}</thead>
          <tbody>
            {page.items.map(item => (
              <tr key={item.id}>{renderItemRowCells(item)}</tr>
            ))}
            {page.showSummary && <tr>{renderBlankRowCells()}</tr>}
          </tbody>
        </table>

        {page.showSummary && renderSummary()}
      </div>
    );
  };

  return (
    <div>
      {/* 実測用の非表示コンテナ。実描画とまったく同じパーツを使い、高さだけを測る */}
      <div
        ref={measureRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: -99999,
          width: PAGE_WIDTH,
          paddingLeft: PAGE_PAD_LEFT,
          paddingRight: PAGE_PAD_RIGHT,
          zoom: 1,
        }}
        className="text-[10pt] font-serif"
      >
        <div data-m="header" className="flow-root">
          {renderHeader('0 / 0')}
        </div>
        <table className="w-full border-collapse border border-black">
          <thead data-m="thead">{renderTableHeadRow()}</thead>
          <tbody>
            {items.map(item => (
              <tr data-m="row" key={item.id}>{renderItemRowCells(item)}</tr>
            ))}
            <tr data-m="blankrow">{renderBlankRowCells()}</tr>
          </tbody>
        </table>
        <div data-m="summary" className="flow-root">
          {renderSummary()}
        </div>
        <div data-m="pagenum" className="flow-root">
          {renderPageNumOnly('0 / 0')}
        </div>
      </div>

      {layout && layout.map((page, i) => renderPage(i + 1, page, layout.length))}
    </div>
  );
}
