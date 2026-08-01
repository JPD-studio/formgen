'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Client, DocumentType, DOCUMENT_TYPES, Project } from '@/types';
import { useStore } from '@/lib/FormgenStore';

const TYPE_BADGE: Record<DocumentType, string> = {
  見積書: '見',
  請求書: '請',
  納品書: '納',
};

export default function Sidebar() {
  const store = useStore();
  const { file, ui } = store;
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState<{ kind: 'client' | 'project'; clientId: string; projectId?: string } | null>(null);
  const [editing, setEditing] = useState<{ kind: 'client' | 'project'; clientId: string; projectId?: string } | null>(null);

  const filtered = useMemo(() => filterClients(file.clients, query), [file.clients, query]);
  const searching = query.trim().length > 0;

  // メニューは外側クリックで閉じる
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menu]);

  const handleAddClient = () => {
    const id = store.addClient('');
    setEditing({ kind: 'client', clientId: id });
  };

  const handleAddProject = (clientId: string) => {
    const id = store.addProject(clientId, '');
    setEditing({ kind: 'project', clientId, projectId: id });
  };

  return (
    <div className="flex h-full flex-col bg-neutral-50 border-r border-neutral-300">
      {/* 検索 */}
      <div className="p-3 border-b border-neutral-200">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="取引先・案件・番号で検索"
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-8 pr-7 text-sm outline-none focus:border-blue-500"
          />
          {searching && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="検索をクリア"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ツリー */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-gray-400">
            {searching ? '該当する案件がありません' : '取引先がまだありません'}
          </p>
        )}

        {filtered.map(client => {
          const expanded = searching || ui.expandedClientIds.includes(client.id);
          const isActiveClient = client.id === ui.activeClientId;
          return (
            <div key={client.id}>
              {/* 取引先行 */}
              <div
                className={`group flex items-center gap-1 pl-2 pr-1 py-1.5 cursor-pointer select-none ${
                  isActiveClient && !ui.activeProjectId ? 'bg-blue-50' : 'hover:bg-neutral-200/60'
                }`}
                onClick={() => store.toggleClientExpanded(client.id)}
              >
                <span className="text-gray-400 shrink-0">
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>

                {editing?.kind === 'client' && editing.clientId === client.id ? (
                  <InlineInput
                    initial={client.name}
                    placeholder="取引先名"
                    onCommit={name => {
                      store.renameClient(client.id, name.trim() || '名称未設定');
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm font-medium text-gray-800" title={client.name}>
                      {client.name || '（名称未設定）'}
                    </span>
                    <span className="shrink-0 text-[10px] text-gray-400 tabular-nums">{client.projects.length}</span>
                    <RowMenuButton
                      onOpen={() => setMenu({ kind: 'client', clientId: client.id })}
                      onClose={() => setMenu(null)}
                      open={menu?.kind === 'client' && menu.clientId === client.id}
                      items={[
                        { icon: <FolderPlus size={13} />, label: '案件を追加', onClick: () => handleAddProject(client.id) },
                        { icon: <Pencil size={13} />, label: '名前を変更', onClick: () => setEditing({ kind: 'client', clientId: client.id }) },
                        {
                          icon: <Trash2 size={13} />,
                          label: '取引先を削除',
                          danger: true,
                          onClick: () => {
                            if (confirm(`「${client.name}」と、その案件 ${client.projects.length} 件をすべて削除します。よろしいですか？`)) {
                              store.deleteClient(client.id);
                            }
                          },
                        },
                      ]}
                    />
                  </>
                )}
              </div>

              {/* 案件行 */}
              {expanded && (
                <div>
                  {client.projects.map(project => (
                    <ProjectRow
                      key={project.id}
                      client={client}
                      project={project}
                      active={project.id === ui.activeProjectId}
                      editing={editing?.kind === 'project' && editing.projectId === project.id}
                      menuOpen={menu?.kind === 'project' && menu.projectId === project.id}
                      onOpenMenu={() => setMenu({ kind: 'project', clientId: client.id, projectId: project.id })}
                      onCloseMenu={() => setMenu(null)}
                      onStartEdit={() => setEditing({ kind: 'project', clientId: client.id, projectId: project.id })}
                      onEndEdit={() => setEditing(null)}
                    />
                  ))}
                  {!searching && (
                    <button
                      onClick={() => handleAddProject(client.id)}
                      className="flex w-full items-center gap-1.5 py-1 pl-8 pr-2 text-left text-xs text-gray-400 hover:bg-neutral-200/60 hover:text-blue-600"
                    >
                      <Plus size={12} /> 案件を追加
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 取引先追加 */}
      <div className="border-t border-neutral-200 p-2">
        <button
          onClick={handleAddClient}
          className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium text-gray-600 hover:bg-neutral-200"
        >
          <Plus size={14} /> 取引先を追加
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ProjectRow({
  client,
  project,
  active,
  editing,
  menuOpen,
  onOpenMenu,
  onCloseMenu,
  onStartEdit,
  onEndEdit,
}: {
  client: Client;
  project: Project;
  active: boolean;
  editing: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onStartEdit: () => void;
  onEndEdit: () => void;
}) {
  const store = useStore();

  return (
    <div
      className={`group flex items-center gap-1 py-1.5 pl-8 pr-1 cursor-pointer select-none ${
        active ? 'bg-blue-100 text-blue-900' : 'hover:bg-neutral-200/60'
      }`}
      onClick={() => store.selectProject(client.id, project.id)}
    >
      {editing ? (
        <InlineInput
          initial={project.name}
          placeholder="案件名（件名）"
          onCommit={name => {
            store.renameProject(client.id, project.id, name.trim() || '無題の案件');
            onEndEdit();
          }}
          onCancel={onEndEdit}
        />
      ) : (
        <>
          <span className="flex-1 truncate text-sm" title={project.name}>
            {project.name || '（無題の案件）'}
          </span>
          <span className="flex shrink-0 gap-0.5">
            {DOCUMENT_TYPES.map(type => (
              <span
                key={type}
                title={project.documents[type] ? `${type}あり` : `${type}なし`}
                className={`inline-flex h-4 w-4 items-center justify-center rounded text-[9px] leading-none ${
                  project.documents[type] ? 'bg-blue-600 text-white' : 'bg-neutral-200 text-neutral-400'
                }`}
              >
                {TYPE_BADGE[type]}
              </span>
            ))}
          </span>
          <RowMenuButton
            open={menuOpen}
            onOpen={onOpenMenu}
            onClose={onCloseMenu}
            items={[
              { icon: <Pencil size={13} />, label: '名前を変更', onClick: onStartEdit },
              { icon: <Copy size={13} />, label: '案件を複製', onClick: () => store.duplicateProject(client.id, project.id) },
              {
                icon: <Trash2 size={13} />,
                label: '案件を削除',
                danger: true,
                onClick: () => {
                  if (confirm(`案件「${project.name}」とその帳票をすべて削除します。よろしいですか？`)) {
                    store.deleteProject(client.id, project.id);
                  }
                },
              },
            ]}
          />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

function RowMenuButton({
  open,
  onOpen,
  onClose,
  items,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  items: MenuItem[];
}) {
  return (
    <span className="relative shrink-0">
      <button
        aria-label="操作メニュー"
        onClick={e => {
          e.stopPropagation();
          onOpen();
        }}
        className={`rounded p-0.5 text-gray-400 hover:bg-neutral-300 hover:text-gray-700 ${
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
        }`}
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-30 mt-0.5 w-40 overflow-hidden rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          onClick={e => e.stopPropagation()}
        >
          {items.map(item => (
            <button
              key={item.label}
              onClick={() => {
                onClose();
                item.onClick();
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-neutral-100 ${
                item.danger ? 'text-red-600' : 'text-gray-700'
              }`}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

function InlineInput({
  initial,
  placeholder,
  onCommit,
  onCancel,
}: {
  initial: string;
  placeholder: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      placeholder={placeholder}
      onChange={e => setValue(e.target.value)}
      onClick={e => e.stopPropagation()}
      onBlur={() => onCommit(value)}
      onKeyDown={e => {
        if (e.key === 'Enter') onCommit(value);
        if (e.key === 'Escape') onCancel();
      }}
      className="min-w-0 flex-1 rounded border border-blue-500 bg-white px-1 py-0.5 text-sm outline-none"
    />
  );
}

// ---------------------------------------------------------------------------

/** 取引先名・案件名・帳票番号を横断して絞り込む */
function filterClients(clients: Client[], query: string): Client[] {
  const q = query.trim().toLowerCase();
  if (!q) return clients;

  return clients
    .map(client => {
      if (client.name.toLowerCase().includes(q)) return client;
      const projects = client.projects.filter(p => {
        if (p.name.toLowerCase().includes(q)) return true;
        return DOCUMENT_TYPES.some(t => p.documents[t]?.documentNumber.toLowerCase().includes(q));
      });
      return projects.length > 0 ? { ...client, projects } : null;
    })
    .filter((c): c is Client => c !== null);
}
