'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, SlidersHorizontal, Table2, CheckCircle2, FileText, Loader2,
  ArrowRight, ArrowLeft, Check, FileSpreadsheet, FileUp, Sparkles, AlertTriangle,
} from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';

/* ---------- Helpers de parsing ---------- */
function parsePortugueseNumber(val: string): number {
  if (!val || val.trim() === '') return 0;
  let clean = val.replace(/[\s€$]/g, '');
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

function parsePortugueseDate(val: string): string {
  if (!val) return '';
  const s = String(val).trim();
  // ISO first: quando o ano (4 dígitos) aparece no início é sempre AAAA-MM-DD.
  // Isto tem de ser testado ANTES do padrão DD/MM/AAAA, caso contrário datas
  // como "2026-07-13" seriam mal interpretadas (dia/mês trocados).
  const isoMatch = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (isoMatch) {
    const month = isoMatch[2].padStart(2, '0');
    const day = isoMatch[3].padStart(2, '0');
    return `${isoMatch[1]}-${month}-${day}`;
  }
  // Formato português DD/MM/AAAA (ancorado ao início da string).
  const match = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    let year = match[3];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  return '';
}

function formatDisplayDate(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/* Deteção do banco a partir do nome do ficheiro / colunas */
const BANK_HINTS: { key: string; label: string; kws: string[] }[] = [
  { key: 'montepio', label: 'Montepio', kws: ['montepio'] },
  { key: 'cgd', label: 'CGD', kws: ['cgd', 'caixa geral', 'caixa-geral'] },
  { key: 'bpi', label: 'BPI', kws: ['bpi'] },
  { key: 'millennium', label: 'Millennium', kws: ['millennium', 'bcp'] },
  { key: 'santander', label: 'Santander', kws: ['santander'] },
  { key: 'novobanco', label: 'Novo Banco', kws: ['novo banco', 'novobanco'] },
  { key: 'bankinter', label: 'Bankinter', kws: ['bankinter'] },
  { key: 'activobank', label: 'ActivoBank', kws: ['activobank', 'activo bank'] },
];

function detectBankLabel(haystack: string): string {
  const h = haystack.toLowerCase();
  const found = BANK_HINTS.find((b) => b.kws.some((k) => h.includes(k)));
  return found?.label || '';
}

/* Apenas dígitos de um IBAN/nº de conta */
const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');

/* Verifica se duas cadeias de dígitos partilham uma sequência contígua >= len */
function sharesDigitRun(a: string, b: string, len = 8): boolean {
  if (!a || !b || a.length < len || b.length < len) return false;
  for (let i = 0; i + len <= a.length; i++) {
    if (b.includes(a.slice(i, i + len))) return true;
  }
  return false;
}

/* Deteta a conta bancária cruzando o IBAN/nº de conta lido no ficheiro com o
   IBAN registado de cada conta. Devolve o id se houver exatamente uma conta
   correspondente. */
function matchAccountByHints(
  hints: { iban?: string | null; numbers?: string[] } | undefined,
  contas: any[],
): string {
  if (!hints) return '';
  const hintIbanDigits = onlyDigits(hints.iban || '');
  const nums = (hints.numbers || []).map(onlyDigits).filter((n) => n.length >= 8);

  // 1) Correspondência exata de IBAN
  if (hintIbanDigits.length >= 15) {
    const exact = contas.filter((c) => onlyDigits(c?.iban) === hintIbanDigits);
    if (exact.length === 1) return exact[0].id;
  }
  // 2) Sequência de dígitos partilhada entre o nº de conta e o IBAN registado
  const cands = contas.filter((c) => {
    const cd = onlyDigits(c?.iban);
    if (cd.length < 8) return false;
    if (hintIbanDigits && sharesDigitRun(hintIbanDigits, cd, 10)) return true;
    return nums.some((n) => sharesDigitRun(n, cd, 8));
  });
  if (cands.length === 1) return cands[0].id;
  return '';
}

type Step = 1 | 2 | 3 | 4;

const STEPS: { n: Step; label: string; icon: any }[] = [
  { n: 1, label: 'Carregar', icon: Upload },
  { n: 2, label: 'Mapear', icon: SlidersHorizontal },
  { n: 3, label: 'Rever', icon: Table2 },
  { n: 4, label: 'Resultado', icon: CheckCircle2 },
];

export default function ImportarExtratoPage() {
  const [step, setStep] = useState<Step>(1);
  const [contas, setContas] = useState<any[]>([]);

  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<Array<Record<string, string>>>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState({ data: '', descricao: '', debito: '', credito: '', valor: '' });
  const [valorFormat, setValorFormat] = useState<'separado' | 'unico'>('separado');
  const [contaId, setContaId] = useState('');
  const [detectedBank, setDetectedBank] = useState('');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [result, setResult] = useState<{ created: number; transferencias: number; skipped: number; total: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/contas').then((r) => r.json()).then((c) => setContas(Array.isArray(c) ? c : [])).catch(() => {});
  }, []);

  const contasAtivas = useMemo(() => contas.filter((c: any) => c?.ativa), [contas]);

  /* Movimentos processados a partir do mapeamento automático */
  const parsedMovimentos = useMemo(() => rows.map((row) => {
    const data = parsePortugueseDate(row[mapping.data] || '');
    const descricao = (row[mapping.descricao] || '').trim();
    let valor = 0;
    let tipo: 'credito' | 'debito' = 'credito';
    if (mapping.debito && mapping.credito) {
      const deb = parsePortugueseNumber(row[mapping.debito]);
      const cred = parsePortugueseNumber(row[mapping.credito]);
      if (deb > 0) { valor = deb; tipo = 'debito'; }
      else if (cred > 0) { valor = cred; tipo = 'credito'; }
    } else if (mapping.debito) {
      const deb = parsePortugueseNumber(row[mapping.debito]);
      if (deb !== 0) { valor = Math.abs(deb); tipo = 'debito'; }
    } else if (mapping.credito) {
      const cred = parsePortugueseNumber(row[mapping.credito]);
      if (cred !== 0) { valor = Math.abs(cred); tipo = 'credito'; }
    } else if (mapping.valor) {
      const v = parsePortugueseNumber(row[mapping.valor]);
      valor = Math.abs(v);
      tipo = v < 0 ? 'debito' : 'credito';
    }
    return { data, descricao, valor, tipo, valid: !!data && valor > 0 };
  }), [rows, mapping]);

  const validMovimentos = useMemo(() => parsedMovimentos.filter((m) => m.valid), [parsedMovimentos]);

  const periodo = useMemo(() => {
    const dates = validMovimentos.map((m) => m.data).filter(Boolean).sort();
    if (dates.length === 0) return null;
    return { de: dates[0], ate: dates[dates.length - 1] };
  }, [validMovimentos]);

  const mappingComplete = !!mapping.data && (!!mapping.valor || !!mapping.debito || !!mapping.credito);

  const contaSelecionada = useMemo(() => contas.find((c: any) => c?.id === contaId), [contas, contaId]);

  const tituloExtrato = useMemo(() => {
    const banco = contaSelecionada?.banco || detectedBank || 'Bancário';
    const nome = contaSelecionada?.nome;
    return nome ? `Extrato ${banco} — ${nome}` : `Extrato ${banco}`;
  }, [contaSelecionada, detectedBank]);

  /* ---------- Ações ---------- */
  const resetAll = () => {
    setStep(1); setFileName(''); setRows([]); setColumns([]);
    setMapping({ data: '', descricao: '', debito: '', credito: '', valor: '' });
    setValorFormat('separado'); setContaId(''); setDetectedBank(''); setResult(null);
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/movimentos/parse-file', { method: 'POST', body: fd });
      const data = await res.json().catch(() => null);
      if (!data) {
        toast.error(res.status === 504 || res.status === 502 || res.status === 503
          ? 'A leitura do extrato demorou demasiado e foi interrompida pelo servidor. Tente um extrato mais curto (menos meses) ou exporte-o em Excel/CSV.'
          : `Erro ao processar o ficheiro (resposta ${res.status} do servidor).`);
        setLoading(false);
        return;
      }
      if (!res.ok || !data?.success) {
        toast.error(data?.error || 'Erro ao processar ficheiro');
        setLoading(false);
        return;
      }
      setRows(data.rows || []);
      setColumns(data.columns || []);
      const det = data.detected || {};
      const newMapping = {
        data: det.data || '',
        descricao: det.descricao || '',
        debito: det.debito || '',
        credito: det.credito || '',
        valor: det.valor || '',
      };
      setMapping(newMapping);
      setValorFormat(det.debito || det.credito ? 'separado' : det.valor ? 'unico' : 'separado');

      // Deteção automática do banco (nome do ficheiro + amostra das colunas)
      const sample = (data.rows || []).slice(0, 10).map((r: any) => Object.values(r).join(' ')).join(' ');
      const bank = detectBankLabel(file.name) || detectBankLabel(sample);
      setDetectedBank(bank);

      // Auto-selecionar a conta.
      // 1º) pelo IBAN/nº de conta lido no próprio ficheiro (mais fiável);
      // 2º) pelo banco detetado no nome/conteúdo;
      // 3º) conta única ativa.
      const ativas = contas.filter((c: any) => c?.ativa);
      let matched = matchAccountByHints(data.accountHints, ativas);
      if (!matched && bank) {
        const hint = BANK_HINTS.find((b) => b.label === bank);
        const cands = ativas.filter((c: any) => {
          const hay = `${c?.banco || ''} ${c?.nome || ''}`.toLowerCase();
          return hint?.kws.some((k) => hay.includes(k));
        });
        if (cands.length === 1) matched = cands[0].id;
      }
      if (!matched && ativas.length === 1) matched = ativas[0].id;
      setContaId(matched);

      toast.success(`${data.totalRows} linhas lidas — deteção automática concluída`);
      setStep(2);
    } catch {
      toast.error('Erro ao processar ficheiro');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!contaId) { toast.error('Selecione a conta bancária'); return; }
    if (validMovimentos.length === 0) { toast.error('Sem movimentos válidos'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/movimentos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contaBancariaId: contaId,
          movimentos: validMovimentos.map((m) => ({ descricao: m.descricao, valor: m.valor, dataMovimento: m.data, tipo: m.tipo })),
        }),
      });
      const data = await res.json();
      if (data?.success) {
        setResult({ created: data.created ?? 0, transferencias: data.transferencias ?? 0, skipped: data.skipped ?? 0, total: data.total ?? validMovimentos.length });
        setStep(4);
      } else {
        toast.error(data?.error || 'Erro na importação');
      }
    } catch {
      toast.error('Erro na importação');
    } finally {
      setSaving(false);
    }
  };

  /* ---------- Render ---------- */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Extrato</h1>
        <p className="text-muted-foreground text-sm mt-1">Importe movimentos de ficheiros Excel (.xlsx), CSV ou PDF</p>
      </div>

      {/* Indicador de passos */}
      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          const Icon = done ? Check : s.icon;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-slate-900 text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
              }`}>
                <Icon className="h-4 w-4" />
                {s.n}. {s.label}
              </div>
              {i < STEPS.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {/* PASSO 1 — CARREGAR */}
        {step === 1 && (
          <motion.div key="s1" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-card rounded-2xl p-6 shadow-sm border">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><FileText className="h-5 w-5 text-blue-600" />Selecionar Ficheiro</h2>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              className={`border-2 border-dashed rounded-xl py-16 px-6 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-900/20' : 'border-slate-300 hover:bg-muted/40'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-10 w-10 mx-auto text-blue-500 mb-3 animate-spin" />
                  <p className="text-base font-medium">A processar ficheiro...</p>
                  <p className="text-sm text-muted-foreground mt-1">A deteção é automática, aguarde um momento.</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-slate-400 mb-3" />
                  <p className="text-lg font-medium">Clique ou arraste o ficheiro aqui</p>
                  <p className="text-sm text-muted-foreground mt-1">Suporta ficheiros .xlsx, .xls, .csv e .pdf</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt,.xls,.xlsx,.xlsm,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="flex items-center gap-2 font-semibold text-blue-800 dark:text-blue-300 text-sm"><FileSpreadsheet className="h-4 w-4" />Excel / CSV</p>
                <ul className="mt-2 space-y-1 text-xs text-blue-700/90 dark:text-blue-300/80 list-disc list-inside">
                  <li>Primeira linha com nomes das colunas</li>
                  <li>Pelo menos colunas de Data e Valor</li>
                  <li>Formatos: .xlsx, .xls, .csv</li>
                </ul>
              </div>
              <div className="rounded-xl bg-violet-50 dark:bg-violet-900/20 p-4">
                <p className="flex items-center gap-2 font-semibold text-violet-800 dark:text-violet-300 text-sm"><Sparkles className="h-4 w-4" />Extrato PDF</p>
                <ul className="mt-2 space-y-1 text-xs text-violet-700/90 dark:text-violet-300/80 list-disc list-inside">
                  <li>A IA extrai automaticamente os movimentos</li>
                  <li>Funciona com extratos de qualquer banco</li>
                  <li>Máximo 20MB por ficheiro</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {/* PASSO 2 — MAPEAR (automático) */}
        {step === 2 && (
          <motion.div key="s2" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            <div className="bg-card rounded-2xl p-6 shadow-sm border">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="h-6 w-6 text-emerald-600" /></div>
                <div>
                  <h2 className="text-lg font-semibold">Deteção automática concluída</h2>
                  <p className="text-sm text-muted-foreground">As colunas foram identificadas automaticamente. Não é necessário preencher nada.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <DetCard label="Data" value={mapping.data} ok={!!mapping.data} />
                <DetCard label="Descrição" value={mapping.descricao} ok={!!mapping.descricao} optional />
                {valorFormat === 'separado' ? (
                  <>
                    <DetCard label="Débito (saídas)" value={mapping.debito} ok={!!mapping.debito} optional />
                    <DetCard label="Crédito (entradas)" value={mapping.credito} ok={!!mapping.credito} optional />
                  </>
                ) : (
                  <DetCard label="Valor" value={mapping.valor} ok={!!mapping.valor} />
                )}
              </div>

              {!mappingComplete && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Não foi possível detetar automaticamente as colunas essenciais. Ajuste o mapeamento abaixo.</span>
                </div>
              )}

              {!mappingComplete && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-4">
                  <ManualSelect label="Coluna da Data" value={mapping.data} columns={columns} onChange={(v) => setMapping({ ...mapping, data: v })} />
                  <ManualSelect label="Coluna da Descrição" value={mapping.descricao} columns={columns} onChange={(v) => setMapping({ ...mapping, descricao: v })} />
                  <ManualSelect label="Coluna de Débito" value={mapping.debito} columns={columns} onChange={(v) => setMapping({ ...mapping, debito: v, valor: '' })} />
                  <ManualSelect label="Coluna de Crédito" value={mapping.credito} columns={columns} onChange={(v) => setMapping({ ...mapping, credito: v, valor: '' })} />
                  <ManualSelect label="Coluna de Valor (única)" value={mapping.valor} columns={columns} onChange={(v) => setMapping({ ...mapping, valor: v, debito: '', credito: '' })} />
                </div>
              )}
            </div>

            {/* Conta bancária */}
            <div className="bg-card rounded-2xl p-6 shadow-sm border">
              <h3 className="text-base font-semibold mb-1">Conta Bancária</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {contaId ? 'Conta detetada automaticamente. Pode alterar se necessário.' : 'Selecione a conta para onde os movimentos serão importados.'}
              </p>
              <select value={contaId} onChange={(e) => setContaId(e.target.value)} className="w-full md:w-96 px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground">
                <option value="">Selecione a conta</option>
                {contasAtivas.map((c: any) => <option key={c?.id} value={c?.id}>{c?.nome} — {c?.banco}</option>)}
              </select>
            </div>

            <div className="flex gap-2">
              <button onClick={resetAll} className="px-4 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Recomeçar</button>
              <button
                onClick={() => { if (!mappingComplete) { toast.error('Complete o mapeamento das colunas'); return; } if (!contaId) { toast.error('Selecione a conta bancária'); return; } setStep(3); }}
                className="flex-1 md:flex-none px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center justify-center gap-2"
              >
                Rever movimentos<ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* PASSO 3 — REVER */}
        {step === 3 && (
          <motion.div key="s3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
            {/* Cabeçalho do extrato */}
            <div className="bg-card rounded-2xl p-5 shadow-sm border flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0"><FileSpreadsheet className="h-6 w-6 text-emerald-600" /></div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                <p className="font-semibold w-full">{tituloExtrato}</p>
                {periodo && <p className="text-sm text-muted-foreground">Período: <span className="font-medium text-foreground">De {periodo.de} a {periodo.ate}</span></p>}
                {contaSelecionada && <p className="text-sm text-muted-foreground">Conta: <span className="font-medium text-foreground">{contaSelecionada.nome}</span></p>}
                <p className="text-sm text-muted-foreground">Tipo: <span className="font-medium text-foreground">Automático</span></p>
              </div>
            </div>

            {/* Pré-visualização */}
            <div className="bg-card rounded-2xl p-5 shadow-sm border">
              <h2 className="text-lg font-semibold flex items-center gap-2 mb-4"><Table2 className="h-5 w-5 text-slate-700" />Pré-visualização ({validMovimentos.length} de {parsedMovimentos.length} linhas)</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left font-medium px-3 py-2 w-12">#</th>
                      <th className="text-left font-medium px-3 py-2">Data</th>
                      <th className="text-right font-medium px-3 py-2">Valor</th>
                      <th className="text-left font-medium px-3 py-2">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validMovimentos.slice(0, 20).map((m, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2.5 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2.5">{formatDisplayDate(m.data)}</td>
                        <td className={`px-3 py-2.5 text-right font-mono font-medium ${m.tipo === 'credito' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {m.tipo === 'debito' ? '-' : ''}{formatCurrency(m.valor)}
                        </td>
                        <td className="px-3 py-2.5">{m.descricao || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {validMovimentos.length > 20 && <p className="text-center text-xs text-muted-foreground pt-3">A mostrar 20 de {validMovimentos.length} linhas</p>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-4 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Voltar</button>
              <button onClick={handleImport} disabled={saving || validMovimentos.length === 0} className="flex-1 md:flex-none px-6 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" />A importar...</> : <><FileUp className="h-4 w-4" />Importar {validMovimentos.length} movimentos</>}
              </button>
            </div>
          </motion.div>
        )}

        {/* PASSO 4 — RESULTADO */}
        {step === 4 && result && (
          <motion.div key="s4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-card rounded-2xl p-8 shadow-sm border text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="h-9 w-9 text-emerald-600" /></div>
            <h2 className="text-xl font-bold">Importação concluída</h2>
            <p className="text-muted-foreground text-sm mt-1">Os movimentos foram adicionados à conta selecionada.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 max-w-2xl mx-auto">
              <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4">
                <p className="text-2xl font-bold text-emerald-600">{result.created}</p>
                <p className="text-xs text-muted-foreground mt-1">Movimentos importados</p>
              </div>
              <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-4">
                <p className="text-2xl font-bold text-blue-600">{result.transferencias}</p>
                <p className="text-xs text-muted-foreground mt-1">Transferências internas detetadas</p>
              </div>
              <div className="rounded-xl bg-muted p-4">
                <p className="text-2xl font-bold text-muted-foreground">{result.skipped}</p>
                <p className="text-xs text-muted-foreground mt-1">Ignorados (duplicados/inválidos)</p>
              </div>
            </div>

            <div className="flex justify-center gap-2 mt-8">
              <button onClick={resetAll} className="px-6 py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2"><FileUp className="h-4 w-4" />Importar outro extrato</button>
              <a href="/reconciliacao" className="px-6 py-2.5 border border-input rounded-lg text-sm font-medium hover:bg-muted flex items-center gap-2">Ir para Reconciliação<ArrowRight className="h-4 w-4" /></a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Cartão de coluna detetada */
function DetCard({ label, value, ok, optional }: { label: string; value: string; ok: boolean; optional?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${ok ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-input bg-muted/30'}`}>
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <span className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className="text-sm font-semibold mt-1 truncate" title={value}>{value || (optional ? '— (opcional)' : '—')}</p>
    </div>
  );
}

function ManualSelect({ label, value, columns, onChange }: { label: string; value: string; columns: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground">
        <option value="">Selecione</option>
        {columns.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </div>
  );
}
