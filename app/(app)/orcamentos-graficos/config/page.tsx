'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Calculator, Loader2, Save, RotateCcw, Plus, Trash2, Upload } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { toast } from 'sonner';
import { SUBSTRATO_CATEGORIAS, categoriaPadraoSubstrato, UNIDADES_SUBSTRATO, UNIDADES_ARTIGO } from '@/lib/grafica/substrato-categorias';

const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40';
const labelCls = 'block text-xs font-medium text-muted-foreground mb-1';

// Campo monetário editável: mostra sempre o símbolo € à direita, para consistência com as colunas calculadas.
const MoneyInput = ({ value, onChange }: { value: any; onChange: (e: any) => void }) => (
  <div className="relative">
    <input type="number" step="0.01" value={value} onChange={onChange} className={inputCls + ' pr-7 text-right'} />
    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
  </div>
);

// Campo numérico editável alinhado à direita (para leitura mais limpa das colunas de números).
const NumInput = ({ value, onChange, step }: { value: any; onChange: (e: any) => void; step?: string }) => (
  <input type="number" step={step} value={value} onChange={onChange} className={inputCls + ' text-right'} />
);

// ---- Colunas redimensionáveis por arrasto (largura persistida em localStorage) ----
// Larguras por defeito de cada tabela (uma por coluna, incluindo a coluna final de ações).
const COL_DEFAULTS: Record<string, number[]> = {
  equipamentos: [300, 160, 140, 140, 56],
  papeis: [90, 300, 100, 100, 130, 120, 120, 140, 130, 160, 56],
  cortes: [120, 240, 160, 120, 220, 56],
  laminacoes: [130, 260, 140, 140, 56],
  stickers: [80, 320, 160, 110, 90, 100, 150, 120, 90, 140, 130, 160, 70, 56],
  vinil: [80, 320, 160, 90, 100, 140, 90, 140, 130, 160, 70, 56],
  artigos: [120, 380, 200, 140, 130, 120, 80, 56],
  faixasMargem: [220, 220, 56],
  descontosCliente: [220, 260, 220, 56],
};
const COL_LS = 'grafica-col-widths-v2';

