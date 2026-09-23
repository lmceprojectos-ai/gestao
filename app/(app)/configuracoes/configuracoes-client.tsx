'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Plus, Edit2, Trash2, X, CreditCard, Tags, FileType, CircleDot } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';

interface Item {
  id: string;
  label: string;
  valor?: string;
  cor?: string | null;
}

// Predefined color options (Tailwind classes)
const COR_OPCOES = [
  { label: 'Cinzento', value: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { label: 'Verde', value: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { label: 'Azul', value: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { label: 'Roxo', value: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { label: 'Âmbar', value: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { label: 'Vermelho', value: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { label: 'Rosa', value: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  { label: 'Turquesa', value: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400' },
];

type TabKey = 'forma_pagamento' | 'categoria' | 'tipo_documento' | 'estado';

interface TabConfig {
  key: TabKey;
  label: string;
  singular: string;
  icon: any;
  useColor: boolean;
  // 'categoria' uses /api/categorias with { nome }, others use /api/configuracoes with { grupo, label }
  source: 'categoria' | 'configuracao';
}

const TABS: TabConfig[] = [
  { key: 'forma_pagamento', label: 'Métodos de Pagamento', singular: 'Método de Pagamento', icon: CreditCard, useColor: false, source: 'configuracao' },
  { key: 'categoria', label: 'Categorias', singular: 'Categoria', icon: Tags, useColor: true, source: 'categoria' },
  { key: 'tipo_documento', label: 'Tipos de Documento', singular: 'Tipo de Documento', icon: FileType, useColor: true, source: 'configuracao' },
  { key: 'estado', label: 'Estados', singular: 'Estado', icon: CircleDot, useColor: true, source: 'configuracao' },
];

export default function ConfiguracoesClient() {
  const [activeTab, setActiveTab] = useState<TabKey>('forma_pagamento');
  const tab = TABS.find((t) => t.key === activeTab)!;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState<{ label: string; cor: string }>({ label: '', cor: COR_OPCOES[0].value });

  const load = () => {
    setLoading(true);
    const url = tab.source === 'categoria' ? '/api/categorias' : `/api/configuracoes?grupo=${tab.key}`;
    fetch(url)
      .then((r) => r.json())
      .then((d: any[]) => {
        const mapped: Item[] = (d ?? []).map((x) =>
          tab.source === 'categoria'
            ? { id: x.id, label: x.nome, valor: x.slug, cor: x.cor }
            : { id: x.id, label: x.label, valor: x.valor, cor: x.cor }
        );
        setItems(mapped);
      })
      .catch(() => toast.error('Erro ao carregar'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const openNew = () => {
    setEditing(null);
    setForm({ label: '', cor: COR_OPCOES[0].value });
    setShowModal(true);
  };

  const openEdit = (item: Item) => {
    setEditing(item);
    setForm({ label: item.label, cor: item.cor || COR_OPCOES[0].value });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.label.trim()) {
      toast.error('Indique um nome');
      return;
    }
    try {
      let url: string;
      let method: string;
      let body: any;
      if (tab.source === 'categoria') {
        url = editing ? `/api/categorias/${editing.id}` : '/api/categorias';
        method = editing ? 'PUT' : 'POST';
        body = { nome: form.label, cor: form.cor };
      } else {
        url = editing ? `/api/configuracoes/${editing.id}` : '/api/configuracoes';
        method = editing ? 'PUT' : 'POST';
        body = editing
          ? { label: form.label, cor: tab.useColor ? form.cor : null }
          : { grupo: tab.key, label: form.label, cor: tab.useColor ? form.cor : null };
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro');
        return;
      }
      toast.success(editing ? 'Atualizado' : 'Criado');
      setShowModal(false);
      load();
    } catch {
      toast.error('Erro de rede');
    }
  };

  const handleDelete = async (item: Item) => {
    if (!confirm(`Eliminar "${item.label}"? Os registos que já usam este valor mantêm-se, mas deixará de estar disponível para seleção.`)) return;
    try {
      const url = tab.source === 'categoria' ? `/api/categorias/${item.id}` : `/api/configuracoes/${item.id}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d?.error ?? 'Erro ao eliminar');
        return;
      }
      toast.success('Eliminado');
      load();
    } catch {
      toast.error('Erro');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Settings}
        title="Configurações"
        description="Gerir as listas usadas na aplicação: métodos de pagamento, categorias, tipos de documento e estados"
      />

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = t.key === activeTab;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-px ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">{tab.label}</h2>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </div>

      {loading ? (
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      ) : items.length === 0 ? (
        <EmptyState icon={tab.icon} title="Sem registos" description={`Adicione o primeiro ${tab.singular.toLowerCase()}.`} />
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="divide-y divide-border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="flex items-center gap-3">
                  {tab.useColor && item.cor ? (
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${item.cor}`}>{item.label}</span>
                  ) : (
                    <span className="text-sm font-medium">{item.label}</span>
                  )}
                  <span className="text-xs text-muted-foreground font-mono">{item.valor}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(item)} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Editar">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(item)} className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-600 transition-colors" title="Eliminar">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-semibold">{editing ? 'Editar' : 'Adicionar'} {tab.singular}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nome</label>
                <input
                  autoFocus
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="Ex.: Transferência"
                  className="w-full px-3 py-2 border border-input rounded-lg text-sm focus:ring-2 focus:ring-primary outline-none bg-background text-foreground"
                />
              </div>
              {tab.useColor && (
                <div>
                  <label className="block text-sm font-medium mb-1">Cor</label>
                  <div className="flex flex-wrap gap-2">
                    {COR_OPCOES.map((c) => (
                      <button
                        type="button"
                        key={c.value}
                        onClick={() => setForm({ ...form, cor: c.value })}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all ${c.value} ${
                          form.cor === c.value ? 'ring-2 ring-primary ring-offset-1 ring-offset-background border-transparent' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                      >
                        {form.label.trim() || c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-input hover:bg-muted transition-colors">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity">{editing ? 'Guardar' : 'Adicionar'}</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
