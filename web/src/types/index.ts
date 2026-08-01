export type DocumentType = '見積書' | '請求書' | '納品書';

export const DOCUMENT_TYPES: DocumentType[] = ['見積書', '請求書', '納品書'];

export type TaxRate = 10 | 8 | 0;

export interface LineItem {
  id: string;         // ランタイム専用（React key用）。ファイルには保存しない
  code: string;       // 品番
  name: string;       // 品名
  quantity: number;   // 数量
  unit: string;       // 単位
  unitPrice: number;  // 単価
  taxRate: TaxRate;   // 税率
}

/** 1枚の帳票。宛名・件名・自社情報は持たず、上位から解決する */
export interface DocumentEntry {
  documentNumber: string;
  date: string;
  referenceNumber: string; // ご発注書番号
  estimateNumber: string;  // 見積書番号 (請求書・納品書のみ使用)
  condition: string;       // 見積有効期限 / 支払条件
  items: LineItem[];
}

export type DocumentMap = Partial<Record<DocumentType, DocumentEntry>>;

/** 案件 */
export interface Project {
  id: string;
  name: string; // = 帳票の「件名」
  documents: DocumentMap;
}

/** 取引先 */
export interface Client {
  id: string;
  name: string;
  honorific: string; // 様 / 御中
  projects: Project[];
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

export interface FormgenFileV3 {
  version: 3;
  issuer: IssuerInfo;
  clients: Client[];
}

/** PreviewPanel / FormPanel に渡す、解決済みの平坦な帳票データ */
export interface ResolvedDocument {
  type: DocumentType;
  clientName: string;    // 「株式会社マツムラ」
  honorific: string;     // 「様」
  recipientName: string; // 「株式会社マツムラ　様」
  subject: string;       // 案件名
  issuer: IssuerInfo;
  doc: DocumentEntry;
}

// ---------------------------------------------------------------------------
// 旧フォーマット（移行専用。UIからは参照しない）
// ---------------------------------------------------------------------------

export interface LegacyLineItem {
  id?: string;
  code?: string;
  name?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  taxRate?: TaxRate;
}

export interface LegacyDocumentInfo {
  type?: DocumentType;
  documentNumber?: string;
  referenceNumber?: string;
  date?: string;
  estimateNumber?: string;
  recipientName?: string;
  subject?: string;
  condition?: string;
}

export interface LegacyDocumentData {
  info?: LegacyDocumentInfo;
  issuer?: Partial<IssuerInfo>;
  items?: LegacyLineItem[];
}

export interface LegacyDocumentSet {
  id?: string;
  estimate?: LegacyDocumentData | null;
  invoice?: LegacyDocumentData | null;
  delivery?: LegacyDocumentData | null;
}

export interface LegacyFormgenFileV2 {
  version?: number;
  activeSetId?: string;
  activeType?: DocumentType;
  sets?: LegacyDocumentSet[];
}
