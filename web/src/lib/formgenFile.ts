import YAML from 'yaml';
import {
  Client,
  DocumentEntry,
  DocumentMap,
  DocumentType,
  DOCUMENT_TYPES,
  FormgenFileV3,
  IssuerInfo,
  LegacyDocumentData,
  LegacyDocumentSet,
  LegacyFormgenFileV2,
  LineItem,
  Project,
  TaxRate,
} from '@/types';

// ---------------------------------------------------------------------------
// ID生成
// ---------------------------------------------------------------------------

let idCounter = 0;

/** 短くて衝突しないID。Date.now() だと同一ミリ秒で衝突するのでカウンタを混ぜる */
export function newId(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${rand}${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// 既定値
// ---------------------------------------------------------------------------

export const emptyIssuer: IssuerInfo = {
  companyName: '',
  address1: '',
  address2: '',
  tel: '',
  email: '',
  registrationNumber: '',
  bankInfo: '',
  message: '',
};

export function emptyFile(): FormgenFileV3 {
  return { version: 3, issuer: { ...emptyIssuer }, clients: [] };
}

// ---------------------------------------------------------------------------
// 正規化ヘルパー（壊れた値でも既定値で埋めて読み込みを続行する）
// ---------------------------------------------------------------------------

function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return fallback;
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function taxRate(v: unknown): TaxRate {
  const n = num(v, 10);
  return n === 8 ? 8 : n === 0 ? 0 : 10;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// ---------------------------------------------------------------------------
// パース
// ---------------------------------------------------------------------------

function parseItem(raw: unknown): LineItem {
  const o = isRecord(raw) ? raw : {};
  return {
    id: newId('i'),
    code: str(o.code),
    name: str(o.name),
    quantity: num(o.qty ?? o.quantity, 1),
    unit: str(o.unit, '式'),
    unitPrice: num(o.price ?? o.unitPrice, 0),
    taxRate: taxRate(o.tax ?? o.taxRate),
  };
}

function parseDocument(raw: unknown): DocumentEntry {
  const o = isRecord(raw) ? raw : {};
  return {
    documentNumber: str(o.number ?? o.documentNumber),
    date: str(o.date),
    referenceNumber: str(o.referenceNumber),
    estimateNumber: str(o.estimateNumber),
    condition: str(o.condition),
    items: arr(o.items).map(parseItem),
  };
}

function parseDocumentMap(raw: unknown): DocumentMap {
  const o = isRecord(raw) ? raw : {};
  const map: DocumentMap = {};
  for (const type of DOCUMENT_TYPES) {
    if (o[type] != null) map[type] = parseDocument(o[type]);
  }
  return map;
}

function parseProject(raw: unknown, index: number): Project {
  const o = isRecord(raw) ? raw : {};
  return {
    id: str(o.id) || newId('p'),
    name: str(o.name, `案件${index + 1}`),
    documents: parseDocumentMap(o.documents),
  };
}

function parseClient(raw: unknown, index: number): Client {
  const o = isRecord(raw) ? raw : {};
  return {
    id: str(o.id) || newId('c'),
    name: str(o.name, `取引先${index + 1}`),
    honorific: str(o.honorific, '様'),
    projects: arr(o.projects).map(parseProject),
  };
}

function parseIssuer(raw: unknown): IssuerInfo {
  const o = isRecord(raw) ? raw : {};
  return {
    companyName: str(o.companyName),
    address1: str(o.address1),
    address2: str(o.address2),
    tel: str(o.tel),
    email: str(o.email),
    registrationNumber: str(o.registrationNumber),
    bankInfo: str(o.bankInfo),
    message: str(o.message),
  };
}

function parseV3(o: Record<string, unknown>): FormgenFileV3 {
  const clients = arr(o.clients).map(parseClient);
  return { version: 3, issuer: parseIssuer(o.issuer), clients: dedupeIds(clients) };
}

/** 手編集でIDが重複・欠落しても選択が壊れないよう、読み込み時に一意化する */
function dedupeIds(clients: Client[]): Client[] {
  const seen = new Set<string>();
  const uniq = (id: string, prefix: string) => {
    if (!id || seen.has(id)) {
      let next = newId(prefix);
      while (seen.has(next)) next = newId(prefix);
      seen.add(next);
      return next;
    }
    seen.add(id);
    return id;
  };
  return clients.map(c => ({
    ...c,
    id: uniq(c.id, 'c'),
    projects: c.projects.map(p => ({ ...p, id: uniq(p.id, 'p') })),
  }));
}

// ---------------------------------------------------------------------------
// 旧フォーマットからの移行
// ---------------------------------------------------------------------------

const HONORIFIC_RE = /[\s　]*(様|御中)[\s　]*$/;

/** 「株式会社マツムラ　様」→ { name: '株式会社マツムラ', honorific: '様' } */
export function splitHonorific(recipient: string): { name: string; honorific: string } {
  const trimmed = recipient.trim();
  const m = trimmed.match(HONORIFIC_RE);
  if (m) return { name: trimmed.replace(HONORIFIC_RE, '').trim(), honorific: m[1] };
  return { name: trimmed, honorific: '様' };
}

function legacyDocToEntry(d: LegacyDocumentData): DocumentEntry {
  const info = d.info ?? {};
  return {
    documentNumber: str(info.documentNumber),
    date: str(info.date),
    referenceNumber: str(info.referenceNumber),
    estimateNumber: str(info.estimateNumber),
    condition: str(info.condition),
    items: arr(d.items).map(parseItem),
  };
}

/** v2 (フラットな DocumentSet[]) → v3 (取引先 → 案件 → 帳票) */
function migrateV2(v2: LegacyFormgenFileV2): FormgenFileV3 {
  const sets = arr(v2.sets) as LegacyDocumentSet[];

  // issuer は最初に見つかった非空のものを採用
  let issuer: IssuerInfo = { ...emptyIssuer };
  for (const set of sets) {
    const found = set?.estimate?.issuer ?? set?.invoice?.issuer ?? set?.delivery?.issuer;
    if (found && str(found.companyName)) {
      issuer = parseIssuer(found);
      break;
    }
  }

  const byClient = new Map<string, Client>();

  sets.forEach((set, setIndex) => {
    if (!set) return;
    const source = set.estimate ?? set.invoice ?? set.delivery;
    const recipient = str(source?.info?.recipientName, '名称未設定');
    const { name, honorific } = splitHonorific(recipient || '名称未設定');
    const key = name || '名称未設定';

    let client = byClient.get(key);
    if (!client) {
      client = { id: newId('c'), name: key, honorific, projects: [] };
      byClient.set(key, client);
    }

    const documents: DocumentMap = {};
    const slots: [DocumentType, LegacyDocumentData | null | undefined][] = [
      ['見積書', set.estimate],
      ['請求書', set.invoice],
      ['納品書', set.delivery],
    ];
    for (const [type, doc] of slots) {
      if (doc) documents[type] = legacyDocToEntry(doc);
    }

    client.projects.push({
      id: newId('p'),
      name: str(source?.info?.subject) || `案件${setIndex + 1}`,
      documents,
    });
  });

  return { version: 3, issuer, clients: [...byClient.values()] };
}

/** v1 (単体 DocumentData) → v2 相当 */
function v1ToV2(v1: LegacyDocumentData): LegacyFormgenFileV2 {
  const type = v1.info?.type ?? '見積書';
  return {
    version: 2,
    sets: [{
      // 元が単体でどの帳票種別だったかだけを再現する。存在しない種別を捏造しない
      // （例: 請求書のみのv1ファイルを、同一内容の見積書付きとして移行しない）
      estimate: type === '見積書' ? v1 : null,
      invoice: type === '請求書' ? v1 : null,
      delivery: type === '納品書' ? v1 : null,
    }],
  };
}

// ---------------------------------------------------------------------------
// 公開API
// ---------------------------------------------------------------------------

/**
 * .formgen の中身をパースする。
 * YAML は JSON のスーパーセットなので、旧 v1/v2 の JSON もこの経路で読める。
 */
export function parseFormgenText(text: string): FormgenFileV3 {
  const raw: unknown = YAML.parse(text);
  return parseFormgenValue(raw);
}

export function parseFormgenValue(raw: unknown): FormgenFileV3 {
  if (!isRecord(raw)) throw new Error('ファイルの中身が想定した形式ではありません');

  const version = num(raw.version, 0);
  if (version >= 3) return parseV3(raw);
  if (version === 2 || Array.isArray(raw.sets)) return migrateV2(raw as LegacyFormgenFileV2);
  if (isRecord(raw.info) || Array.isArray(raw.items)) return migrateV2(v1ToV2(raw as LegacyDocumentData));

  throw new Error('対応していないファイル形式です');
}

/** 空文字・既定値を落として、手編集しやすい YAML にする */
function toPlain(file: FormgenFileV3): Record<string, unknown> {
  const issuer: Record<string, string> = {};
  for (const [k, v] of Object.entries(file.issuer)) {
    if (v) issuer[k] = v;
  }

  return {
    version: 3,
    issuer,
    clients: file.clients.map(c => ({
      id: c.id,
      name: c.name,
      honorific: c.honorific,
      projects: c.projects.map(p => {
        const documents: Record<string, unknown> = {};
        for (const type of DOCUMENT_TYPES) {
          const d = p.documents[type];
          if (!d) continue;
          const entry: Record<string, unknown> = {};
          if (d.documentNumber) entry.number = d.documentNumber;
          if (d.date) entry.date = d.date;
          if (d.referenceNumber) entry.referenceNumber = d.referenceNumber;
          if (d.estimateNumber) entry.estimateNumber = d.estimateNumber;
          if (d.condition) entry.condition = d.condition;
          entry.items = d.items.map(item => {
            const out: Record<string, unknown> = {};
            if (item.code) out.code = item.code;
            out.name = item.name;
            out.qty = item.quantity;
            if (item.unit) out.unit = item.unit;
            out.price = item.unitPrice;
            if (item.taxRate !== 10) out.tax = item.taxRate;
            return out;
          });
          documents[type] = entry;
        }
        return { id: p.id, name: p.name, documents };
      }),
    })),
  };
}

export function serializeFormgenFile(file: FormgenFileV3): string {
  return YAML.stringify(toPlain(file), {
    lineWidth: 0,        // 日本語が勝手に折り返されないように
    blockQuote: 'literal', // 複数行文字列は | 記法（\n エスケープを避ける）
    defaultStringType: 'PLAIN',
    defaultKeyType: 'PLAIN',
    indent: 2,
    nullStr: '',
  });
}
