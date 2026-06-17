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
  documentNumber: string;
  referenceNumber: string;
  date: string;
  estimateNumber: string; // 見積書番号 (請求書・納品書のみ使用)
  recipientName: string;
  subject: string;
  condition: string;
}

export interface IssuerInfo {
  companyName: string;
  address1: string;
  address2: string;
  tel: string;
  email: string;
  registrationNumber: string;
  bankInfo: string;
  message: string;
}

export interface DocumentData {
  info: DocumentInfo;
  issuer: IssuerInfo;
  items: LineItem[];
}

export interface DocumentSet {
  id: string;
  estimate: DocumentData;
  invoice: DocumentData | null;
  delivery: DocumentData | null;
}

export interface FormgenFileV2 {
  version: 2;
  activeSetId: string;
  activeType: DocumentType;
  sets: DocumentSet[];
}
