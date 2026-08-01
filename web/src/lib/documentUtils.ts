import { format } from 'date-fns';
import {
  Client,
  DocumentEntry,
  DocumentType,
  DOCUMENT_TYPES,
  FormgenFileV3,
  Project,
  ResolvedDocument,
} from '@/types';
import { newId } from './formgenFile';

export function todayFormatted(): string {
  const d = new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function datePrefix(date: Date = new Date()): string {
  return format(date, 'yyyyMMdd');
}

/** ファイル全体を走査して YYYYMMDD-NNN の次番を返す */
export function nextDocumentNumber(file: FormgenFileV3, date: Date = new Date()): string {
  const prefix = datePrefix(date);
  let max = 0;
  for (const client of file.clients) {
    for (const project of client.projects) {
      for (const type of DOCUMENT_TYPES) {
        const doc = project.documents[type];
        if (!doc) continue;
        const match = doc.documentNumber.match(/^(\d{8})-(\d+)$/);
        if (match && match[1] === prefix) {
          max = Math.max(max, parseInt(match[2], 10));
        }
      }
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}

/**
 * 連番を続けて払い出す。案件の複製のように、1回のファイル更新で
 * 複数の帳票番号が要るときに使う（毎回 nextDocumentNumber を呼ぶと同じ番号になる）。
 */
export function documentNumberIssuer(file: FormgenFileV3, date: Date = new Date()): () => string {
  const [prefix, seq] = nextDocumentNumber(file, date).split('-');
  let next = parseInt(seq, 10);
  return () => `${prefix}-${String(next++).padStart(3, '0')}`;
}

export function emptyDocument(file: FormgenFileV3, type: DocumentType): DocumentEntry {
  return {
    documentNumber: nextDocumentNumber(file),
    date: todayFormatted(),
    referenceNumber: '',
    estimateNumber: '',
    condition: type === '見積書' ? '見積有効期限　2週間' : type === '請求書' ? '月末締め翌月末払い' : '',
    items: [],
  };
}

/** 見積書から請求書・納品書を生成する */
export function generateFromEstimate(
  estimate: DocumentEntry,
  targetType: '請求書' | '納品書',
  file: FormgenFileV3
): DocumentEntry {
  return {
    ...estimate,
    items: estimate.items.map(item => ({ ...item, id: newId('i') })),
    date: todayFormatted(),
    documentNumber: nextDocumentNumber(file),
    estimateNumber: estimate.documentNumber,
    condition: targetType === '請求書' ? '月末締め翌月末払い' : '',
  };
}

export function newProject(file: FormgenFileV3, name = ''): Project {
  return {
    id: newId('p'),
    name,
    documents: { 見積書: emptyDocument(file, '見積書') },
  };
}

export function newClient(name = ''): Client {
  return { id: newId('c'), name, honorific: '様', projects: [] };
}

export function findClient(file: FormgenFileV3, clientId: string | null): Client | undefined {
  if (!clientId) return undefined;
  return file.clients.find(c => c.id === clientId);
}

export function findProject(
  file: FormgenFileV3,
  clientId: string | null,
  projectId: string | null
): Project | undefined {
  if (!projectId) return undefined;
  return findClient(file, clientId)?.projects.find(p => p.id === projectId);
}

export function recipientNameOf(client: Client): string {
  return client.honorific ? `${client.name}　${client.honorific}` : client.name;
}

/**
 * issuer + 宛名 + 件名 + 帳票本体を合成して、描画用の平坦な形にする。
 * PreviewPanel / FormPanel はこの形だけを見る。
 */
export function resolveDocument(
  file: FormgenFileV3,
  clientId: string | null,
  projectId: string | null,
  type: DocumentType
): ResolvedDocument | null {
  const client = findClient(file, clientId);
  const project = findProject(file, clientId, projectId);
  if (!client || !project) return null;
  const doc = project.documents[type];
  if (!doc) return null;
  return {
    type,
    clientName: client.name,
    honorific: client.honorific,
    recipientName: recipientNameOf(client),
    subject: project.name,
    issuer: file.issuer,
    doc,
  };
}

/** 印刷時のファイル名・タブタイトル用 */
export function documentTitle(resolved: ResolvedDocument | null): string {
  if (!resolved) return '帳票作成ソフト';
  const name = resolved.recipientName.trim() || '名称未設定';
  return `${name}_${resolved.doc.documentNumber}`.replace(/[\s　]+/g, '');
}
