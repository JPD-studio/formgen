import { format } from 'date-fns';
import { DocumentData, DocumentSet, DocumentType, FormgenFileV2, IssuerInfo } from '@/types';

export function todayFormatted(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function datePrefix(date: Date = new Date()): string {
  return format(date, 'yyyyMMdd');
}

export function nextDocumentNumber(sets: DocumentSet[], date: Date = new Date()): string {
  const prefix = datePrefix(date);
  let max = 0;
  for (const set of sets) {
    for (const doc of [set.estimate, set.invoice, set.delivery]) {
      if (!doc) continue;
      const match = doc.info.documentNumber.match(/^(\d{8})-(\d+)$/);
      if (match && match[1] === prefix) {
        max = Math.max(max, parseInt(match[2], 10));
      }
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

export function generateFromEstimate(
  estimate: DocumentData,
  targetType: '請求書' | '納品書',
  sets: DocumentSet[]
): DocumentData {
  const today = new Date();
  return {
    ...estimate,
    items: estimate.items.map(item => ({ ...item })), // ディープコピー
    info: {
      ...estimate.info,
      type: targetType,
      date: todayFormatted(),
      documentNumber: nextDocumentNumber(sets, today),
      estimateNumber: estimate.info.documentNumber,
      condition: targetType === '請求書' ? '月末締め翌月末払い' : '',
    },
  };
}

export function typeKeyOf(type: DocumentType): 'estimate' | 'invoice' | 'delivery' {
  if (type === '見積書') return 'estimate';
  if (type === '請求書') return 'invoice';
  return 'delivery';
}

const defaultIssuer: IssuerInfo = {
  companyName: '',
  address1: '',
  address2: '',
  tel: '',
  email: '',
  registrationNumber: '',
  bankInfo: '',
  message: '',
};

export function createNewSet(
  existingIssuer?: IssuerInfo,
  existingSets: DocumentSet[] = [],
  id?: string
): DocumentSet {
  const setId = id ?? `set-${Date.now()}`;
  const today = new Date();
  const estimate: DocumentData = {
    info: {
      type: '見積書',
      documentNumber: nextDocumentNumber(existingSets, today),
      referenceNumber: '',
      date: todayFormatted(),
      estimateNumber: '',
      recipientName: '',
      subject: '',
      condition: '見積有効期限　2週間',
    },
    issuer: existingIssuer ?? defaultIssuer,
    items: [],
  };
  return { id: setId, estimate, invoice: null, delivery: null };
}

export function parseFormgenFile(json: unknown): FormgenFileV2 {
  if (typeof json !== 'object' || json === null) throw new Error('Invalid file');

  // v2
  if ('version' in json && (json as Record<string, unknown>).version === 2) {
    return json as FormgenFileV2;
  }

  // v1 (旧フォーマット: DocumentData単体)
  const v1 = json as DocumentData & { info?: { type?: DocumentType } };
  const setId = `set-${Date.now()}`;
  const docType: DocumentType = v1.info?.type ?? '見積書';

  const doc: DocumentData = {
    ...v1,
    info: { ...v1.info, estimateNumber: '' } as DocumentData['info'],
  };

  const set: DocumentSet = {
    id: setId,
    estimate: docType === '見積書' ? doc : { ...doc, info: { ...doc.info, type: '見積書', estimateNumber: '' } },
    invoice: docType === '請求書' ? doc : null,
    delivery: docType === '納品書' ? doc : null,
  };

  return {
    version: 2,
    activeSetId: setId,
    activeType: docType,
    sets: [set],
  };
}
