'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  Client,
  DocumentEntry,
  DocumentType,
  FormgenFileV3,
  IssuerInfo,
  LineItem,
  Project,
} from '@/types';
import {
  emptyFile,
  newId,
  parseFormgenText,
  parseFormgenValue,
  serializeFormgenFile,
} from './formgenFile';
import {
  documentNumberIssuer,
  emptyDocument,
  findProject,
  generateFromEstimate,
  newClient,
  newProject,
} from './documentUtils';
import * as fileLink from './fileLink';

const UI_KEY = 'formgen_ui';
const BACKUP_KEY = 'formgen_backup_v3';
const LEGACY_KEYS = ['formgen_v2_data', 'formgen_saved_data'];
const AUTOSAVE_DELAY = 1500;
const EXTERNAL_POLL_INTERVAL = 30_000;

export type SaveStatus = 'disconnected' | 'saved' | 'dirty' | 'saving' | 'error';

export interface UiState {
  activeClientId: string | null;
  activeProjectId: string | null;
  activeType: DocumentType;
  expandedClientIds: string[];
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}

interface State {
  file: FormgenFileV3;
  ui: UiState;
  connected: boolean;
  fileName: string;
  saveStatus: SaveStatus;
  errorMessage: string | null;
  /** 権限の再取得待ち（保存済みハンドルはあるが granted ではない） */
  needsReconnect: boolean;
  /** ファイルが外部で変更され、こちらにも未保存の変更がある状態 */
  conflict: boolean;
  /** 移行待ちの旧 localStorage データ */
  pendingMigration: FormgenFileV3 | null;
  ready: boolean;
}

type Action =
  | { type: 'init'; ui: UiState; pendingMigration: FormgenFileV3 | null }
  | { type: 'connected'; file: FormgenFileV3; fileName: string }
  | { type: 'disconnected' }
  | { type: 'needsReconnect'; fileName: string }
  | { type: 'reloaded'; file: FormgenFileV3 }
  | { type: 'saveStatus'; status: SaveStatus; message?: string | null }
  | { type: 'conflict'; value: boolean }
  | { type: 'clearPendingMigration' }
  | { type: 'setFile'; file: FormgenFileV3 }
  | { type: 'patchFile'; fn: (file: FormgenFileV3) => FormgenFileV3 }
  | { type: 'patchUi'; ui: Partial<UiState> };

const defaultUi: UiState = {
  activeClientId: null,
  activeProjectId: null,
  activeType: '見積書',
  expandedClientIds: [],
  sidebarWidth: 260,
  sidebarCollapsed: false,
};

const initialState: State = {
  file: emptyFile(),
  ui: defaultUi,
  connected: false,
  fileName: '',
  saveStatus: 'disconnected',
  errorMessage: null,
  needsReconnect: false,
  conflict: false,
  pendingMigration: null,
  ready: false,
};

/** 選択中の取引先・案件が消えたら、妥当な位置に寄せ直す */
function reconcileSelection(file: FormgenFileV3, ui: UiState): UiState {
  const client = file.clients.find(c => c.id === ui.activeClientId) ?? file.clients[0];
  if (!client) {
    return { ...ui, activeClientId: null, activeProjectId: null };
  }
  const project = client.projects.find(p => p.id === ui.activeProjectId);
  if (project) {
    const type = project.documents[ui.activeType] ? ui.activeType : '見積書';
    return { ...ui, activeClientId: client.id, activeType: type };
  }
  const fallback = client.projects[0] ?? null;
  return {
    ...ui,
    activeClientId: client.id,
    activeProjectId: fallback?.id ?? null,
    activeType: '見積書',
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'init':
      return { ...state, ui: action.ui, pendingMigration: action.pendingMigration, ready: true };

    case 'connected':
      return {
        ...state,
        file: action.file,
        ui: reconcileSelection(action.file, state.ui),
        connected: true,
        fileName: action.fileName,
        saveStatus: 'saved',
        errorMessage: null,
        needsReconnect: false,
        conflict: false,
        pendingMigration: null,
        ready: true,
      };

    case 'reloaded':
      return {
        ...state,
        file: action.file,
        ui: reconcileSelection(action.file, state.ui),
        saveStatus: 'saved',
        conflict: false,
      };

    case 'disconnected':
      return { ...state, connected: false, needsReconnect: false, fileName: '', saveStatus: 'disconnected' };

    case 'needsReconnect':
      return { ...state, needsReconnect: true, fileName: action.fileName, saveStatus: 'disconnected', ready: true };

    case 'saveStatus':
      return { ...state, saveStatus: action.status, errorMessage: action.message ?? null };

    case 'conflict':
      return { ...state, conflict: action.value };

    case 'clearPendingMigration':
      return { ...state, pendingMigration: null };

    case 'setFile':
      return { ...state, file: action.file, ui: reconcileSelection(action.file, state.ui), saveStatus: 'dirty' };

    case 'patchFile': {
      const file = action.fn(state.file);
      if (file === state.file) return state;
      return {
        ...state,
        file,
        ui: reconcileSelection(file, state.ui),
        saveStatus: state.connected ? 'dirty' : state.saveStatus,
      };
    }

    case 'patchUi':
      return { ...state, ui: { ...state.ui, ...action.ui } };
  }
}

