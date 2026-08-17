'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';
import { LineItem, TaxRate } from '@/types';
import { newId } from '@/lib/formgenFile';
import BulkImportDialog from './BulkImportDialog';

interface LineItemsTableProps {
  items: LineItem[];
  onChange: (fn: (items: LineItem[]) => LineItem[]) => void;
}

interface CellAddress {
  row: number;
  col: number;
}

const COLUMN_KEYS = ['code', 'name', 'quantity', 'unit', 'unitPrice', 'taxRate'] as const;
const COLUMN_LABELS = ['品番', '品名', '数量', '単位', '単価', '税率'];

const MAX_HISTORY = 50;

export default function LineItemsTable({ items, onChange }: LineItemsTableProps) {
  const [anchorCell, setAnchorCell] = useState<CellAddress | null>(null);
  const [focusCell, setFocusCell] = useState<CellAddress | null>(null);
  const [draggedRow, setDraggedRow] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ row: number; position: 'before' | 'after' } | null>(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  // undo/redo: items の直前スナップショットをスタックしておく。
  // 同一セルへの連続入力は1操作にまとめる（coalesceKey が同じ間は積まない）
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const undoStackRef = useRef<LineItem[][]>([]);
  const redoStackRef = useRef<LineItem[][]>([]);
  const lastEditKeyRef = useRef<string | null>(null);

  const commit = useCallback(
    (fn: (items: LineItem[]) => LineItem[], coalesceKey?: string) => {
      if (!coalesceKey || coalesceKey !== lastEditKeyRef.current) {
        undoStackRef.current.push(itemsRef.current);
        if (undoStackRef.current.length > MAX_HISTORY) undoStackRef.current.shift();
        redoStackRef.current = [];
      }
      lastEditKeyRef.current = coalesceKey ?? null;
      onChange(fn);
    },
    [onChange]
  );

  const handleUndo = useCallback(() => {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(itemsRef.current);
    lastEditKeyRef.current = null;
    onChange(() => prev);
  }, [onChange]);

  const handleRedo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(itemsRef.current);
    lastEditKeyRef.current = null;
    onChange(() => next);
  }, [onChange]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  const isSelected = (row: number, col: number): boolean => {
    if (!anchorCell || !focusCell) return false;
    const minRow = Math.min(anchorCell.row, focusCell.row);
    const maxRow = Math.max(anchorCell.row, focusCell.row);
    const minCol = Math.min(anchorCell.col, focusCell.col);
    const maxCol = Math.max(anchorCell.col, focusCell.col);
    return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol;
  };

  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    isSelectingRef.current = true;
    if (e.shiftKey && anchorCell) {
      setFocusCell({ row, col });
    } else {
      setAnchorCell({ row, col });
      setFocusCell({ row, col });
    }
  };

  useEffect(() => {
    // 入力欄内でのドラッグはブラウザがテキスト選択用に mousemove の target を
    // 開始要素へ固定してしまうため、target ではなく実座標から要素を引く
    const onMouseMove = (e: MouseEvent) => {
      if (!isSelectingRef.current) return;
      const cellEl = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(
        '[data-cell-row]'
      );
      if (!cellEl) return;
      const row = Number(cellEl.dataset.cellRow);
      const col = Number(cellEl.dataset.cellCol);
      setFocusCell(prev => (prev && prev.row === row && prev.col === col ? prev : { row, col }));
    };
    const stopSelecting = () => {
      isSelectingRef.current = false;
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', stopSelecting);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', stopSelecting);
    };
  }, []);

  const handleCellChange = (rowIndex: number, key: keyof LineItem, value: string | number) => {
    commit(
      items =>
        items.map((item, i) =>
          i === rowIndex
            ? {
                ...item,
                [key]:
                  key === 'quantity' || key === 'unitPrice'
                    ? typeof value === 'string'
                      ? Number(value) || 0
                      : value
                    : value,
              }
            : item
        ),
      `cell-${rowIndex}-${key}`
    );
  };

  const handleKeyDown = (
    rowIndex: number,
    colIndex: number,
    e: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const target = e.currentTarget as HTMLInputElement | HTMLSelectElement;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = e.key === 'ArrowUp' ? rowIndex - 1 : rowIndex + 1;
      if (nextRow >= 0 && nextRow < items.length) {
        const nextInput = containerRef.current?.querySelector(
          `input[data-row="${nextRow}"][data-col="${colIndex}"], select[data-row="${nextRow}"][data-col="${colIndex}"]`
        ) as HTMLInputElement | HTMLSelectElement | null;
        if (nextInput) {
          setTimeout(() => nextInput.focus(), 0);
        }
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      const isAtStart = target instanceof HTMLInputElement && target.selectionStart === 0;
      if (isAtStart || target instanceof HTMLSelectElement) {
        e.preventDefault();
        if (colIndex > 0) {
          const prevInput = containerRef.current?.querySelector(
            `input[data-row="${rowIndex}"][data-col="${colIndex - 1}"], select[data-row="${rowIndex}"][data-col="${colIndex - 1}"]`
          ) as HTMLInputElement | HTMLSelectElement | null;
          if (prevInput) {
            setTimeout(() => prevInput.focus(), 0);
          }
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      const isAtEnd =
        target instanceof HTMLInputElement && target.selectionStart === target.value.length;
      if (isAtEnd || target instanceof HTMLSelectElement) {
        e.preventDefault();
        if (colIndex < COLUMN_KEYS.length - 1) {
          const nextInput = containerRef.current?.querySelector(
            `input[data-row="${rowIndex}"][data-col="${colIndex + 1}"], select[data-row="${rowIndex}"][data-col="${colIndex + 1}"]`
          ) as HTMLInputElement | HTMLSelectElement | null;
          if (nextInput) {
            setTimeout(() => nextInput.focus(), 0);
          }
        }
      }
      return;
    }
  };

  const handleAddRow = () => {
    commit(items => [
      ...items,
      { id: newId('i'), code: '', name: '', quantity: 1, unit: '式', unitPrice: 0, taxRate: 10 },
    ]);
  };

  const handleDuplicateRow = (rowIndex: number) => {
    commit(items => {
      const source = items[rowIndex];
      const copy = { ...source, id: newId('i') };
      return [...items.slice(0, rowIndex + 1), copy, ...items.slice(rowIndex + 1)];
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    commit(items => items.filter((_, i) => i !== rowIndex));
  };

  const handleBulkImport = (newItems: LineItem[]) => {
    commit(() => newItems);
  };

  const handleDragStart = (rowIndex: number, e: React.DragEvent<HTMLTableRowElement>) => {
    setDraggedRow(rowIndex);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(rowIndex));
  };

  const handleDragOver = (rowIndex: number, e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
    setDropTarget(prev =>
      prev && prev.row === rowIndex && prev.position === position ? prev : { row: rowIndex, position }
    );
  };

  const handleDrop = (dropIndex: number, e: React.DragEvent<HTMLTableRowElement>) => {
    e.preventDefault();
    const sourceIndex = draggedRow;
    const position = dropTarget?.position ?? 'before';
    setDraggedRow(null);
    setDropTarget(null);
    if (sourceIndex === null) return;

    commit(items => {
      const copy = [...items];
      const [moved] = copy.splice(sourceIndex, 1);
      let newIndex = position === 'before' ? dropIndex : dropIndex + 1;
      if (sourceIndex < newIndex) newIndex -= 1;
      copy.splice(newIndex, 0, moved);
      return copy;
    });
  };

  const handleDragEnd = () => {
    setDraggedRow(null);
    setDropTarget(null);
  };

  const handleCopy = useCallback((e: ClipboardEvent) => {
    if (!anchorCell || !focusCell) return;
    if (!containerRef.current?.contains(e.target as Node)) return;

    const minRow = Math.min(anchorCell.row, focusCell.row);
    const maxRow = Math.max(anchorCell.row, focusCell.row);
    const minCol = Math.min(anchorCell.col, focusCell.col);
    const maxCol = Math.max(anchorCell.col, focusCell.col);

    const rows: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      const cols: string[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        const key = COLUMN_KEYS[c];
        const value = String(items[r]?.[key] ?? '');
        cols.push(value);
      }
      rows.push(cols.join('\t'));
    }

    e.clipboardData?.setData('text/plain', rows.join('\n'));
    e.preventDefault();
  }, [anchorCell, focusCell, items]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    if (!focusCell) return;
    if (!containerRef.current?.contains(e.target as Node)) return;

    const text = e.clipboardData?.getData('text/plain');
    if (!text) return;

    const lines = text.trim().split('\n');
    const rows = lines.map(line => line.split('\t'));

    commit(items => {
      const newItems = [...items];
      const startRow = focusCell.row;
      const startCol = focusCell.col;

      for (let r = 0; r < rows.length; r++) {
        const targetRow = startRow + r;

        // Extend items array if needed
        while (newItems.length <= targetRow) {
          newItems.push({
            id: newId('i'),
            code: '',
            name: '',
            quantity: 1,
            unit: '式',
            unitPrice: 0,
            taxRate: 10,
          });
        }

        const cols = rows[r];
        for (let c = 0; c < cols.length && startCol + c < COLUMN_KEYS.length; c++) {
          const key = COLUMN_KEYS[startCol + c];
          const rawValue = cols[c].trim();

          if (!rawValue) continue;

          if (key === 'quantity' || key === 'unitPrice') {
            newItems[targetRow][key] = Number(rawValue) || 0;
          } else if (key === 'taxRate') {
            const num = Number(rawValue);
            newItems[targetRow][key] = num === 8 || num === 0 ? (num as TaxRate) : 10;
          } else {
            newItems[targetRow][key] = rawValue;
          }
        }
      }

      return newItems;
    });

    e.preventDefault();
  }, [focusCell, commit]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('copy', handleCopy as EventListener);
    container.addEventListener('paste', handlePaste as EventListener);

    return () => {
      container.removeEventListener('copy', handleCopy as EventListener);
      container.removeEventListener('paste', handlePaste as EventListener);
    };
  }, [handleCopy, handlePaste]);

  const calculateSubtotal = (item: LineItem): number => item.quantity * item.unitPrice;

  return (
    <div ref={containerRef} className="space-y-3">
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 py-6 text-center text-xs text-gray-400">
          明細行がありません
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-md">
          <table className="w-full min-w-[640px] border-collapse text-sm table-fixed select-none">
            <colgroup>
              <col className="w-8" />
              <col className="w-[13%]" />
              <col className="w-[27%]" />
              <col className="w-[9%]" />
              <col className="w-[9%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-16" />
            </colgroup>
            <thead>
              <tr className="bg-gray-50">
                <th className="border-b border-gray-200 px-2 py-2 text-left">
                  {/* Drag handle column */}
                </th>
                {COLUMN_LABELS.map((label, i) => (
                  <th
                    key={i}
                    className="border-b border-gray-200 px-2 py-2 text-left font-medium text-gray-700"
                  >
                    {label}
                  </th>
                ))}
                <th className="border-b border-gray-200 px-2 py-2 text-right font-medium text-gray-700">
                  小計
                </th>
                <th className="border-b border-gray-200 px-2 py-2 text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, rowIndex) => (
                <tr
                  key={item.id}
                  draggable
                  onDragStart={e => handleDragStart(rowIndex, e)}
                  onDragOver={e => handleDragOver(rowIndex, e)}
                  onDrop={e => handleDrop(rowIndex, e)}
                  onDragEnd={handleDragEnd}
                  className={`border-b border-gray-200 ${draggedRow === rowIndex ? 'bg-blue-50 opacity-50' : ''} hover:bg-gray-50 transition-colors ${
                    dropTarget?.row === rowIndex && dropTarget.position === 'before' ? 'border-t-2 border-t-blue-500' : ''
                  } ${
                    dropTarget?.row === rowIndex && dropTarget.position === 'after' ? 'border-b-2 border-b-blue-500' : ''
                  }`}
                >
                  {/* Drag handle */}
                  <td className="border-r border-gray-200 px-1 py-1 text-center text-gray-400">
                    <GripVertical size={16} />
                  </td>

                  {/* Code */}
                  <td
                    className={`border-r border-gray-200 px-2 py-1 ${isSelected(rowIndex, 0) ? 'bg-blue-100' : ''}`}
                    data-cell-row={rowIndex}
                    data-cell-col={0}
                    onMouseDown={e => handleCellMouseDown(rowIndex, 0, e)}
                  >
                    <input
                      type="text"
                      data-row={rowIndex}
                      data-col={0}
                      placeholder="品番(任意)"
                      value={item.code}
                      onChange={e => handleCellChange(rowIndex, 'code', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIndex, 0, e)}
                      className="w-full border-0 px-0 py-0 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    />
                  </td>

                  {/* Name */}
                  <td
                    className={`border-r border-gray-200 px-2 py-1 ${isSelected(rowIndex, 1) ? 'bg-blue-100' : ''}`}
                    data-cell-row={rowIndex}
                    data-cell-col={1}
                    onMouseDown={e => handleCellMouseDown(rowIndex, 1, e)}
                  >
                    <input
                      type="text"
                      data-row={rowIndex}
                      data-col={1}
                      placeholder="品名"
                      value={item.name}
                      onChange={e => handleCellChange(rowIndex, 'name', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIndex, 1, e)}
                      className="w-full border-0 px-0 py-0 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    />
                  </td>

                  {/* Quantity */}
                  <td
                    className={`border-r border-gray-200 px-2 py-1 text-center ${isSelected(rowIndex, 2) ? 'bg-blue-100' : ''}`}
                    data-cell-row={rowIndex}
                    data-cell-col={2}
                    onMouseDown={e => handleCellMouseDown(rowIndex, 2, e)}
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col={2}
                      value={item.quantity}
                      onChange={e => handleCellChange(rowIndex, 'quantity', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIndex, 2, e)}
                      className="w-full border-0 px-0 py-0 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    />
                  </td>

                  {/* Unit */}
                  <td
                    className={`border-r border-gray-200 px-2 py-1 text-center ${isSelected(rowIndex, 3) ? 'bg-blue-100' : ''}`}
                    data-cell-row={rowIndex}
                    data-cell-col={3}
                    onMouseDown={e => handleCellMouseDown(rowIndex, 3, e)}
                  >
                    <input
                      type="text"
                      data-row={rowIndex}
                      data-col={3}
                      placeholder="式"
                      value={item.unit}
                      onChange={e => handleCellChange(rowIndex, 'unit', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIndex, 3, e)}
                      className="w-full border-0 px-0 py-0 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    />
                  </td>

                  {/* Unit Price */}
                  <td
                    className={`border-r border-gray-200 px-2 py-1 text-right ${isSelected(rowIndex, 4) ? 'bg-blue-100' : ''}`}
                    data-cell-row={rowIndex}
                    data-cell-col={4}
                    onMouseDown={e => handleCellMouseDown(rowIndex, 4, e)}
                  >
                    <input
                      type="number"
                      inputMode="numeric"
                      data-row={rowIndex}
                      data-col={4}
                      value={item.unitPrice}
                      onChange={e => handleCellChange(rowIndex, 'unitPrice', e.target.value)}
                      onKeyDown={(e) => handleKeyDown(rowIndex, 4, e)}
                      className="w-full border-0 px-0 py-0 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    />
                  </td>

                  {/* Tax Rate */}
                  <td
                    className={`border-r border-gray-200 px-2 py-1 ${isSelected(rowIndex, 5) ? 'bg-blue-100' : ''}`}
                    data-cell-row={rowIndex}
                    data-cell-col={5}
                    onMouseDown={e => handleCellMouseDown(rowIndex, 5, e)}
                  >
                    <select
                      data-row={rowIndex}
                      data-col={5}
                      value={item.taxRate}
                      onChange={e => handleCellChange(rowIndex, 'taxRate', Number(e.target.value) as TaxRate)}
                      onKeyDown={(e) => handleKeyDown(rowIndex, 5, e)}
                      className="w-full border-0 px-0 py-0 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      <option value={10}>10%</option>
                      <option value={8}>8%</option>
                      <option value={0}>対象外</option>
                    </select>
                  </td>

                  {/* Subtotal (read-only) */}
                  <td className="border-r border-gray-200 px-2 py-1 text-right text-gray-600 text-xs tabular-nums">
                    ¥{calculateSubtotal(item).toLocaleString('ja-JP')}
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-1">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleDuplicateRow(rowIndex)}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                        title="この行を複製"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteRow(rowIndex)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                        title="この行を削除"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handleAddRow}
          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <Plus size={14} /> 明細行を追加
        </button>
        <button
          onClick={() => setBulkImportOpen(true)}
          className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          CSV形式で一括入力
        </button>
      </div>

      {bulkImportOpen && (
        <BulkImportDialog
          items={items}
          onImport={handleBulkImport}
          onClose={() => setBulkImportOpen(false)}
        />
      )}
    </div>
  );
}
