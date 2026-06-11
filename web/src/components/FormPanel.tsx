import React from 'react';
import { DocumentData, LineItem, DocumentType } from '@/types';
import { Printer, Plus, Trash2 } from 'lucide-react';

interface FormPanelProps {
  data: DocumentData;
  setData: React.Dispatch<React.SetStateAction<DocumentData>>;
  onPrint: () => void;
}

export default function FormPanel({ data, setData, onPrint }: FormPanelProps) {
  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setData(prev => ({
      ...prev,
      info: { ...prev.info, [name]: value }
    }));
  };

  const handleIssuerChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setData(prev => ({
      ...prev,
      issuer: { ...prev.issuer, [name]: value }
    }));
  };

  const handleItemChange = (id: string, field: keyof LineItem, value: any) => {
    setData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  const addItem = () => {
    const newItem: LineItem = {
      id: Date.now().toString(),
      code: '',
      name: '',
      quantity: 1,
      unit: '式',
      unitPrice: 0,
      taxRate: 10
    };
    setData(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const removeItem = (id: string) => {
    setData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-sm z-10 py-2 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800">帳票入力</h2>
        <button 
          onClick={onPrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors shadow-sm"
        >
          <Printer size={18} />
          印刷・PDF化
        </button>
      </div>

      {/* 基本情報 */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">基本情報</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">帳票種別</label>
            <select 
              name="type" 
              value={data.info.type} 
              onChange={handleInfoChange}
              className="w-full p-2 border border-gray-300 rounded-md bg-gray-50"
            >
              <option value="見積書">見積書</option>
              <option value="請求書">請求書</option>
              <option value="納品書">納品書</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">文書番号</label>
            <input type="text" name="documentNumber" value={data.info.documentNumber} onChange={handleInfoChange} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">日付</label>
            <input type="date" name="date" value={data.info.date} onChange={handleInfoChange} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">宛先 (敬称含め)</label>
            <input type="text" name="recipientName" value={data.info.recipientName} onChange={handleInfoChange} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">件名</label>
            <input type="text" name="subject" value={data.info.subject} onChange={handleInfoChange} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 mb-1">有効期限 / 支払条件</label>
            <input type="text" name="condition" value={data.info.condition} onChange={handleInfoChange} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
        </div>
      </section>

      {/* 明細情報 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">明細行</h3>
          <button onClick={addItem} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800">
            <Plus size={14} /> 追加
          </button>
        </div>
        
        <div className="space-y-3">
          {data.items.map((item, index) => (
            <div key={item.id} className="p-3 border border-gray-200 rounded-md bg-gray-50 relative group">
              <button 
                onClick={() => removeItem(item.id)}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={16} />
              </button>
              
              <div className="grid grid-cols-12 gap-2 pr-6">
                <div className="col-span-12">
                  <input type="text" placeholder="品名" value={item.name} onChange={(e) => handleItemChange(item.id, 'name', e.target.value)} className="w-full p-1.5 text-sm border border-gray-300 rounded" />
                </div>
                <div className="col-span-4">
                  <input type="text" placeholder="品番(任意)" value={item.code} onChange={(e) => handleItemChange(item.id, 'code', e.target.value)} className="w-full p-1.5 text-sm border border-gray-300 rounded text-xs" />
                </div>
                <div className="col-span-2">
                  <input type="number" inputMode="numeric" placeholder="数量" value={item.quantity} onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))} className="w-full p-1.5 text-sm border border-gray-300 rounded" />
                </div>
                <div className="col-span-2">
                  <input type="text" placeholder="単位" value={item.unit} onChange={(e) => handleItemChange(item.id, 'unit', e.target.value)} className="w-full p-1.5 text-sm border border-gray-300 rounded text-center" />
                </div>
                <div className="col-span-4">
                  <input type="number" inputMode="numeric" placeholder="単価" value={item.unitPrice} onChange={(e) => handleItemChange(item.id, 'unitPrice', Number(e.target.value))} className="w-full p-1.5 text-sm border border-gray-300 rounded text-right" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 発行者情報 */}
      <section className="space-y-4 pt-4 border-t border-gray-100">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">自社情報・備考</h3>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">会社名</label>
            <input type="text" name="companyName" value={data.issuer.companyName} onChange={handleIssuerChange} className="w-full p-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">住所</label>
            <input type="text" name="address1" value={data.issuer.address1} onChange={handleIssuerChange} className="w-full p-2 border border-gray-300 rounded-md text-sm mb-2" />
            <input type="text" name="address2" value={data.issuer.address2} onChange={handleIssuerChange} className="w-full p-2 border border-gray-300 rounded-md text-sm" placeholder="ビル名など" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">連絡先</label>
            <input type="text" name="tel" value={data.issuer.tel} onChange={handleIssuerChange} className="w-full p-2 border border-gray-300 rounded-md text-sm mb-2" />
            <input type="text" name="email" value={data.issuer.email} onChange={handleIssuerChange} className="w-full p-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">登録番号(インボイス)</label>
            <input type="text" name="registrationNumber" value={data.issuer.registrationNumber} onChange={handleIssuerChange} className="w-full p-2 border border-gray-300 rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">備考・振込先等</label>
            <textarea name="bankInfo" value={data.issuer.bankInfo} onChange={handleIssuerChange} rows={4} className="w-full p-2 border border-gray-300 rounded-md text-sm resize-y" />
          </div>
        </div>
      </section>
      
    </div>
  );
}