// ---------------------------------------------------------------------------
// 不変更新ヘルパー
// ---------------------------------------------------------------------------

function mapClient(file: FormgenFileV3, clientId: string, fn: (c: Client) => Client): FormgenFileV3 {
  return { ...file, clients: file.clients.map(c => (c.id === clientId ? fn(c) : c)) };
}

function mapProject(
  file: FormgenFileV3,
  clientId: string,
  projectId: string,
  fn: (p: Project) => Project
): FormgenFileV3 {
  return mapClient(file, clientId, c => ({
    ...c,
    projects: c.projects.map(p => (p.id === projectId ? fn(p) : p)),
  }));
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface StoreValue extends State {
  activeClient: Client | undefined;
  activeProject: Project | undefined;
  activeDocument: DocumentEntry | undefined;

  // ファイル操作
  openFile: () => Promise<void>;
  createFile: () => Promise<void>;
  reconnect: () => Promise<void>;
  disconnect: () => Promise<void>;
  saveNow: () => Promise<void>;
  exportBackup: () => void;
  resolveConflict: (choice: 'reload' | 'overwrite') => Promise<void>;
  migratePending: () => Promise<void>;
  dismissPendingMigration: () => void;

  // 選択
  selectProject: (clientId: string, projectId: string) => void;
  setActiveType: (type: DocumentType) => void;
  toggleClientExpanded: (clientId: string) => void;
  setClientExpanded: (clientId: string, expanded: boolean) => void;
  patchUi: (ui: Partial<UiState>) => void;

  // 編集
  addClient: (name?: string) => string;
  renameClient: (clientId: string, name: string, honorific?: string) => void;
  deleteClient: (clientId: string) => void;
  addProject: (clientId: string, name?: string) => string;
  renameProject: (clientId: string, projectId: string, name: string) => void;
  duplicateProject: (clientId: string, projectId: string) => void;
  deleteProject: (clientId: string, projectId: string) => void;
  updateDocument: (patch: Partial<DocumentEntry>) => void;
  updateItems: (fn: (items: LineItem[]) => LineItem[]) => void;
  ensureDocument: (type: DocumentType) => void;
  deleteDocument: (type: DocumentType) => void;
  updateIssuer: (patch: Partial<IssuerInfo>) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore は FormgenProvider の内側で使ってください');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function FormgenProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleRef = useRef<FileSystemFileHandle | null>(null);
  const lastModifiedRef = useRef<number>(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef(state.file);
  const dirtyRef = useRef(false);
  const conflictRef = useRef(false);

  // タイマー・focus ハンドラなど、レンダー外から最新値を見るための同期
  useEffect(() => {
    fileRef.current = state.file;
    dirtyRef.current = state.saveStatus === 'dirty' || state.saveStatus === 'saving';
    conflictRef.current = state.conflict;
  }, [state.file, state.saveStatus, state.conflict]);

  // --- UI状態の永続化 --------------------------------------------------------
  useEffect(() => {
    if (!state.ready) return;
    localStorage.setItem(UI_KEY, JSON.stringify(state.ui));
  }, [state.ui, state.ready]);

  // --- 接続 ------------------------------------------------------------------

  const connect = useCallback(async (handle: FileSystemFileHandle, initial?: FormgenFileV3) => {
    handleRef.current = handle;
    await fileLink.storeHandle(handle);

    if (initial) {
      const text = serializeFormgenFile(initial);
      lastModifiedRef.current = await fileLink.writeFile(handle, text);
      localStorage.setItem(BACKUP_KEY, text);
      dispatch({ type: 'connected', file: initial, fileName: handle.name });
      return;
    }

    const { text, lastModified } = await fileLink.readFile(handle);
    lastModifiedRef.current = lastModified;

    if (!text.trim()) {
      // 空ファイル（新規作成直後など）は空データとして扱う
      const empty = emptyFile();
      const serialized = serializeFormgenFile(empty);
      lastModifiedRef.current = await fileLink.writeFile(handle, serialized);
      dispatch({ type: 'connected', file: empty, fileName: handle.name });
      return;
    }

    const parsed = parseFormgenText(text);
    localStorage.setItem(BACKUP_KEY, serializeFormgenFile(parsed));
    dispatch({ type: 'connected', file: parsed, fileName: handle.name });
  }, []);

  const restoreHandle = useCallback(async () => {
    const handle = await fileLink.loadStoredHandle();
    if (!handle) return;
    handleRef.current = handle;
    const permission = await fileLink.queryPermission(handle);
    if (permission === 'granted') {
      try {
        await connect(handle);
      } catch {
        dispatch({ type: 'needsReconnect', fileName: handle.name });
      }
    } else {
      dispatch({ type: 'needsReconnect', fileName: handle.name });
    }
  }, [connect]);

  // --- 起動時: UI状態の復元と、旧データの検出 --------------------------------
  useEffect(() => {
    let ui = defaultUi;
    try {
      const raw = localStorage.getItem(UI_KEY);
      if (raw) ui = { ...defaultUi, ...JSON.parse(raw) };
    } catch {
      // 壊れていたら既定値
    }

    let pending: FormgenFileV3 | null = null;
    for (const key of LEGACY_KEYS) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        pending = parseFormgenValue(JSON.parse(raw));
        break;
      } catch {
        // 次のキーを試す
      }
    }
    if (!pending) {
      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        try {
          pending = parseFormgenText(backup);
        } catch {
          // noop
        }
      }
    }

    dispatch({ type: 'init', ui, pendingMigration: pending });
    void restoreHandle();
  }, [restoreHandle]);

  const openFile = useCallback(async () => {
    const handle = await fileLink.pickExistingFile();
    if (!handle) return;
    try {
      await connect(handle);
    } catch (e) {
      dispatch({ type: 'saveStatus', status: 'error', message: messageOf(e) });
    }
  }, [connect]);

  const createFile = useCallback(async () => {
    const handle = await fileLink.pickNewFile();
    if (!handle) return;
    // 接続済みなら「別名で保存」、未接続なら移行データ or 空ファイル
    const initial = state.connected ? state.file : (state.pendingMigration ?? emptyFile());
    try {
      await connect(handle, initial);
    } catch (e) {
      dispatch({ type: 'saveStatus', status: 'error', message: messageOf(e) });
    }
  }, [connect, state.connected, state.file, state.pendingMigration]);

  const reconnect = useCallback(async () => {
    const handle = handleRef.current ?? (await fileLink.loadStoredHandle());
    if (!handle) return;
    const ok = await fileLink.requestPermission(handle);
    if (!ok) return;
    try {
      await connect(handle);
    } catch (e) {
      dispatch({ type: 'saveStatus', status: 'error', message: messageOf(e) });
    }
  }, [connect]);

  const disconnect = useCallback(async () => {
    handleRef.current = null;
    await fileLink.clearStoredHandle();
    dispatch({ type: 'disconnected' });
  }, []);

  // --- 保存 ------------------------------------------------------------------

  const writeNow = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle) return;
    const snapshot = fileRef.current;
    dispatch({ type: 'saveStatus', status: 'saving' });
    try {
      const text = serializeFormgenFile(snapshot);
      lastModifiedRef.current = await fileLink.writeFile(handle, text);
      localStorage.setItem(BACKUP_KEY, text);
      // 書き込み中にさらに編集されていたら dirty のままにして再保存させる
      dispatch({ type: 'saveStatus', status: fileRef.current === snapshot ? 'saved' : 'dirty' });
    } catch (e) {
      dispatch({ type: 'saveStatus', status: 'error', message: messageOf(e) });
    }
  }, []);

  const saveNow = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await writeNow();
  }, [writeNow]);

  // dirty になったらデバウンスして自動保存
  useEffect(() => {
    if (state.saveStatus !== 'dirty' || !state.connected || state.conflict) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => void writeNow(), AUTOSAVE_DELAY);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state.saveStatus, state.connected, state.conflict, state.file, writeNow]);

  // 未接続でも、クラッシュ復旧用にローカルへ控えておく
  useEffect(() => {
    if (!state.ready || state.connected) return;
    if (state.file.clients.length === 0 && !state.file.issuer.companyName) return;
    localStorage.setItem(BACKUP_KEY, serializeFormgenFile(state.file));
  }, [state.file, state.connected, state.ready]);

  // --- 外部変更の検知 --------------------------------------------------------

  const checkExternalChange = useCallback(async () => {
    const handle = handleRef.current;
    if (!handle || conflictRef.current) return;
    const lm = await fileLink.getLastModified(handle);
    if (lm == null || lm <= lastModifiedRef.current) return;

    if (dirtyRef.current) {
      dispatch({ type: 'conflict', value: true });
      return;
    }
    try {
      const { text, lastModified } = await fileLink.readFile(handle);
      lastModifiedRef.current = lastModified;
      dispatch({ type: 'reloaded', file: parseFormgenText(text) });
    } catch {
      // 同期途中の中途半端な内容だった場合は次のポーリングで拾う
    }
  }, []);

  useEffect(() => {
    if (!state.connected) return;
    const onFocus = () => void checkExternalChange();
    window.addEventListener('focus', onFocus);
    const timer = setInterval(() => void checkExternalChange(), EXTERNAL_POLL_INTERVAL);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(timer);
    };
  }, [state.connected, checkExternalChange]);

  const resolveConflict = useCallback(async (choice: 'reload' | 'overwrite') => {
    const handle = handleRef.current;
    if (!handle) return;
    if (choice === 'reload') {
      try {
        const { text, lastModified } = await fileLink.readFile(handle);
        lastModifiedRef.current = lastModified;
        dispatch({ type: 'reloaded', file: parseFormgenText(text) });
      } catch (e) {
        dispatch({ type: 'saveStatus', status: 'error', message: messageOf(e) });
      }
    } else {
      dispatch({ type: 'conflict', value: false });
      await writeNow();
    }
  }, [writeNow]);

  // --- PWA File Handling (Dropbox フォルダで .formgen をダブルクリック) -------
  useEffect(() => {
    if (typeof window === 'undefined' || !window.launchQueue) return;
    window.launchQueue.setConsumer(params => {
      const handle = params.files?.[0];
      if (!handle) return;
      void (async () => {
        try {
          await connect(handle);
        } catch (e) {
          dispatch({ type: 'saveStatus', status: 'error', message: messageOf(e) });
        }
      })();
    });
  }, [connect]);

  // --- 移行 ------------------------------------------------------------------

  const migratePending = useCallback(async () => {
    if (!state.pendingMigration) return;
    await createFile();
  }, [createFile, state.pendingMigration]);

  const dismissPendingMigration = useCallback(() => {
    dispatch({ type: 'clearPendingMigration' });
  }, []);

  const exportBackup = useCallback(() => {
    fileLink.downloadText(
      serializeFormgenFile(fileRef.current),
      state.fileName || fileLink.DEFAULT_FILE_NAME
    );
  }, [state.fileName]);

  // --- 選択 ------------------------------------------------------------------

  const patchUi = useCallback((ui: Partial<UiState>) => dispatch({ type: 'patchUi', ui }), []);

  const selectProject = useCallback((clientId: string, projectId: string) => {
    dispatch({ type: 'patchUi', ui: { activeClientId: clientId, activeProjectId: projectId, activeType: '見積書' } });
  }, []);

  const setActiveType = useCallback((activeType: DocumentType) => {
    dispatch({ type: 'patchUi', ui: { activeType } });
  }, []);

  // --- 編集 ------------------------------------------------------------------

  const patchFile = useCallback((fn: (file: FormgenFileV3) => FormgenFileV3) => {
    dispatch({ type: 'patchFile', fn });
  }, []);

  const value = useMemo<StoreValue>(() => {
    const activeClient = state.file.clients.find(c => c.id === state.ui.activeClientId);
    const activeProject = activeClient?.projects.find(p => p.id === state.ui.activeProjectId);
    const activeDocument = activeProject?.documents[state.ui.activeType];

    const expandClient = (clientId: string, expanded: boolean) => {
      const set = new Set(state.ui.expandedClientIds);
      if (expanded) set.add(clientId);
      else set.delete(clientId);
      patchUi({ expandedClientIds: [...set] });
    };

    return {
      ...state,
      activeClient,
      activeProject,
      activeDocument,

      openFile,
      createFile,
      reconnect,
      disconnect,
      saveNow,
      exportBackup,
      resolveConflict,
      migratePending,
      dismissPendingMigration,

      selectProject,
      setActiveType,
      patchUi,
      setClientExpanded: expandClient,
      toggleClientExpanded: (clientId: string) =>
        expandClient(clientId, !state.ui.expandedClientIds.includes(clientId)),

      addClient: (name = '') => {
        const client = newClient(name);
        patchFile(file => ({ ...file, clients: [...file.clients, client] }));
        patchUi({
          activeClientId: client.id,
          activeProjectId: null,
          expandedClientIds: [...state.ui.expandedClientIds, client.id],
        });
        return client.id;
      },

      renameClient: (clientId, name, honorific) => {
        patchFile(file =>
          mapClient(file, clientId, c => ({ ...c, name, honorific: honorific ?? c.honorific }))
        );
      },

      deleteClient: clientId => {
        patchFile(file => ({ ...file, clients: file.clients.filter(c => c.id !== clientId) }));
      },

      addProject: (clientId, name = '') => {
        // reducer は非同期に走るので、案件は先に作ってIDを確定させる
        const project = newProject(state.file, name);
        patchFile(file => mapClient(file, clientId, c => ({ ...c, projects: [...c.projects, project] })));
        patchUi({
          activeClientId: clientId,
          activeProjectId: project.id,
          activeType: '見積書',
          expandedClientIds: [...new Set([...state.ui.expandedClientIds, clientId])],
        });
        return project.id;
      },

      renameProject: (clientId, projectId, name) => {
        patchFile(file => mapProject(file, clientId, projectId, p => ({ ...p, name })));
      },

      duplicateProject: (clientId, projectId) => {
        patchFile(file => {
          const source = findProject(file, clientId, projectId);
          if (!source) return file;
          const documents: Project['documents'] = {};
          const issueNumber = documentNumberIssuer(file);
          for (const [type, doc] of Object.entries(source.documents)) {
            if (!doc) continue;
            documents[type as DocumentType] = {
              ...doc,
              documentNumber: issueNumber(),
              items: doc.items.map(i => ({ ...i, id: newId('i') })),
            };
          }
          const copy: Project = { id: newId('p'), name: `${source.name} のコピー`, documents };
          return mapClient(file, clientId, c => ({
            ...c,
            projects: [...c.projects.slice(0, c.projects.indexOf(source) + 1), copy, ...c.projects.slice(c.projects.indexOf(source) + 1)],
          }));
        });
      },

      deleteProject: (clientId, projectId) => {
        patchFile(file =>
          mapClient(file, clientId, c => ({ ...c, projects: c.projects.filter(p => p.id !== projectId) }))
        );
      },

      updateDocument: patch => {
        const { activeClientId, activeProjectId, activeType } = state.ui;
        if (!activeClientId || !activeProjectId) return;
        patchFile(file =>
          mapProject(file, activeClientId, activeProjectId, p => {
            const current = p.documents[activeType];
            if (!current) return p;
            return { ...p, documents: { ...p.documents, [activeType]: { ...current, ...patch } } };
          })
        );
      },

      updateItems: fn => {
        const { activeClientId, activeProjectId, activeType } = state.ui;
        if (!activeClientId || !activeProjectId) return;
        patchFile(file =>
          mapProject(file, activeClientId, activeProjectId, p => {
            const current = p.documents[activeType];
            if (!current) return p;
            return {
              ...p,
              documents: { ...p.documents, [activeType]: { ...current, items: fn(current.items) } },
            };
          })
        );
      },

      ensureDocument: type => {
        const { activeClientId, activeProjectId } = state.ui;
        if (!activeClientId || !activeProjectId) return;
        patchFile(file => {
          const project = findProject(file, activeClientId, activeProjectId);
          if (!project || project.documents[type]) return file;
          const estimate = project.documents['見積書'];
          const created =
            type !== '見積書' && estimate
              ? generateFromEstimate(estimate, type, file)
              : emptyDocument(file, type);
          return mapProject(file, activeClientId, activeProjectId, p => ({
            ...p,
            documents: { ...p.documents, [type]: created },
          }));
        });
        patchUi({ activeType: type });
      },

      deleteDocument: type => {
        const { activeClientId, activeProjectId } = state.ui;
        if (!activeClientId || !activeProjectId) return;
        patchFile(file =>
          mapProject(file, activeClientId, activeProjectId, p => {
            const documents = { ...p.documents };
            delete documents[type];
            return { ...p, documents };
          })
        );
        patchUi({ activeType: '見積書' });
      },

      updateIssuer: patch => {
        patchFile(file => ({ ...file, issuer: { ...file.issuer, ...patch } }));
      },
    };
  }, [
    state,
    patchFile,
    patchUi,
    openFile,
    createFile,
    reconnect,
    disconnect,
    saveNow,
    exportBackup,
    resolveConflict,
    migratePending,
    dismissPendingMigration,
    selectProject,
    setActiveType,
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
