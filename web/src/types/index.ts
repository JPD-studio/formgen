export type DocumentType = '見積書' | '請求書' | '納品書';

export type TaxRate = 10 | 8 | 0;

export interface LineItem {
  id: string;
  code: string;       // 品番
  name: string;       // 品名
  quantity: number;   // 数量
  unit: string;       // 単位
  unitPrice: number;  // 単価
  taxRate: TaxRate;   // 税率
}

export interface DocumentInfo {
  type: DocumentType;
  documentNumber: string; // 見積番号など
  referenceNumber: string; // ご発注書番号など (任意)
  date: string;
  recipientName: string; // 宛先 (株式会社〇〇 様)
  subject: string; // 件名
  condition: string; // 有効期限、または支払条件
}

export interface IssuerInfo {
  companyName: string;
  address1: string; // 〒〇〇〇-〇〇〇〇 住所
  address2: string; // ビル名など
  tel: string;
  email: string;
  registrationNumber: string; // 登録番号(インボイス)
  bankInfo: string; // 振込先情報など (複数行可)
  message: string; // 挨拶文など
}

export interface DocumentData {
  info: DocumentInfo;
  issuer: IssuerInfo;
  items: LineItem[];
}
