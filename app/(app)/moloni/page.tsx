'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCcw, ArrowDownCircle, ArrowUpCircle, CheckCircle2, XCircle, Loader2, Users, Truck, FileText, Zap, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

interface SyncStatus {
  configured: boolean;
  connected?: boolean;
  companyId?: number;
  companyName?: string;
  error?: string;
  moloni?: { clientes: number; fornecedores: number };
  local?: { clientes: number; fornecedores: number; faturas: number };
  synced?: { clientes: number; fornecedores: number; faturas: number };
}

interface SyncResult {
  imported: number;
  updated: number;
  errors: string[];
}

export default function MoloniPage() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [pushing, setPushing] = useState<string | null>(null);
  const [syncResults, setSyncResults] = useState<Record<string, SyncResult> | null>(null);
  const [pushResult, setPushResult] = useState<{ pushed: number; errors: string[] } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/moloni/status');
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setStatus({ configured: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSync = async (type: string) => {
    setSyncing(type);
    setSyncResults(null);
    try {
      const res = await fetch('/api/moloni/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.results) setSyncResults(data.results);
      await fetchStatus();
    } catch (e: any) {
      setSyncResults({ error: { imported: 0, updated: 0, errors: [e.message] } });
    } finally {
      setSyncing(null);
    }
  };

  const handlePush = async (type: string) => {
    setPushing(type);
    setPushResult(null);
    try {
      const res = await fetch('/api/moloni/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.results) setPushResult(data.results);
      await fetchStatus();
    } catch (e: any) {
      setPushResult({ pushed: 0, errors: [e.message] });
    } finally {
      setPushing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integração Moloni"
        description="Sincronize clientes, fornecedores e todos os documentos de gestão com o Moloni"
      />

      {/* Connection Status */}
      <div className="bg-card rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Estado da Ligação
        </h3>
        <div className="flex items-center gap-3">
          {status?.connected ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">
                Conectado ao Moloni — {status.companyName || `Empresa #${status.companyId}`}
              </span>
            </>
          ) : status?.configured ? (
            <>
              <XCircle className="h-5 w-5 text-red-500" />
              <div>
                <span className="text-sm text-red-700 dark:text-red-400 font-medium">Erro na ligação</span>
                {status.error && <p className="text-xs text-muted-foreground mt-1">{status.error}</p>}
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                Credenciais do Moloni não configuradas
              </span>
            </>
          )}
        </div>
      </div>

      {status?.connected && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="font-semibold">Clientes</h4>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Moloni: <span className="font-medium text-foreground">{status.moloni?.clientes ?? 0}</span></p>
                <p className="text-muted-foreground">Local: <span className="font-medium text-foreground">{status.local?.clientes ?? 0}</span></p>
                <p className="text-muted-foreground">Sincronizados: <span className="font-medium text-emerald-600">{status.synced?.clientes ?? 0}</span></p>
              </div>
            </div>
            <div className="bg-card rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950">
                  <Truck className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <h4 className="font-semibold">Fornecedores</h4>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Moloni: <span className="font-medium text-foreground">{status.moloni?.fornecedores ?? 0}</span></p>
                <p className="text-muted-foreground">Local: <span className="font-medium text-foreground">{status.local?.fornecedores ?? 0}</span></p>
                <p className="text-muted-foreground">Sincronizados: <span className="font-medium text-emerald-600">{status.synced?.fornecedores ?? 0}</span></p>
              </div>
            </div>
            <div className="bg-card rounded-xl border p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950">
                  <FileText className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <h4 className="font-semibold">Documentos</h4>
              </div>
              <div className="space-y-1 text-sm">
                <p className="text-muted-foreground">Local: <span className="font-medium text-foreground">{status.local?.faturas ?? 0}</span></p>
                <p className="text-muted-foreground">Sincronizados: <span className="font-medium text-emerald-600">{status.synced?.faturas ?? 0}</span></p>
              </div>
            </div>
          </div>

          {/* Sync Actions */}
          <div className="bg-card rounded-xl border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowDownCircle className="h-5 w-5 text-blue-500" />
              Importar do Moloni
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Importa dados do Moloni para a aplicação. Registos existentes serão atualizados.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleSync('clientes')}
                disabled={!!syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {syncing === 'clientes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Importar Clientes
              </button>
              <button
                onClick={() => handleSync('fornecedores')}
                disabled={!!syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {syncing === 'fornecedores' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Importar Fornecedores
              </button>
              <button
                onClick={() => handleSync('faturas')}
                disabled={!!syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {syncing === 'faturas' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                Importar Documentos
              </button>
              <button
                onClick={() => handleSync('all')}
                disabled={!!syncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium hover:bg-[#162d4a] disabled:opacity-50 transition-colors"
              >
                {syncing === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                Sincronizar Tudo
              </button>
            </div>
          </div>

          {/* Push Actions */}
          <div className="bg-card rounded-xl border p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
              Enviar para o Moloni
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Envia registos locais (não sincronizados) para o Moloni.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handlePush('clientes')}
                disabled={!!pushing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {pushing === 'clientes' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Enviar Clientes
              </button>
              <button
                onClick={() => handlePush('fornecedores')}
                disabled={!!pushing}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {pushing === 'fornecedores' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                Enviar Fornecedores
              </button>
            </div>
          </div>

          {/* Sync Results */}
          {syncResults && (
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-semibold mb-4">Resultado da Sincronização</h3>
              {Object.entries(syncResults).map(([key, result]: [string, any]) => (
                <div key={key} className="mb-4 last:mb-0">
                  <h4 className="font-medium capitalize mb-2">{key}</h4>
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-600">✓ Importados: {result.imported}</span>
                    <span className="text-blue-600">↻ Atualizados: {result.updated}</span>
                    {result.errors?.length > 0 && (
                      <span className="text-red-600">✗ Erros: {result.errors.length}</span>
                    )}
                  </div>
                  {result.byType && (
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(result.byType).map(([docType, counts]: [string, any]) => (
                        <div key={docType} className="text-xs p-2 bg-muted/50 rounded-lg">
                          <span className="font-medium">{docType}:</span> {counts.imported} novos, {counts.updated} atualizados
                        </div>
                      ))}
                    </div>
                  )}
                  {result.errors?.length > 0 && (
                    <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      {result.errors.slice(0, 5).map((err: string, i: number) => (
                        <p key={i} className="text-xs text-red-700 dark:text-red-400">{err}</p>
                      ))}
                      {result.errors.length > 5 && (
                        <p className="text-xs text-red-500 mt-1">... e mais {result.errors.length - 5} erros</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Push Results */}
          {pushResult && (
            <div className="bg-card rounded-xl border p-6">
              <h3 className="text-lg font-semibold mb-4">Resultado do Envio</h3>
              <div className="flex gap-4 text-sm">
                <span className="text-emerald-600">✓ Enviados: {pushResult.pushed}</span>
                {pushResult.errors.length > 0 && (
                  <span className="text-red-600">✗ Erros: {pushResult.errors.length}</span>
                )}
              </div>
              {pushResult.errors.length > 0 && (
                <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  {pushResult.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs text-red-700 dark:text-red-400">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
