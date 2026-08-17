'use client';

import React, { useState } from 'react';
import { LineItem } from '@/types';

interface BulkImportDialogProps {
  items: LineItem[];
  onImport: (items: LineItem[]) => void;
  onClose: () => void;
}

export default function BulkImportDialog({ items, onImport, onClose }: BulkImportDialogProps) {
  const formatCsv = (items: LineItem[]): string => {
    const lines = ['品名,数量,単位,単価,税率'];
    items.forEach(item => {
      lines.push(`"${item.name}",${item.quantity},${item.unit},${item.unitPrice},${item.taxRate}`);
    });
    return lines.join('\n');
  };

  const parseCsv = (csv: string): LineItem[] => {
    const lines = csv.trim().split('\n');
    if (lines.length === 0) return [];

    // ヘッダー行をスキップ
    const dataLines = lines.slice(1);
    const result: LineItem[] = [];

    dataLines.forEach((line, index) => {
      if (!line.trim()) return;

      // CSVパース（引用符対応）
      const cells: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      cells.push(current);

      if (cells.length >= 5) {
        const name = cells[0].trim();
        const quantity = parseInt(cells[1].trim()) || 1;
        const unit = cells[2].trim();
        const unitPrice = parseInt(cells[3].trim()) || 0;
        const taxRate = (() => {
          const val = parseInt(cells[4].trim());
          return [0, 8, 10].includes(val) ? val : 10;
        })();

        if (name) {
          result.push({
            id: `${Date.now()}-${index}-${Math.random()}`,
            code: '',
            name,
            quantity,
            unit,
            unitPrice,
            taxRate: taxRate as 0 | 8 | 10,
          });
        }
      }
    });

    return result;
  };

  const [csv, setCsv] = useState(formatCsv(items));
  const [error, setError] = useState('');

  const handleImport = () => {
    try {
      setError('');
      const parsed = parseCsv(csv);
      if (parsed.length === 0) {
        setError('有効な明細行がありません');
        return;
      }
      onImport(parsed);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-[90%] max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-bold text-gray-800">CSV形式で明細を一括入力</h2>
          <p className="mt-1 text-sm text-gray-500">
            カンマ区切りで編集してください。形式: 品名,数量,単位,単価,税率
          </p>
        </div>

        <div className="space-y-4 p-6">
          <textarea
            value={csv}
            onChange={e => setCsv(e.target.value)}
            placeholder="品名,数量,単位,単価,税率"
            className="h-64 w-full rounded-md border border-gray-300 p-3 font-mono text-sm"
          />

          {error && (
            <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="text-sm text-gray-600">
            <p className="font-semibold">入力例:</p>
            <code className="block bg-gray-50 p-2">
              品名,数量,単位,単価,税率<br/>
              商品A,1,式,100000,10<br/>
              商品B,2,式,50000,8
            </code>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleImport}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            この内容で確定
          </button>
        </div>
      </div>
    </div>
  );
}