function useColWidths() {
  const [widths, setWidths] = useState<Record<string, number[]>>({});
  useEffect(() => {
    try { const s = localStorage.getItem(COL_LS); if (s) setWidths(JSON.parse(s)); } catch {}
  }, []);
  const cw = (key: string) => {
    const d = COL_DEFAULTS[key] || [];
    const w = widths[key];
    return w && w.length === d.length ? w : d;
  };
  const tableW = (key: string) => cw(key).reduce((a, b) => a + b, 0);
  const startResize = (key: string, idx: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = cw(key)[idx];
    const onMove = (ev: MouseEvent) => {
      const w = Math.max(50, startW + (ev.clientX - startX));
      setWidths((prev) => {
        const d = COL_DEFAULTS[key] || [];
        const base = prev[key] && prev[key].length === d.length ? prev[key] : d;
        const next = [...base];
        next[idx] = w;
        return { ...prev, [key]: next };
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setWidths((prev) => { try { localStorage.setItem(COL_LS, JSON.stringify(prev)); } catch {} return prev; });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return { cw, tableW, startResize };
}

// <colgroup> que aplica as larguras de cada coluna.
const Colgroup = ({ widths }: { widths: number[] }) => (
  <colgroup>{widths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
);

type HeadCol = { label: string; align?: 'left' | 'right' | 'center' };
// Cabeçalho com pega de arrasto na borda direita de cada coluna (exceto a última, de ações).
const ResizableHead = ({ tableKey, cols, onResize }: {
  tableKey: string;
  cols: HeadCol[];
  onResize: (key: string, idx: number) => (e: React.MouseEvent) => void;
}) => (
  <tr className="text-muted-foreground text-xs uppercase border-b border-border select-none">
    {cols.map((c, i) => (
      <th key={i} className={`relative py-2 px-1 font-medium align-bottom ${c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'}`}>
        <span className="block truncate pr-1">{c.label}</span>
        {i < cols.length - 1 && (
          <span
            onMouseDown={onResize(tableKey, i)}
            title="Arraste para ajustar a largura da coluna"
            className="group absolute top-0 -right-1 z-10 flex h-full w-3 cursor-col-resize items-center justify-center"
          >
            <span className="h-4 w-px bg-border group-hover:bg-emerald-500 group-hover:w-0.5" />
          </span>
        )}
      </th>
    ))}
  </tr>
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  const v = value || '#000000';
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={v} onChange={(e) => onChange(e.target.value)} className="h-9 w-10 shrink-0 rounded-lg border border-input bg-background p-0.5 cursor-pointer" />
        <input value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

const TIPOS_PDF: { key: 'OC' | 'ONF' | 'OL'; label: string }[] = [
  { key: 'OC', label: 'Orçamento de Clientes (OC)' },
  { key: 'ONF', label: 'Orçamento não faturado (ONF)' },
  { key: 'OL', label: 'Orçamento Livre (OL)' },
];

const TEXTOS_PDF: { key: string; label: string }[] = [
  { key: 'colDescricao', label: 'Cabeçalho — Descrição' },
  { key: 'colQtd', label: 'Cabeçalho — Quantidade' },
  { key: 'colPrecoUnit', label: 'Cabeçalho — Preço unitário' },
  { key: 'colPrecoTotal', label: 'Cabeçalho — Preço total' },
  { key: 'labelProducao', label: 'Rótulo — Produção' },
  { key: 'prazoNormal', label: 'Prazo de produção (normal)' },
  { key: 'labelSubtotal', label: 'Rótulo — Subtotal' },
  { key: 'labelTotalComIva', label: 'Rótulo — Total com IVA' },
  { key: 'labelTotalSemIva', label: 'Rótulo — Total sem IVA' },
  { key: 'tituloCondicoes', label: 'Título — Condições (verso)' },
];

export default function ConfigGraficaPage() {
  const { cw, tableW, startResize } = useColWidths();
  const [cfg, setCfg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const r = await fetch('/api/grafica/config');
      setCfg(await r.json());
    } catch {
      toast.error('Erro ao carregar configuração');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const set = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));
  const setNested = (k: string, sub: string, v: any) => setCfg((c: any) => ({ ...c, [k]: { ...c[k], [sub]: v } }));
  const setArr = (k: string, i: number, field: string, v: any) =>
    setCfg((c: any) => ({ ...c, [k]: c[k].map((row: any, idx: number) => (idx === i ? { ...row, [field]: v } : row)) }));
  const addArr = (k: string, empty: any) => setCfg((c: any) => ({ ...c, [k]: [...c[k], empty] }));
  const delArr = (k: string, i: number) => setCfg((c: any) => ({ ...c, [k]: c[k].filter((_: any, idx: number) => idx !== i) }));

  // ---- Stickers ----
  const setStk = (sub: string, v: any) => setCfg((c: any) => ({ ...c, stickers: { ...(c.stickers || {}), [sub]: v } }));
  const setSub = (i: number, field: string, v: any) =>
    setCfg((c: any) => ({ ...c, stickers: { ...c.stickers, substratos: (c.stickers?.substratos || []).map((row: any, idx: number) => (idx === i ? { ...row, [field]: v } : row)) } }));
  const addSub = (empty: any) => setCfg((c: any) => ({ ...c, stickers: { ...c.stickers, substratos: [...(c.stickers?.substratos || []), empty] } }));
  const delSub = (i: number) => setCfg((c: any) => ({ ...c, stickers: { ...c.stickers, substratos: (c.stickers?.substratos || []).filter((_: any, idx: number) => idx !== i) } }));
  const precoM2Sub = (s: any) => {
    const areaM2 = ((s?.larguraMm || 0) * (s?.comprimentoMm || 0)) / 1_000_000;
    const folhas = s?.folhasCaixa > 0 ? s.folhasCaixa : 1;
    return areaM2 > 0 && s?.precoRolo > 0 ? s.precoRolo / (areaM2 * folhas) : 0;
  };

  // ---- Substratos de Grande Formato (Vinil) ----
  const setVinSub = (i: number, field: string, v: any) =>
    setCfg((c: any) => ({ ...c, vinil: { ...c.vinil, substratos: (c.vinil?.substratos || []).map((row: any, idx: number) => (idx === i ? { ...row, [field]: v } : row)) } }));
  const addVinSub = (empty: any) => setCfg((c: any) => ({ ...c, vinil: { ...c.vinil, substratos: [...(c.vinil?.substratos || []), empty] } }));
  const delVinSub = (i: number) => setCfg((c: any) => ({ ...c, vinil: { ...c.vinil, substratos: (c.vinil?.substratos || []).filter((_: any, idx: number) => idx !== i) } }));

  // ---- Artigos e Acessórios ----
  const setArtigo = (i: number, field: string, v: any) =>
    setCfg((c: any) => ({ ...c, artigos: (c.artigos || []).map((row: any, idx: number) => (idx === i ? { ...row, [field]: v } : row)) }));
  const addArtigo = (empty: any) => setCfg((c: any) => ({ ...c, artigos: [...(c.artigos || []), empty] }));
  const delArtigo = (i: number) => setCfg((c: any) => ({ ...c, artigos: (c.artigos || []).filter((_: any, idx: number) => idx !== i) }));

  // ---- Preço de venda sugerido: custo (sem IVA) + 10% de margem de lucro + IVA ----
  const MARGEM_SUGERIDA = 0.10;
  const vendaComIva = (custoSemIva: number) =>
    custoSemIva > 0 ? custoSemIva * (1 + MARGEM_SUGERIDA) * (1 + (cfg?.iva ?? 0.23)) : 0;
  const custoFolhaPapel = (p: any) => {
    const base = (p?.custoBase || 0) * (1 + (p?.margemFornecedor || 0));
    const folhas = p?.folhasResma > 0 ? p.folhasResma : 1;
    return base > 0 ? base / folhas : 0;
  };
  const eur = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';


  // ---- Aparência do PDF ----
  const setApColor = (tipo: string, campo: string, v: string) =>
    setCfg((c: any) => {
      const ap = c.aparenciaPdf || {};
      const cores = ap.cores || {};
      return { ...c, aparenciaPdf: { ...ap, cores: { ...cores, [tipo]: { ...(cores[tipo] || {}), [campo]: v } } } };
    });
  const setApText = (campo: string, v: string) =>
    setCfg((c: any) => {
      const ap = c.aparenciaPdf || {};
      return { ...c, aparenciaPdf: { ...ap, textos: { ...(ap.textos || {}), [campo]: v } } };
    });
  const setApCabecalho = (v: string) =>
    setCfg((c: any) => ({ ...c, aparenciaPdf: { ...(c.aparenciaPdf || {}), cabecalhoDataUri: v } }));

  const onUploadCabecalho = (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) { toast.error('Use uma imagem PNG ou JPG'); return; }
    if (file.size > 900 * 1024) { toast.error('Imagem demasiado grande (máx. 900 KB)'); return; }
    const reader = new FileReader();
    reader.onload = () => setApCabecalho(String(reader.result || ''));
    reader.onerror = () => toast.error('Erro ao ler a imagem');
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/grafica/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      if (!r.ok) throw new Error();
      toast.success('Configuração guardada');
      load();
    } catch {
      toast.error('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const repor = async () => {
    if (!confirm('Repor todos os valores por defeito? As alterações serão perdidas.')) return;
    setSaving(true);
    try {
      const r = await fetch('/api/grafica/config', { method: 'POST' });
      if (!r.ok) throw new Error();
      setCfg(await r.json());
      toast.success('Valores repostos');
    } catch {
      toast.error('Erro ao repor');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !cfg) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>;
  }

  const num = (v: any) => (v === '' ? '' : Number(v));

  return (
    <div>
      <PageHeader
        title="Configuração Gráfica"
        description="Parâmetros de cálculo: equipamento, custos fixos, materiais, acabamentos, margens e descontos"
        icon={Calculator}
        action={
          <div className="flex items-center gap-2">
            <Link href="/orcamentos-graficos" className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <button onClick={repor} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium disabled:opacity-60">
              <RotateCcw className="h-4 w-4" /> Repor
            </button>
            <button onClick={guardar} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
            </button>
          </div>
        }
      />

      <div className="space-y-5">
        <Section title="Impressão">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className={labelCls}>Velocidade (folhas/min)</label><input type="number" value={cfg.velocidadeImpressao} onChange={(e) => set('velocidadeImpressao', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Pré-impressão (min/trabalho)</label><input type="number" value={cfg.preImpMin} onChange={(e) => set('preImpMin', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Custo clique Cor (€)</label><input type="number" step="0.00001" value={cfg.cliqueCor} onChange={(e) => set('cliqueCor', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Custo clique P&B (€)</label><input type="number" step="0.00001" value={cfg.cliquePB} onChange={(e) => set('cliquePB', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Refugo papel (%)</label><input type="number" step="0.01" value={cfg.refugoPapel} onChange={(e) => set('refugoPapel', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Refugo impressão (%)</label><input type="number" step="0.01" value={cfg.refugoImpressao} onChange={(e) => set('refugoImpressao', num(e.target.value))} className={inputCls} /></div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Nota: os refugos são frações (ex.: 0,08 = 8%).</p>
        </Section>

        <Section title="Imposição">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Dedução de largura útil (mm)</label><input type="number" value={cfg.deducaoLarguraMm} onChange={(e) => set('deducaoLarguraMm', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Perda de agarre (mm, aplicada 2x na altura)</label><input type="number" value={cfg.perdaAgarreMm} onChange={(e) => set('perdaAgarreMm', num(e.target.value))} className={inputCls} /></div>
          </div>
        </Section>

        <Section title="Custos Fixos da Empresa">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className={labelCls}>Operador (€/mês)</label><input type="number" value={cfg.custosFixos.operadorMes} onChange={(e) => setNested('custosFixos', 'operadorMes', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Renda (€/mês)</label><input type="number" value={cfg.custosFixos.rendaMes} onChange={(e) => setNested('custosFixos', 'rendaMes', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Software (€/ano)</label><input type="number" value={cfg.custosFixos.softwareAno} onChange={(e) => setNested('custosFixos', 'softwareAno', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Seguros (€/ano)</label><input type="number" value={cfg.custosFixos.segurosAno} onChange={(e) => setNested('custosFixos', 'segurosAno', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Dias úteis/mês</label><input type="number" value={cfg.custosFixos.diasUteisMes} onChange={(e) => setNested('custosFixos', 'diasUteisMes', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Horas/dia</label><input type="number" value={cfg.custosFixos.horasDia} onChange={(e) => setNested('custosFixos', 'horasDia', num(e.target.value))} className={inputCls} /></div>
            <div>
              <label className={labelCls}>Taxa de ocupação (%)</label>
              <input type="number" min={1} max={100} value={Math.round(((cfg.custosFixos.taxaOcupacao ?? 1)) * 100)} onChange={(e) => setNested('custosFixos', 'taxaOcupacao', Math.min(Math.max(Number(num(e.target.value)) || 0, 1), 100) / 100)} className={inputCls} />
            </div>
          </div>
          {(() => {
            const cf = cfg.custosFixos;
            const amort = (cfg.equipamentos || []).reduce((a: number, e: any) => a + (e.amortMeses > 0 ? e.investimento / e.amortMeses : 0), 0);
            const custoFixoMes = (cf.operadorMes || 0) + (cf.rendaMes || 0) + (cf.softwareAno || 0) / 12 + (cf.segurosAno || 0) / 12 + amort;
            const horasCal = (cf.diasUteisMes || 0) * (cf.horasDia || 0);
            const taxa = cf.taxaOcupacao && cf.taxaOcupacao > 0 ? cf.taxaOcupacao : 1;
            const horasProd = horasCal * taxa;
            const custoHora = horasProd > 0 ? custoFixoMes / horasProd : 0;
            const custoMin = custoHora / 60;
            const eur = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const eur4 = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
            return (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Custo fixo / mês</div>
                  <div className="text-sm font-semibold">{eur(custoFixoMes)} €</div>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Horas produtivas / mês</div>
                  <div className="text-sm font-semibold">{horasProd.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} h <span className="text-[11px] font-normal text-muted-foreground">(de {horasCal} h)</span></div>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="text-[11px] text-muted-foreground">Custo / hora</div>
                  <div className="text-sm font-semibold">{eur(custoHora)} €</div>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <div className="text-[11px] text-emerald-700">Custo / minuto</div>
                  <div className="text-sm font-bold text-emerald-800">{eur4(custoMin)} €</div>
                </div>
              </div>
            );
          })()}
          <p className="text-[11px] text-muted-foreground mt-3">A <b>taxa de ocupação</b> distribui os custos fixos apenas pelas horas realmente produtivas (faturadas). Com 100% o custo/minuto é calculado sobre todas as horas de calendário; valores mais baixos (ex.: 60-70%) refletem tempos mortos e sobem o custo/minuto — tornando os orçamentos mais realistas. Este valor afeta cartões, stickers e futuros produtos por tempo.</p>
        </Section>

        <Section title="Equipamento (amortização)">
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: tableW('equipamentos') }}>
              <Colgroup widths={cw('equipamentos')} />
              <thead>
                <ResizableHead tableKey="equipamentos" onResize={startResize} cols={[{ label: 'Nome' }, { label: 'Investimento (€)', align: 'right' }, { label: 'Amort. (meses)', align: 'right' }, { label: 'Horas uso/dia', align: 'right' }, { label: '' }]} />
              </thead>
              <tbody>
                {cfg.equipamentos.map((eq: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-2"><input value={eq.nome} onChange={(e) => setArr('equipamentos', i, 'nome', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><NumInput value={eq.investimento} onChange={(e) => setArr('equipamentos', i, 'investimento', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={eq.amortMeses} onChange={(e) => setArr('equipamentos', i, 'amortMeses', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={eq.horasUsoDia} onChange={(e) => setArr('equipamentos', i, 'horasUsoDia', num(e.target.value))} /></td>
                    <td className="py-1.5 pl-1"><button onClick={() => delArr('equipamentos', i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addArr('equipamentos', { nome: '', investimento: 0, amortMeses: 60, horasUsoDia: 2 })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar equipamento</button>
        </Section>

        <Section title="Papeis">
          <p className="text-xs text-muted-foreground mb-4">O papel é também um substrato (pequeno formato). Além dos parâmetros de custo, pode indicar a <b>Unidade</b> de compra (folha/caixa/rolo/m²) e a <b>Categoria</b> para organização. Estas duas colunas são apenas organizacionais — o custo do papel continua a ser calculado a partir do custo base, margem do fornecedor e folhas por resma.</p>
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: tableW('papeis') }}>
              <Colgroup widths={cw('papeis')} />
              <thead>
                <ResizableHead tableKey="papeis" onResize={startResize} cols={[{ label: 'ID' }, { label: 'Nome' }, { label: 'Larg (mm)', align: 'right' }, { label: 'Alt (mm)', align: 'right' }, { label: 'Custo base (€)', align: 'right' }, { label: 'Margem forn.', align: 'right' }, { label: 'Folhas/resma', align: 'right' }, { label: 'Venda c/ IVA (≈)', align: 'right' }, { label: 'Unidade' }, { label: 'Categoria' }, { label: '' }]} />
              </thead>
              <tbody>
                {cfg.papeis.map((p: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-1"><input value={p.id} onChange={(e) => setArr('papeis', i, 'id', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={p.nome} title={p.nome} onChange={(e) => setArr('papeis', i, 'nome', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><NumInput value={p.larguraMm} onChange={(e) => setArr('papeis', i, 'larguraMm', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={p.alturaMm} onChange={(e) => setArr('papeis', i, 'alturaMm', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><MoneyInput value={p.custoBase} onChange={(e) => setArr('papeis', i, 'custoBase', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput step="0.01" value={p.margemFornecedor} onChange={(e) => setArr('papeis', i, 'margemFornecedor', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={p.folhasResma} onChange={(e) => setArr('papeis', i, 'folhasResma', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1 text-right truncate font-medium text-emerald-700">{eur(vendaComIva(custoFolhaPapel(p)))}</td>
                    <td className="py-1.5 px-1">
                      <select value={p.unidadeVenda || 'folha'} onChange={(e) => setArr('papeis', i, 'unidadeVenda', e.target.value)} className={inputCls}>
                        {UNIDADES_SUBSTRATO.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1">
                      <select value={p.categoria || 'Papéis'} onChange={(e) => setArr('papeis', i, 'categoria', e.target.value)} className={inputCls}>
                        {SUBSTRATO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pl-1"><button onClick={() => delArr('papeis', i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addArr('papeis', { id: '', nome: '', gramagem: 350, larguraMm: 0, alturaMm: 0, custoBase: 0, margemFornecedor: 0.2, folhasResma: 200, unidadeVenda: 'folha', categoria: 'Papéis' })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar papel</button>
        </Section>

        <Section title="Cortes / Vinco">
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: tableW('cortes') }}>
              <Colgroup widths={cw('cortes')} />
              <thead>
                <ResizableHead tableKey="cortes" onResize={startResize} cols={[{ label: 'ID' }, { label: 'Nome' }, { label: 'Velocidade (fl/min)', align: 'right' }, { label: 'Setup (min)', align: 'right' }, { label: 'Equipamento' }, { label: '' }]} />
              </thead>
              <tbody>
                {cfg.cortes.map((c: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-1"><input value={c.id} onChange={(e) => setArr('cortes', i, 'id', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={c.nome} onChange={(e) => setArr('cortes', i, 'nome', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><NumInput value={c.velocidade} onChange={(e) => setArr('cortes', i, 'velocidade', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={c.setupMin} onChange={(e) => setArr('cortes', i, 'setupMin', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1">
                      <select value={c.equipamento} onChange={(e) => setArr('cortes', i, 'equipamento', e.target.value)} className={inputCls}>
                        {cfg.equipamentos.map((eq: any, ix: number) => <option key={ix} value={eq.nome}>{eq.nome}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 pl-1"><button onClick={() => delArr('cortes', i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addArr('cortes', { id: '', nome: '', velocidade: 300, setupMin: 5, equipamento: cfg.equipamentos[0]?.nome || '' })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar corte</button>
        </Section>

        <Section title="Laminações (taxa fixa)">
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: tableW('laminacoes') }}>
              <Colgroup widths={cw('laminacoes')} />
              <thead>
                <ResizableHead tableKey="laminacoes" onResize={startResize} cols={[{ label: 'ID' }, { label: 'Nome' }, { label: 'Custo/folha (€)', align: 'right' }, { label: 'Setup mín. (€)', align: 'right' }, { label: '' }]} />
              </thead>
              <tbody>
                {cfg.laminacoes.map((l: any, i: number) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 pr-1"><input value={l.id} onChange={(e) => setArr('laminacoes', i, 'id', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={l.nome} onChange={(e) => setArr('laminacoes', i, 'nome', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><NumInput step="0.01" value={l.custoFolha} onChange={(e) => setArr('laminacoes', i, 'custoFolha', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput step="0.01" value={l.setup} onChange={(e) => setArr('laminacoes', i, 'setup', num(e.target.value))} /></td>
                    <td className="py-1.5 pl-1"><button onClick={() => delArr('laminacoes', i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addArr('laminacoes', { id: '', nome: '', custoFolha: 0.35, setup: 5 })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar laminação</button>
        </Section>

        <Section title="Substratos (Stickers)">
          <p className="text-xs text-muted-foreground mb-4">Materiais disponíveis para autocolantes. O <b>preço por rolo/caixa</b> é o que determina o custo de substrato por m² — por isso, substratos com preços diferentes produzem orçamentos diferentes. A coluna <b>€/m²</b> é calculada automaticamente a partir das dimensões, do preço e do nº de folhas/rolos por caixa. <b>Importante:</b> os quatro materiais de rolo (Mutoh) vinham todos com o mesmo preço de referência (102,75 €), pelo que trocar entre eles não alterava o valor. Acerte aqui o preço real de cada material para que a escolha de substrato passe a influenciar o orçamento.</p>
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: tableW('stickers') }}>
              <Colgroup widths={cw('stickers')} />
              <thead>
                <ResizableHead tableKey="stickers" onResize={startResize} cols={[{ label: 'ID' }, { label: 'Descrição' }, { label: 'Aplicação' }, { label: 'Máquina' }, { label: 'Larg (mm)', align: 'right' }, { label: 'Comp (mm)', align: 'right' }, { label: 'Preço rolo/caixa (€)', align: 'right' }, { label: 'Folhas/caixa', align: 'right' }, { label: '€/m²', align: 'right' }, { label: 'Venda c/ IVA (≈)', align: 'right' }, { label: 'Unidade' }, { label: 'Categoria' }, { label: 'Ativo', align: 'center' }, { label: '' }]} />
              </thead>
              <tbody>
                {(cfg.stickers?.substratos || []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-1"><input value={s.id} onChange={(e) => setSub(i, 'id', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={s.descricao} title={s.descricao} onChange={(e) => setSub(i, 'descricao', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={s.aplicacao} onChange={(e) => setSub(i, 'aplicacao', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1">
                      <select value={s.maquina} onChange={(e) => setSub(i, 'maquina', e.target.value)} className={inputCls}>
                        <option value="Mutoh">Mutoh</option>
                        <option value="Xerox">Xerox</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-1"><NumInput value={s.larguraMm} onChange={(e) => setSub(i, 'larguraMm', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={s.comprimentoMm} onChange={(e) => setSub(i, 'comprimentoMm', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><MoneyInput value={s.precoRolo} onChange={(e) => setSub(i, 'precoRolo', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={s.folhasCaixa} onChange={(e) => setSub(i, 'folhasCaixa', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1 text-right truncate text-muted-foreground">{eur(precoM2Sub(s))}</td>
                    <td className="py-1.5 px-1 text-right truncate font-medium text-emerald-700">{eur(vendaComIva(precoM2Sub(s)))}</td>
                    <td className="py-1.5 px-1">
                      <select value={s.unidadeVenda || 'rolo'} onChange={(e) => setSub(i, 'unidadeVenda', e.target.value)} className={inputCls}>
                        {UNIDADES_SUBSTRATO.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1">
                      <select value={s.categoria || categoriaPadraoSubstrato(s)} onChange={(e) => setSub(i, 'categoria', e.target.value)} className={inputCls}>
                        {SUBSTRATO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1 text-center"><input type="checkbox" checked={s.ativo !== false} onChange={(e) => setSub(i, 'ativo', e.target.checked)} className="h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500/40 cursor-pointer" /></td>
                    <td className="py-1.5 pl-1"><button onClick={() => delSub(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addSub({ id: '', descricao: '', aplicacao: '', maquina: 'Mutoh', larguraMm: 685, comprimentoMm: 1000, precoRolo: 0, folhasCaixa: 100, categoria: '', unidadeVenda: 'rolo', ativo: true })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar substrato</button>
          <p className="text-[11px] text-muted-foreground mt-2">A <b>Categoria</b> ajuda a organizar os materiais. Desative (<b>Ativo</b>) os substratos que não quer disponíveis na escolha do orçamento — os desativados deixam de aparecer no seletor, mas continuam guardados aqui.</p>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-6 mb-3">Parâmetros Mutoh (rolo) e margem</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><label className={labelCls}>Largura do rolo (mm)</label><input type="number" value={cfg.stickers?.mutohLarguraRoloMm ?? ''} onChange={(e) => setStk('mutohLarguraRoloMm', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Custo set de tinteiros (€)</label><input type="number" step="0.01" value={cfg.stickers?.mutohCustoTinteiros ?? ''} onChange={(e) => setStk('mutohCustoTinteiros', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Capacidade tinteiro (ml)</label><input type="number" value={cfg.stickers?.mutohCapacidadeTinteiroMl ?? ''} onChange={(e) => setStk('mutohCapacidadeTinteiroMl', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Consumo tinta (ml/m² @100%)</label><input type="number" step="0.1" value={cfg.stickers?.mutohConsumoMlM2 ?? ''} onChange={(e) => setStk('mutohConsumoMlM2', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Velocidade (m²/h)</label><input type="number" step="0.1" value={cfg.stickers?.mutohVelocidadeM2h ?? ''} onChange={(e) => setStk('mutohVelocidadeM2h', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Refugo rolo (0-1)</label><input type="number" step="0.01" value={cfg.stickers?.mutohRefugo ?? ''} onChange={(e) => setStk('mutohRefugo', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Fator tinta P&B (0-1)</label><input type="number" step="0.01" value={cfg.stickers?.fatorPB ?? ''} onChange={(e) => setStk('fatorPB', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Margem comercial (markup)</label><input type="number" step="0.01" value={cfg.stickers?.margemComercial ?? ''} onChange={(e) => setStk('margemComercial', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Setup / pré-impressão (min)</label><input type="number" value={cfg.stickers?.setupMin ?? ''} onChange={(e) => setStk('setupMin', num(e.target.value))} className={inputCls} /></div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">A <b>mancha de tinta</b> (cobertura) multiplica o consumo de tinta pela área impressa; a <b>margem comercial</b> aplica-se como markup sobre o custo total. Não esqueça de clicar em <b>Guardar</b> no topo.</p>
        </Section>

        <Section title="Substratos (Impressão digital de grande formato)">
          <p className="text-xs text-muted-foreground mb-4">Materiais para impressão de grande formato (vinil, lonas, etc.). Aqui o cálculo do orçamento usa diretamente o <b>€/m²</b> de cada material — por isso, mantenha esse valor atualizado. O <b>preço por rolo</b> é apenas informativo. Use a coluna <b>Categoria</b> para organizar e o <b>Ativo</b> para escolher quais materiais aparecem na seleção do orçamento.</p>
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: tableW('vinil') }}>
              <Colgroup widths={cw('vinil')} />
              <thead>
                <ResizableHead tableKey="vinil" onResize={startResize} cols={[{ label: 'ID' }, { label: 'Descrição' }, { label: 'Aplicação' }, { label: 'Larg (mm)', align: 'right' }, { label: 'Comp (mm)', align: 'right' }, { label: 'Preço rolo (€)', align: 'right' }, { label: '€/m²', align: 'right' }, { label: 'Venda c/ IVA (≈)', align: 'right' }, { label: 'Unidade' }, { label: 'Categoria' }, { label: 'Ativo', align: 'center' }, { label: '' }]} />
              </thead>
              <tbody>
                {(cfg.vinil?.substratos || []).map((s: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-1"><input value={s.id} onChange={(e) => setVinSub(i, 'id', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={s.descricao} title={s.descricao} onChange={(e) => setVinSub(i, 'descricao', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={s.aplicacao} onChange={(e) => setVinSub(i, 'aplicacao', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><NumInput value={s.larguraMm} onChange={(e) => setVinSub(i, 'larguraMm', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput value={s.comprimentoMm} onChange={(e) => setVinSub(i, 'comprimentoMm', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><MoneyInput value={s.precoRolo} onChange={(e) => setVinSub(i, 'precoRolo', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><MoneyInput value={s.precoM2} onChange={(e) => setVinSub(i, 'precoM2', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1 text-right truncate font-medium text-emerald-700">{eur(vendaComIva(s.precoM2 || 0))}</td>
                    <td className="py-1.5 px-1">
                      <select value={s.unidadeVenda || 'rolo'} onChange={(e) => setVinSub(i, 'unidadeVenda', e.target.value)} className={inputCls}>
                        {UNIDADES_SUBSTRATO.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1">
                      <select value={s.categoria || categoriaPadraoSubstrato(s)} onChange={(e) => setVinSub(i, 'categoria', e.target.value)} className={inputCls}>
                        {SUBSTRATO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1 text-center"><input type="checkbox" checked={s.ativo !== false} onChange={(e) => setVinSub(i, 'ativo', e.target.checked)} className="h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500/40 cursor-pointer" /></td>
                    <td className="py-1.5 pl-1"><button onClick={() => delVinSub(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addVinSub({ id: '', descricao: '', aplicacao: '', larguraMm: 1050, comprimentoMm: 50000, precoRolo: 0, precoM2: 0, categoria: '', unidadeVenda: 'rolo', ativo: true })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar substrato</button>
          <p className="text-[11px] text-muted-foreground mt-2">Desative (<b>Ativo</b>) os materiais que não quer disponíveis na escolha do orçamento — os desativados deixam de aparecer no seletor, mas continuam guardados aqui. Não esqueça de clicar em <b>Guardar</b> no topo.</p>
        </Section>

        <Section title="Artigos e Acessórios">
          <p className="text-xs text-muted-foreground mb-4">Artigos vendidos <b>à unidade, ao kit ou ao metro linear</b> — por exemplo distanciadores de parede, kits de fixação ou fita de dupla face. No orçamento aparecem como o tipo de trabalho <b>«Artigo / Acessório»</b>: basta escolher o artigo do catálogo e indicar a quantidade. O preço é calculado como <b>custo × quantidade × (1 + margem)</b>, e a linha é somada ao total do orçamento. Defina aqui o custo de compra e a margem de cada artigo.</p>
          <div className="overflow-x-auto">
            <table className="text-sm table-fixed" style={{ width: tableW('artigos') }}>
              <Colgroup widths={cw('artigos')} />
              <thead>
                <ResizableHead tableKey="artigos" onResize={startResize} cols={[{ label: 'ID' }, { label: 'Descrição' }, { label: 'Categoria' }, { label: 'Unidade' }, { label: 'Custo (€)', align: 'right' }, { label: 'Margem (%)', align: 'right' }, { label: 'Ativo', align: 'center' }, { label: '' }]} />
              </thead>
              <tbody>
                {(cfg.artigos || []).map((a: any, i: number) => (
                  <tr key={i} className="border-b border-border/50 align-top">
                    <td className="py-1.5 pr-1"><input value={a.id} onChange={(e) => setArtigo(i, 'id', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1"><input value={a.descricao} title={a.descricao} onChange={(e) => setArtigo(i, 'descricao', e.target.value)} className={inputCls} /></td>
                    <td className="py-1.5 px-1">
                      <select value={a.categoria || 'Acessórios de fixação'} onChange={(e) => setArtigo(i, 'categoria', e.target.value)} className={inputCls}>
                        {SUBSTRATO_CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1">
                      <select value={a.unidade || 'un'} onChange={(e) => setArtigo(i, 'unidade', e.target.value)} className={inputCls}>
                        {UNIDADES_ARTIGO.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                      </select>
                    </td>
                    <td className="py-1.5 px-1"><NumInput step="0.01" value={a.custoUnitario} onChange={(e) => setArtigo(i, 'custoUnitario', num(e.target.value))} /></td>
                    <td className="py-1.5 px-1"><NumInput step="1" value={Math.round((a.markup || 0) * 100)} onChange={(e) => setArtigo(i, 'markup', Number(e.target.value || 0) / 100)} /></td>
                    <td className="py-1.5 px-1 text-center"><input type="checkbox" checked={a.ativo !== false} onChange={(e) => setArtigo(i, 'ativo', e.target.checked)} className="h-4 w-4 rounded border-input text-emerald-600 focus:ring-emerald-500/40 cursor-pointer" /></td>
                    <td className="py-1.5 pl-1"><button onClick={() => delArtigo(i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={() => addArtigo({ id: '', descricao: '', categoria: 'Acessórios de fixação', unidade: 'un', custoUnitario: 0, markup: 0.5, ativo: true })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar artigo</button>
          <p className="text-[11px] text-muted-foreground mt-2">A <b>Margem</b> é indicada em percentagem (ex.: 50 = +50% sobre o custo). Desative (<b>Ativo</b>) os artigos que não quer disponíveis na escolha do orçamento. Não esqueça de clicar em <b>Guardar</b> no topo.</p>
        </Section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Section title="Faixas de Margem">
            <div className="overflow-x-auto">
              <table className="text-sm table-fixed" style={{ width: tableW('faixasMargem') }}>
                <Colgroup widths={cw('faixasMargem')} />
                <thead>
                  <ResizableHead tableKey="faixasMargem" onResize={startResize} cols={[{ label: 'Quantidade ≥' }, { label: 'Margem (0-1)', align: 'right' }, { label: '' }]} />
                </thead>
                <tbody>
                  {cfg.faixasMargem.map((f: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 align-top">
                      <td className="py-1.5 pr-1"><NumInput value={f.quantidade} onChange={(e) => setArr('faixasMargem', i, 'quantidade', num(e.target.value))} /></td>
                      <td className="py-1.5 px-1"><NumInput step="0.01" value={f.margem} onChange={(e) => setArr('faixasMargem', i, 'margem', num(e.target.value))} /></td>
                      <td className="py-1.5 pl-1"><button onClick={() => delArr('faixasMargem', i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => addArr('faixasMargem', { quantidade: 0, margem: 0.5 })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar faixa</button>
          </Section>

          <Section title="Descontos por Tipo de Cliente">
            <div className="overflow-x-auto">
              <table className="text-sm table-fixed" style={{ width: tableW('descontosCliente') }}>
                <Colgroup widths={cw('descontosCliente')} />
                <thead>
                  <ResizableHead tableKey="descontosCliente" onResize={startResize} cols={[{ label: 'Tipo' }, { label: 'Etiqueta' }, { label: 'Desconto (0-1)', align: 'right' }, { label: '' }]} />
                </thead>
                <tbody>
                  {cfg.descontosCliente.map((d: any, i: number) => (
                    <tr key={i} className="border-b border-border/50 align-top">
                      <td className="py-1.5 pr-1"><input value={d.tipo} onChange={(e) => setArr('descontosCliente', i, 'tipo', e.target.value)} className={inputCls} /></td>
                      <td className="py-1.5 px-1"><input value={d.label} onChange={(e) => setArr('descontosCliente', i, 'label', e.target.value)} className={inputCls} /></td>
                      <td className="py-1.5 px-1"><NumInput step="0.01" value={d.desconto} onChange={(e) => setArr('descontosCliente', i, 'desconto', num(e.target.value))} /></td>
                      <td className="py-1.5 pl-1"><button onClick={() => delArr('descontosCliente', i)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => addArr('descontosCliente', { tipo: '', label: '', desconto: 0 })} className="mt-3 inline-flex items-center gap-1.5 text-sm text-emerald-700 hover:text-emerald-800"><Plus className="h-4 w-4" /> Adicionar tipo</button>
          </Section>
        </div>

        <Section title="Parâmetros Gerais">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className={labelCls}>Sobretaxa 24h (0-1)</label><input type="number" step="0.01" value={cfg.sobretaxa24h} onChange={(e) => set('sobretaxa24h', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Margem mínima alerta (0-1)</label><input type="number" step="0.01" value={cfg.margemMinima} onChange={(e) => set('margemMinima', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>IVA (0-1)</label><input type="number" step="0.01" value={cfg.iva} onChange={(e) => set('iva', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Entidade Multibanco</label><input value={cfg.entidadeMB || ''} onChange={(e) => set('entidadeMB', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Chave/Referência Multibanco</label><input value={cfg.chaveMB || ''} onChange={(e) => set('chaveMB', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Número MB WAY</label><input value={cfg.mbwayNumero || ''} onChange={(e) => set('mbwayNumero', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Quantidades da tabela (vírgulas)</label><input value={(cfg.quantidadesTabela || []).join(', ')} onChange={(e) => set('quantidadesTabela', e.target.value.split(',').map((x: string) => parseInt(x.trim(), 10)).filter((n: number) => !isNaN(n)))} className={inputCls} /></div>
          </div>
        </Section>

        <Section title="Arte-final">
          <p className="text-xs text-muted-foreground mb-4">Valores sugeridos para o serviço de arte-final quando não é o cliente a fornecer o ficheiro. Adicionados ao total (com IVA), sem margem de impressão.</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div><label className={labelCls}>Criação de raiz (€)</label><input type="number" step="0.01" value={cfg.arteFinalCriacao ?? 25} onChange={(e) => set('arteFinalCriacao', num(e.target.value))} className={inputCls} /></div>
            <div><label className={labelCls}>Adaptação/alteração (€)</label><input type="number" step="0.01" value={cfg.arteFinalAdaptacao ?? 10} onChange={(e) => set('arteFinalAdaptacao', num(e.target.value))} className={inputCls} /></div>
          </div>
        </Section>

        <Section title="Condições de venda (verso do orçamento)">
          <p className="text-xs text-muted-foreground mb-4">Este texto aparece na 2.ª página do orçamento (verso). Fica em aberto para acrescentar ou editar livremente — as alterações aplicam-se a todos os orçamentos gerados a partir daqui.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div><label className={labelCls}>% de adjudicação (adiantamento)</label><input type="number" step="1" value={cfg.percentagemAdjudicacao ?? 0} onChange={(e) => set('percentagemAdjudicacao', num(e.target.value))} className={inputCls} /></div>
          </div>
          <label className={labelCls}>Texto das condições gerais de venda</label>
          <textarea value={cfg.condicoesVenda || ''} onChange={(e) => set('condicoesVenda', e.target.value)} rows={16} className={inputCls + ' font-mono text-xs leading-relaxed resize-y'} placeholder="Escreva aqui as condições gerais de venda..." />
          <p className="text-[11px] text-muted-foreground mt-2">Sugestão: separe cada cláusula com uma linha em branco para ficarem em blocos distintos no documento.</p>
        </Section>

        <Section title="Aparência do PDF">
          <p className="text-xs text-muted-foreground mb-5">Personalize as cores, textos e o cabeçalho dos orçamentos em PDF. As alterações aplicam-se a todos os orçamentos gerados a partir daqui. O posicionamento dos blocos (calibrado para o envelope de janela e impressão A4) mantém-se inalterado.</p>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Cores por tipo de documento</h4>
          <div className="space-y-4 mb-6">
            {TIPOS_PDF.map((tp) => {
              const cor = (cfg.aparenciaPdf?.cores?.[tp.key]) || {};
              return (
                <div key={tp.key} className="rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-block h-4 w-4 rounded-full border border-border" style={{ backgroundColor: cor.bar || '#000' }} />
                    <span className="text-sm font-medium text-foreground">{tp.label}</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorField label="Cor principal (barras)" value={cor.bar} onChange={(v) => setApColor(tp.key, 'bar', v)} />
                    <ColorField label="Texto sobre a cor principal" value={cor.barText} onChange={(v) => setApColor(tp.key, 'barText', v)} />
                    <ColorField label="Tom claro (fundos suaves)" value={cor.tint} onChange={(v) => setApColor(tp.key, 'tint', v)} />
                    <ColorField label="Cor de destaque" value={cor.accent} onChange={(v) => setApColor(tp.key, 'accent', v)} />
                  </div>
                </div>
              );
            })}
          </div>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Textos e rótulos</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {TEXTOS_PDF.map((tx) => (
              <div key={tx.key}>
                <label className={labelCls}>{tx.label}</label>
                <input value={cfg.aparenciaPdf?.textos?.[tx.key] ?? ''} onChange={(e) => setApText(tx.key, e.target.value)} className={inputCls} />
              </div>
            ))}
          </div>

          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Cabeçalho do documento</h4>
          <p className="text-xs text-muted-foreground mb-3">Imagem do topo do orçamento (logo + contactos). Recomenda-se uma imagem larga (proporção ≈ 3:1), PNG ou JPG até 900 KB. Se não definir nenhuma, é usado o cabeçalho predefinido.</p>
          {cfg.aparenciaPdf?.cabecalhoDataUri ? (
            <div className="mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cfg.aparenciaPdf.cabecalhoDataUri} alt="Cabeçalho personalizado" className="max-h-24 rounded-lg border border-border bg-white p-2" />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3 italic">A usar o cabeçalho predefinido.</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium cursor-pointer">
              <Upload className="h-4 w-4" /> Carregar imagem
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { onUploadCabecalho(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </label>
            {cfg.aparenciaPdf?.cabecalhoDataUri && (
              <button onClick={() => setApCabecalho('')} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-input bg-background hover:bg-red-50 text-red-600 text-sm font-medium">
                <Trash2 className="h-4 w-4" /> Remover (usar predefinido)
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Não esqueça de clicar em <b>Guardar</b> no topo para aplicar as alterações.</p>
        </Section>
      </div>
    </div>
  );
}
