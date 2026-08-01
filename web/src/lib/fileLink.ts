/**
 * File System Access API を使ったファイル接続レイヤ。
 *
 * Dropbox フォルダ内の 1 ファイルをユーザーに選んでもらい、そのハンドルを
 * IndexedDB に保存しておく（localStorage はハンドルを保持できない）。
 * 以降は同じファイルを直接読み書きし、同期は Dropbox アプリに任せる。
 */

const DB_NAME = 'formgen';
const STORE_NAME = 'handles';
const HANDLE_KEY = 'current';

export const FILE_EXTENSION = '.formgen';
export const DEFAULT_FILE_NAME = `帳票データ${FILE_EXTENSION}`;

const filePickerOptions = {
  types: [
    {
      description: '帳票データ',
      accept: { 'text/yaml': [FILE_EXTENSION] as string[] },
    },
  ],
};

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

// ---------------------------------------------------------------------------
// IndexedDB (ハンドルの永続化)
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db =>
    new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const req = fn(tx.objectStore(STORE_NAME));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    })
  );
}

export async function loadStoredHandle(): Promise<FileSystemFileHandle | null> {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const handle = await withStore<FileSystemFileHandle | undefined>('readonly', s => s.get(HANDLE_KEY));
    return handle ?? null;
  } catch {
    return null;
  }
}

export async function storeHandle(handle: FileSystemFileHandle): Promise<void> {
  try {
    await withStore('readwrite', s => s.put(handle, HANDLE_KEY));
  } catch {
    // 保存できなくても致命的ではない（次回また選び直すだけ）
  }
}

export async function clearStoredHandle(): Promise<void> {
  try {
    await withStore('readwrite', s => s.delete(HANDLE_KEY));
  } catch {
    // noop
  }
}

// ---------------------------------------------------------------------------
// 権限
// ---------------------------------------------------------------------------

type PermissionState = 'granted' | 'denied' | 'prompt';

export async function queryPermission(handle: FileSystemFileHandle): Promise<PermissionState> {
  if (!handle.queryPermission) return 'prompt';
  return handle.queryPermission({ mode: 'readwrite' });
}

/** 権限の再取得。Chrome ではユーザー操作(クリック)の中から呼ぶ必要がある */
export async function requestPermission(handle: FileSystemFileHandle): Promise<boolean> {
  if ((await queryPermission(handle)) === 'granted') return true;
  if (!handle.requestPermission) return false;
  return (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
}

// ---------------------------------------------------------------------------
// ピッカー
// ---------------------------------------------------------------------------

/** ユーザーが操作をキャンセルした場合は null を返す */
export async function pickExistingFile(): Promise<FileSystemFileHandle | null> {
  try {
    const [handle] = await window.showOpenFilePicker!({ ...filePickerOptions, multiple: false });
    return handle ?? null;
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

export async function pickNewFile(suggestedName = DEFAULT_FILE_NAME): Promise<FileSystemFileHandle | null> {
  try {
    return await window.showSaveFilePicker!({ ...filePickerOptions, suggestedName });
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

// ---------------------------------------------------------------------------
// 読み書き
// ---------------------------------------------------------------------------

export interface ReadResult {
  text: string;
  lastModified: number;
}

export async function readFile(handle: FileSystemFileHandle): Promise<ReadResult> {
  const file = await handle.getFile();
  return { text: await file.text(), lastModified: file.lastModified };
}

/** 書き込み後の lastModified を返す（外部変更検知の基準になる） */
export async function writeFile(handle: FileSystemFileHandle, text: string): Promise<number> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
  const file = await handle.getFile();
  return file.lastModified;
}

export async function getLastModified(handle: FileSystemFileHandle): Promise<number | null> {
  try {
    return (await handle.getFile()).lastModified;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// フォールバック（File System Access API が無い環境向けの書き出し）
// ---------------------------------------------------------------------------

export function downloadText(text: string, fileName: string): void {
  const blob = new Blob([text], { type: 'text/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
