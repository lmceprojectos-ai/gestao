'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Printer, FileDown, Loader2, Pencil, FileText, AlertTriangle, CheckCircle2, Eye, X, Download, Copy, Send, Mail, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate } from '@/lib/format';
import { formatNumeroOrcamento, anoDe, tipoTemIva, tipoOrcamentoInfo } from '@/lib/grafica/numero';
import { OrcamentoAnexos } from '../_components/orcamento-anexos';
import { toast } from 'sonner';

const ESTADOS: { value: string; label: string; cls: string }[] = [
  { value: 'rascunho', label: 'Rascunho', cls: 'bg-slate-200 text-slate-700 border-slate-300' },
  { value: 'pendente', label: 'Pendente', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'em_analise', label: 'Em Análise', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'adjudicado', label: 'Adjudicado', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'producao', label: 'Em Produção', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
  { value: 'finalizado', label: 'Finalizado', cls: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { value: 'recusado', label: 'Recusado', cls: 'bg-red-100 text-red-800 border-red-200' },
];

function pct(n: number) {
  return `${((n || 0) * 100).toFixed(0)}%`;
}

export default function OrcamentoDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [orc, setOrc] = useState<any>(null);
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [moloniLoading, setMoloniLoading] = useState(false);
  const [estadoLoading, setEstadoLoading] = useState(false);
  const [folhaObra, setFolhaObra] = useState('');
  const [folhaLoading, setFolhaLoading] = useState(false);
  const [pctAdj, setPctAdj] = useState<number | ''>(100);
  const [pctAdjLoading, setPctAdjLoading] = useState(false);
  const [arteLoading, setArteLoading] = useState(false);
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [enviarModo, setEnviarModo] = useState<'email' | 'whatsapp'>('email');
  const [enviarEmail, setEnviarEmail] = useState('');
  const [enviarTelefone, setEnviarTelefone] = useState('');
  const [enviarMensagem, setEnviarMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  const load = async () => {
    try {
      const [ro, rc] = await Promise.all([fetch(`/api/grafica/orcamentos/${id}`), fetch('/api/grafica/config')]);
      if (!ro.ok) throw new Error();
      const dadosOrc = await ro.json();
      setOrc(dadosOrc);
      setFolhaObra(dadosOrc.folhaObra || '');
      setPctAdj(dadosOrc.percentagemAdjudicacao ?? 100);
      setConfig(await rc.json());
    } catch {
      toast.error('Erro ao carregar orçamento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const mudarEstado = async (estado: string) => {
    setEstadoLoading(true);
    try {
      const r = await fetch(`/api/grafica/orcamentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ __apenasEstado: true, estado }),
      });
      if (!r.ok) throw new Error();
      setOrc((o: any) => ({ ...o, estado }));
      toast.success('Estado atualizado');
    } catch {
      toast.error('Erro ao atualizar estado');
    } finally {
      setEstadoLoading(false);
    }
  };

  const guardarPctAdj = async () => {
    setPctAdjLoading(true);
    try {
      // 100 ou vazio => pagamento total (guardado como null); 1..99 => adjudicação.
      const nVal = pctAdj === '' ? 100 : Math.max(0, Math.min(100, Math.round(Number(pctAdj))));
      const valorGuardar = nVal >= 100 || nVal <= 0 ? null : nVal;
      const r = await fetch(`/api/grafica/orcamentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ __apenasEstado: true, percentagemAdjudicacao: valorGuardar }),
      });
      if (!r.ok) throw new Error();
      setOrc((o: any) => ({ ...o, percentagemAdjudicacao: valorGuardar, mbEntidade: null, mbReferencia: null, mbValor: null }));
      setPctAdj(valorGuardar ?? 100);
      toast.success(valorGuardar ? `Adjudicação definida em ${valorGuardar}%` : 'Definido como pagamento total (100%)');
    } catch {
      toast.error('Erro ao guardar a percentagem de adjudicação');
    } finally {
      setPctAdjLoading(false);
    }
  };

  const guardarFolhaObra = async () => {
    setFolhaLoading(true);
    try {
      const valor = folhaObra.trim();
      const r = await fetch(`/api/grafica/orcamentos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ __apenasEstado: true, folhaObra: valor }),
      });
      if (!r.ok) throw new Error();
      setOrc((o: any) => ({ ...o, folhaObra: valor || null }));
      toast.success(valor ? 'Folha de obra guardada' : 'Folha de obra removida');
    } catch {
      toast.error('Erro ao guardar folha de obra');
    } finally {
      setFolhaLoading(false);
    }
  };

  const nomeDocumento = () =>
    [formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt)), orc.clienteNome]
      .filter(Boolean)
      .join(' - ')
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'orcamento';

  // Gera o PDF e devolve o Blob (application/pdf)
  const gerarPdfBlob = async (): Promise<Blob> => {
    const r = await fetch(`/api/grafica/orcamentos/${id}/pdf`, { method: 'POST' });
    const d = await r.json();
    if (!r.ok || !d.request_id) throw new Error(d.error || 'Falha ao iniciar PDF');
    const started = Date.now();
    while (Date.now() - started < 5 * 60 * 1000) {
      await new Promise((res) => setTimeout(res, 1500));
      const rs = await fetch(`/api/grafica/orcamentos/${id}/pdf/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: d.request_id }),
      });
      const ds = await rs.json();
      if (ds.status === 'SUCCESS' && ds.pdf_base64) {
        return new Blob([Uint8Array.from(atob(ds.pdf_base64), (c) => c.charCodeAt(0))], { type: 'application/pdf' });
      }
      if (ds.status === 'FAILED') throw new Error(ds.error || 'Falha na geração do PDF');
    }
    throw new Error('Tempo esgotado a gerar o PDF');
  };

  // Gera o PDF e devolve um blob URL (application/pdf)
  const gerarPdfBlobUrl = async (): Promise<string> => URL.createObjectURL(await gerarPdfBlob());

  // Pré-visualizar: mostra o PDF dentro da aplicação (sem descarregar)
  const preVisualizar = async () => {
    setPreviewLoading(true);
    try {
      const url = await gerarPdfBlobUrl();
      setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return url; });
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PDF');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Descarregar: guarda o ficheiro no computador
  const descarregarPdf = async () => {
    setPdfLoading(true);
    try {
      const url = await gerarPdfBlobUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = `${nomeDocumento()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('PDF descarregado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao gerar PDF');
    } finally {
      setPdfLoading(false);
    }
  };

  const descarregarArteFicheiro = async () => {
    setArteLoading(true);
    try {
      const r = await fetch(`/api/grafica/orcamentos/${id}/arte-ficheiro`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao obter ficheiro');
      const a = document.createElement('a');
      a.href = d.url;
      a.download = d.nome || 'arte-final';
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success('Ficheiro descarregado');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao descarregar ficheiro');
    } finally {
      setArteLoading(false);
    }
  };

  const fecharPreview = () => {
    setPreviewUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
  };

  const descarregarDoPreview = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `${nomeDocumento()}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const emitirFatura = async () => {
    if (!orc.clienteId) {
      toast.error('Associe um cliente ao orçamento primeiro (editar).');
      return;
    }
    if (!confirm('Emitir fatura em rascunho no Moloni para este orçamento?')) return;
    setMoloniLoading(true);
    try {
      const r = await fetch(`/api/grafica/orcamentos/${id}/moloni`, { method: 'POST' });
      // A resposta pode não ser JSON (p.ex. página de erro do servidor); lemos texto e tentamos interpretar.
      const raw = await r.text();
      let d: any = {};
      try { d = raw ? JSON.parse(raw) : {}; } catch { d = {}; }
      if (!r.ok) throw new Error(d.error || `Erro ao comunicar com o servidor (${r.status}). Tente novamente.`);
      toast.success('Fatura rascunho criada no Moloni' + (d.document_id ? ` (doc ${d.document_id})` : ''));
      load();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao emitir fatura');
    } finally {
      setMoloniLoading(false);
    }
  };

  // Total do documento (mesma lógica do PDF): preço + arte-final + portes + opções incluídas (+ IVA quando aplicável)
  const calcularTotalDoc = (): number => {
    const comIvaLocal = tipoTemIva(orc.tipoOrcamento);
    const ivaRate = (config?.iva as number) || 0.23;
    const arteFinal = orc.arteFinalValor > 0 ? orc.arteFinalValor : 0;
    const portes = orc.portesEnvio > 0 ? orc.portesEnvio : 0;
    const opcoes = Array.isArray(orc.opcoesExtra) ? orc.opcoesExtra : [];
    const opcoesIncluidas = opcoes.filter((o: any) => o?.incluida).reduce((s: number, o: any) => s + (Number(o?.valor) || 0), 0);
    const deslocacaoVal = orc.deslocacao && orc.deslocacao.incluir ? (Number(orc.deslocacao.valor) || 0) : 0;
    const base = comIvaLocal ? orc.precoComIva : orc.precoSemIva;
    const extras = portes + arteFinal + opcoesIncluidas + deslocacaoVal;
    const extrasIva = comIvaLocal ? extras * ivaRate : 0;
    return base + extras + extrasIva;
  };

  const abrirEnviar = () => {
    const contacto = String(orc.clienteContacto || '').trim();
    const contactoEmail = contacto.includes('@') ? contacto : '';
    const contactoTel = !contacto.includes('@') && /\d/.test(contacto) ? contacto : '';
    // Pré-preencher AMBOS os campos a partir dos dados do cliente, para que ao trocar
    // entre Email e WhatsApp o valor correto já esteja disponível.
    const email = String(orc.clienteEmail || '').trim() || contactoEmail;
    const telefone = String(orc.clienteTelefone || '').trim() || contactoTel;
    setEnviarEmail(email);
    setEnviarTelefone(telefone);
    // Modo inicial: email se houver email; caso contrário whatsapp se houver número.
    setEnviarModo(email ? 'email' : telefone ? 'whatsapp' : 'email');
    setEnviarMensagem('');
    setEnviarOpen(true);
  };

  const mensagemPadrao = () => {
    const nome = orc.clienteNome || orc.clienteEmpresa || '';
    const numeroFmt = formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt));
    const total = calcularTotalDoc();
    return `Olá ${nome ? nome + ', ' : ''}segue o orçamento ${numeroFmt}. Total: ${formatCurrency(total)}. Obrigado! — CRIACONSENSOS`;
  };

  const enviarPorEmail = async () => {
    const email = enviarEmail.trim();
    if (!email.includes('@')) {
      toast.error('Indique um email válido.');
      return;
    }
    setEnviando(true);
    try {
      const r = await fetch(`/api/grafica/orcamentos/${id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'email', destino: email, mensagem: enviarMensagem.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao enviar email');
      toast.success('Email enviado e registado');
      setOrc((o: any) => ({ ...o, envios: d.envios, estado: d.estado || o.estado }));
      setEnviarOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao enviar email');
    } finally {
      setEnviando(false);
    }
  };

  const enviarPorWhatsapp = async () => {
    const bruto = enviarTelefone.trim();
    let digitos = bruto.replace(/\D/g, '');
    if (!digitos) {
      toast.error('Indique um número de telefone.');
      return;
    }
    // Se parecer um número nacional (9 dígitos) sem indicativo, prefixar 351 (Portugal)
    if (digitos.length === 9 && !bruto.trim().startsWith('+') && !digitos.startsWith('351')) {
      digitos = '351' + digitos;
    }
    // Abrir uma janela em branco de imediato (no clique) para evitar o bloqueio de popup;
    // o endereço do WhatsApp é definido assim que o PDF estiver pronto (caminho de recurso).
    const win = window.open('', '_blank');
    setEnviando(true);
    try {
      toast.info('A preparar o PDF do orçamento…');
      const blob = await gerarPdfBlob();
      const fileName = `${nomeDocumento()}.pdf`;
      const base = enviarMensagem.trim() || mensagemPadrao();
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // 1) Se o dispositivo suportar partilha de ficheiros, envia o PDF em ANEXO
      //    (o utilizador escolhe o WhatsApp na folha de partilha do sistema). Assim
      //    vai o próprio ficheiro, com o nome do orçamento — e não um link.
      const navAny = navigator as any;
      let partilhado = false;
      if (typeof navAny.canShare === 'function' && navAny.canShare({ files: [file] })) {
        try {
          if (win) win.close();
          await navAny.share({ files: [file], title: fileName, text: base });
          partilhado = true;
        } catch (err: any) {
          if (err?.name === 'AbortError') { setEnviando(false); return; }
          partilhado = false;
        }
      }

      // 2) Caso o dispositivo não suporte anexar o ficheiro pela partilha nativa,
      //    descarrega o PDF (com o nome do orçamento) e abre a conversa do WhatsApp
      //    para o número indicado, para o utilizador anexar o ficheiro descarregado.
      if (!partilhado) {
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = dlUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(dlUrl), 15000);
        const waUrl = `https://wa.me/${digitos}?text=${encodeURIComponent(base)}`;
        if (win) win.location.href = waUrl;
        else window.open(waUrl, '_blank');
        toast.success('PDF descarregado com o nome do orçamento. Anexe-o na conversa do WhatsApp que foi aberta.');
      } else {
        toast.success('PDF enviado por WhatsApp');
      }

      const r = await fetch(`/api/grafica/orcamentos/${id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modo: 'whatsapp', destino: bruto, mensagem: base }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro ao registar envio');
      setOrc((o: any) => ({ ...o, envios: d.envios, estado: d.estado || o.estado }));
      setEnviarOpen(false);
    } catch (e: any) {
      if (win) win.close();
      toast.error(e.message || 'Erro ao enviar por WhatsApp');
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (!orc) return null;

  const bd: any = orc.breakdown || {};
  const esp: any = orc.especificacoes || {};
  const tabela: any[] = orc.tabelaPrecos || bd.tabela || [];
  const papel = config?.papeis?.find((p: any) => p.id === esp.papelId);
  const isSticker = orc.produto === 'stickers';
  const isContratar = orc.produto === 'contratar';
  const isFlyer = orc.produto === 'imp_peq_formato';
  const isVinil = orc.produto === 'vinil';
  const isLivre = orc.produto === 'livre';
  const vinilSubstrato = config?.vinil?.substratos?.find((s: any) => s.id === esp.substratoId);
  const flyPapel = config?.flyers?.papeis?.find((p: any) => p.id === esp.papelId);
  const flyAcabNomes: string[] = (esp.acabamentos || []).map((id: string) => (config?.flyers?.acabamentos || []).find((a: any) => a.id === id)?.nome || id);
  const substrato = config?.stickers?.substratos?.find((s: any) => s.id === esp.substratoId);
  const comIva = tipoTemIva(orc.tipoOrcamento);
  const tipoInfo = tipoOrcamentoInfo(orc.tipoOrcamento);
  const itens: any[] = Array.isArray(orc.itens) ? orc.itens : [];
  const multi = itens.length > 1;
  const labelProduto = (p: string) => p === 'cartoes' ? 'Cartões Comerciais' : p === 'stickers' ? 'Stickers / Adesivos' : p === 'contratar' ? 'Contratar (Subcontratação)' : p === 'imp_peq_formato' ? 'Flyers' : p === 'vinil' ? 'Impressão digital de grande formato' : p === 'livre' ? 'Produto em Branco' : p;
  const resumoItem = (it: any): string => {
    const e = it.especificacoes || {};
    const p = it.produto;
    const parts: string[] = [];
    if (p === 'livre') {
      if (e.descricao) parts.push(String(e.descricao).split('\n')[0]);
    } else if (p === 'contratar') {
      if (e.descricao) parts.push(e.descricao);
      if (e.fornecedor) parts.push('Forn.: ' + e.fornecedor);
    } else {
      if (e.larguraMm && e.alturaMm) parts.push(`${e.larguraMm}×${e.alturaMm} mm`);
      if (p === 'stickers') { const s = config?.stickers?.substratos?.find((x: any) => x.id === e.substratoId); if (s) parts.push(s.descricao); }
      else if (p === 'vinil') { const s = config?.vinil?.substratos?.find((x: any) => x.id === e.substratoId); if (s) parts.push(s.descricao); }
      else if (p === 'imp_peq_formato') { const fp = config?.flyers?.papeis?.find((x: any) => x.id === e.papelId); if (fp) parts.push(`${fp.tipo} ${fp.gramagem}g`); if (e.formato && e.formato !== 'personalizado') parts.push(e.formato); }
      else { const pp = config?.papeis?.find((x: any) => x.id === e.papelId); if (pp) parts.push(pp.nome); }
    }
    return parts.filter(Boolean).join(' · ') || '—';
  };

  return (
    <div>
      <PageHeader
        title={formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt))}
        description={`${tipoInfo?.label || 'Orçamento'} · ${orc.clienteEmpresa || orc.clienteNome || 'Sem cliente associado'}`}
        icon={Printer}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/orcamentos-graficos" className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
            <Link href={`/orcamentos-graficos/novo?id=${orc.id}`} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium">
              <Pencil className="h-4 w-4" /> Editar
            </Link>
            <Link href={`/orcamentos-graficos/novo?duplicar=${orc.id}`} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium">
              <Copy className="h-4 w-4" /> Duplicar
            </Link>
            <button onClick={preVisualizar} disabled={previewLoading} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium disabled:opacity-60">
              {previewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Pré-visualizar
            </button>
            <button onClick={descarregarPdf} disabled={pdfLoading} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium disabled:opacity-60">
              {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} Descarregar PDF
            </button>
            <button onClick={abrirEnviar} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium">
              <Send className="h-4 w-4" /> Enviar
            </button>
            {comIva && (
              <button onClick={emitirFatura} disabled={moloniLoading} className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60">
                {moloniLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Emitir Fatura Rascunho
              </button>
            )}
          </div>
        }
      />

      {/* Estado */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-2">Estado do orçamento</div>
            <div className="flex gap-2">
              {ESTADOS.map((e) => (
                <button
                  key={e.value}
                  onClick={() => mudarEstado(e.value)}
                  disabled={estadoLoading}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${orc.estado === e.value ? e.cls : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                >
                  {orc.estado === e.value && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {e.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-2">Folha de obra</div>
            <div className="flex items-center gap-2">
              <input
                value={folhaObra}
                onChange={(e) => setFolhaObra(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') guardarFolhaObra(); }}
                placeholder="N.º da folha de obra"
                className="w-44 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                onClick={guardarFolhaObra}
                disabled={folhaLoading || folhaObra.trim() === (orc.folhaObra || '')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                {folhaLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Guardar
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-2">Adjudicação (%)</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={100}
                value={pctAdj}
                onChange={(e) => setPctAdj(e.target.value === '' ? '' : Number(e.target.value))}
                onKeyDown={(e) => { if (e.key === 'Enter') guardarPctAdj(); }}
                className="w-24 px-3 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              />
              <button
                onClick={guardarPctAdj}
                disabled={pctAdjLoading || (pctAdj === '' ? 100 : Number(pctAdj)) === ((orc.percentagemAdjudicacao ?? 100))}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-medium transition-colors"
              >
                {pctAdjLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Guardar
              </button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 max-w-[220px]">100% = pagamento total. Ex.: 50% gera a referência MB/MB WAY para metade do valor.</div>
          </div>
          {orc.moloniDocId && (
            <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              Fatura rascunho Moloni: <b>#{orc.moloniDocId}</b>
            </div>
          )}
        </div>
      </div>

      {bd.abaixoMargemMinima && (
        <motion.div initial={false} className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mb-5">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm"><b>Margem abaixo do mínimo</b> ({config ? pct(config.margemMinima) : ''}).</div>
        </motion.div>
      )}

      {multi && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mb-5">
          <h3 className="text-sm font-semibold mb-3">Tipos de trabalho deste orçamento ({itens.length})</h3>
          <div className="space-y-2">
            {itens.map((it: any, i: number) => (
              <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border/60 bg-background">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{i + 1}. {labelProduto(it.produto)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">{resumoItem(it)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Qtd: {it.quantidade}
                    {Number(it.arteFinalValor) > 0
                      ? ` · Arte-final${it.arteFinalModo === 'criacao' ? ' (criação)' : it.arteFinalModo === 'adaptacao' ? ' (adaptação)' : ''}: ${formatCurrency(Number(it.arteFinalValor))}`
                      : it.arteFinalModo === 'cliente' ? ' · Arte-final: ficheiro do cliente' : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold text-emerald-700">{formatCurrency(it.precoSemIva)}</div>
                  <div className="text-[11px] text-muted-foreground">s/IVA</div>
                  {it.produto === 'vinil' && it.breakdown?.cartoesPorFolha > 0 && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">{formatCurrency((it.breakdown.precoSemIva || 0) / it.breakdown.cartoesPorFolha)}/m² · {Number(it.breakdown.cartoesPorFolha).toFixed(2)} m²</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Especificações */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
          <h3 className="text-sm font-semibold mb-3">Especificações{multi ? ' — 1.º produto' : ''}</h3>
          <dl className="space-y-2 text-sm">
            {orc.clienteEmpresa && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Empresa</dt><dd className="text-right">{orc.clienteEmpresa}</dd></div>}
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Cliente</dt><dd className="text-right">{orc.clienteNome || (orc.clienteEmpresa ? '—' : 'Sem cliente')}{!orc.clienteId && (orc.clienteNome || orc.clienteEmpresa) ? <span className="ml-1 text-[10px] uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">não registado</span> : null}</dd></div>
            {(() => {
              // O campo "Contacto" costuma conter "telefone · email". Se for apenas a
              // repetição do email/telefone que já aparecem abaixo, não o mostramos
              // (evita o número e o email aparecerem duas vezes).
              const contacto = String(orc.clienteContacto || '').trim();
              if (!contacto) return null;
              const email = String(orc.clienteEmail || '').trim();
              const telefone = String(orc.clienteTelefone || '').trim();
              const partes = contacto.split(/[·|,;/\n]+/).map((s: string) => s.trim()).filter(Boolean);
              const redundante = partes.length > 0 && partes.every((p: string) => p === email || p === telefone);
              if (redundante) return null;
              return <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Contacto</dt><dd className="text-right">{contacto}</dd></div>;
            })()}
            {orc.clienteNif && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">NIF</dt><dd className="text-right">{orc.clienteNif}</dd></div>}
            {orc.clienteEmail && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Email</dt><dd className="text-right">{orc.clienteEmail}</dd></div>}
            {orc.clienteTelefone && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Telefone</dt><dd className="text-right">{orc.clienteTelefone}</dd></div>}
            {[orc.clienteMorada, orc.clienteCodigoPostal, orc.clienteCidade].filter(Boolean).length > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Morada</dt><dd className="text-right">{[orc.clienteMorada, orc.clienteCodigoPostal, orc.clienteCidade].filter(Boolean).join(', ')}</dd></div>}
            {isLivre ? (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tipo de trabalho</dt><dd>Produto em Branco</dd></div>
                {esp.descricao && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descrição</dt><dd className="text-right whitespace-pre-wrap">{esp.descricao}</dd></div>}
                {esp.precoUnitario != null && <div className="flex justify-between"><dt className="text-muted-foreground">Preço unitário (s/IVA)</dt><dd>{formatCurrency(esp.precoUnitario || 0)}</dd></div>}
              </>
            ) : isContratar ? (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tipo de trabalho</dt><dd>Contratar (Subcontratação)</dd></div>
                {esp.descricao && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descrição</dt><dd className="text-right">{esp.descricao}</dd></div>}
                {esp.fornecedor && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Fornecedor</dt><dd className="text-right">{esp.fornecedor}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">Custo do fornecedor</dt><dd>{formatCurrency((esp.custoUnitario || 0) * (orc.quantidade || 0))}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Margem aplicada</dt><dd>{pct(esp.markup || 0)}</dd></div>
              </>
            ) : isSticker ? (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tipo de trabalho</dt><dd>Stickers / Adesivos</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Máquina</dt><dd>{esp.maquinaModo === 'mutoh' ? 'Mutoh (rolo) — forçada' : esp.maquinaModo === 'xerox' ? 'Versant (folha) — forçada' : 'Automático (mais barato)'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Substrato</dt><dd className="text-right">{substrato ? substrato.descricao : esp.substratoId}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Dimensão</dt><dd>{esp.larguraMm}×{esp.alturaMm} mm</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Bleed</dt><dd>{esp.sangriaMm} mm/lado</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Impressão</dt><dd>{esp.cor ? 'Cor' : 'P&B'} · cobertura {Math.round((esp.coberturaTinta ?? 1) * 100)}%</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Corte</dt><dd className="text-right">{esp.tipoCorte || '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Laminação</dt><dd>{esp.laminacao ? 'Sim' : 'Não'}</dd></div>
                {esp.aplicacao && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Aplicação</dt><dd className="text-right">{esp.aplicacao}</dd></div>}
                {bd.opcaoProducao && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Produção</dt><dd className="text-right">{bd.opcaoProducao}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">Stickers/folha</dt><dd>{bd.cartoesPorFolha} ({pct(bd.aproveitamento)})</dd></div>
              </>
            ) : isFlyer ? (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tipo de trabalho</dt><dd>Flyers</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Papel</dt><dd className="text-right">{flyPapel ? `${flyPapel.tipo} ${flyPapel.gramagem}g` : esp.papelId}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Formato</dt><dd>{esp.formato === 'personalizado' ? `${esp.larguraMm}×${esp.alturaMm} mm` : esp.formato}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Impressão</dt><dd>{esp.frenteVerso ? 'Frente e Verso' : 'Só Frente'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Cor frente</dt><dd>{esp.corFrente ? 'Cor' : 'P&B'}</dd></div>
                {esp.frenteVerso && <div className="flex justify-between"><dt className="text-muted-foreground">Cor verso</dt><dd>{esp.corVerso ? 'Cor' : 'P&B'}</dd></div>}
                {flyAcabNomes.length > 0 && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Acabamentos</dt><dd className="text-right">{flyAcabNomes.join(', ')}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">Peças/folha</dt><dd>{bd.cartoesPorFolha} ({pct(bd.aproveitamento)})</dd></div>
              </>
            ) : isVinil ? (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tipo de trabalho</dt><dd>Impressão digital de grande formato</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Substrato</dt><dd className="text-right">{vinilSubstrato ? vinilSubstrato.descricao : esp.substratoId}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Dimensão</dt><dd>{esp.larguraMm}×{esp.alturaMm} mm</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Cores</dt><dd>CMYK</dd></div>
                {esp.laminacaoId && <div className="flex justify-between"><dt className="text-muted-foreground">Laminação</dt><dd>Sim</dd></div>}
                {esp.recorteContorno && <div className="flex justify-between"><dt className="text-muted-foreground">Recorte de contorno</dt><dd>Sim{esp.pelicula ? ' · c/ película' : ''}</dd></div>}
                {esp.ilhoses && <div className="flex justify-between"><dt className="text-muted-foreground">Ilhoses</dt><dd>Sim</dd></div>}
                {esp.biadesivo && <div className="flex justify-between"><dt className="text-muted-foreground">Biadesivo</dt><dd>Sim</dd></div>}
                {esp.aplicacao && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Aplicação</dt><dd className="text-right">{esp.aplicacao}</dd></div>}
                {esp.aplicacaoNoLocal && <div className="flex justify-between"><dt className="text-muted-foreground">Aplicação no local</dt><dd>Sim</dd></div>}
                {bd.opcaoProducao && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Produção</dt><dd className="text-right">{bd.opcaoProducao}</dd></div>}
                {bd.aproveitamentoRolo ? (
                  <>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Base de facturação</dt><dd className="text-right">{bd.aproveitamentoRolo.baseFaturacao}</dd></div>
                    {!bd.aproveitamentoRolo.placa && (
                      <>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Largura do rolo</dt><dd className="text-right">{bd.aproveitamentoRolo.larguraRoloMm} mm</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Orientação · peças/largura</dt><dd className="text-right">{bd.aproveitamentoRolo.orientacao} · {bd.aproveitamentoRolo.pecasPorLargura}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Rolo consumido</dt><dd className="text-right">{bd.aproveitamentoRolo.compRoloM.toFixed(2)} m ({bd.aproveitamentoRolo.areaRoloM2.toFixed(2)} m²)</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Aproveitamento</dt><dd className="text-right font-medium">{Math.round(bd.aproveitamentoRolo.aproveitamentoPct * 100)}%</dd></div>
                      </>
                    )}
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Área real das peças</dt><dd className="text-right">{bd.aproveitamentoRolo.areaPecasM2.toFixed(2)} m²</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Preço efetivo</dt><dd className="text-right font-semibold text-emerald-700">{formatCurrency(bd.aproveitamentoRolo.precoPorM2)}/m²{!bd.aproveitamentoRolo.placa ? ` · ${formatCurrency(bd.aproveitamentoRolo.precoPorMetroLinear)}/m linear` : ''}</dd></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between"><dt className="text-muted-foreground">Área total</dt><dd>{(bd.cartoesPorFolha || 0).toFixed(2)} m²</dd></div>
                    {bd.cartoesPorFolha > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Preço por m²</dt><dd className="font-semibold text-emerald-700">{formatCurrency((bd.precoSemIva || 0) / bd.cartoesPorFolha)}</dd></div>}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="flex justify-between"><dt className="text-muted-foreground">Tipo de trabalho</dt><dd>Cartões Comerciais</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Papel</dt><dd>{papel ? `${papel.nome}` : esp.papelId}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Dimensão</dt><dd>{esp.larguraMm}×{esp.alturaMm} mm</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Sangria</dt><dd>{esp.sangriaMm} mm</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Impressão</dt><dd>{esp.frenteVerso ? 'Frente e Verso' : 'Só Frente'} · {esp.cor ? 'Cor' : 'P&B'}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Cartões/folha</dt><dd>{bd.cartoesPorFolha} ({pct(bd.aproveitamento)})</dd></div>
              </>
            )}
            <div className="flex justify-between"><dt className="text-muted-foreground">Quantidade</dt><dd>{orc.quantidade}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Data</dt><dd>{formatDate(orc.createdAt)}</dd></div>
            {orc.criadoPor && <div className="flex justify-between"><dt className="text-muted-foreground">Registado por</dt><dd>{orc.criadoPor}</dd></div>}
          </dl>
        </div>

        {/* Componentes de custo */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
          <h3 className="text-sm font-semibold mb-3">Componentes de Custo{multi ? ' — 1.º produto' : ''}</h3>
          <table className="w-full text-sm">
            <tbody>
              {(bd.componentes || []).map((c: any) => (
                <tr key={c.chave} className="border-b border-border/60">
                  <td className="py-1.5 text-muted-foreground">{c.label}</td>
                  <td className="py-1.5 text-right font-medium">{formatCurrency(c.valor)}</td>
                </tr>
              ))}
              <tr>
                <td className="py-2 font-medium">Custo total</td>
                <td className="py-2 text-right font-semibold">{formatCurrency(orc.custoTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Preço */}
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5">
          <h3 className="text-sm font-semibold mb-3">Preço{multi ? ' — total' : ''}</h3>
          <div className="space-y-1.5 text-sm mb-3">
            <div className="flex justify-between"><span className="text-muted-foreground">Margem</span><span>{pct(orc.margem)}</span></div>
            {bd.descontoCliente > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Desconto cliente</span><span>{pct(bd.descontoCliente)}</span></div>}
            {bd.sobretaxa24h > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Sobretaxa 24h</span><span>+{pct(bd.sobretaxa24h)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Preço unitário</span><span>{formatCurrency(orc.precoUnitario)}</span></div>
            {orc.arteFinalValor > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Arte-final{orc.arteFinalModo === 'criacao' ? ' (criação)' : orc.arteFinalModo === 'adaptacao' ? ' (adaptação)' : ''}</span><span>+{formatCurrency(orc.arteFinalValor)}</span></div>
            )}
            {orc.arteFinalModo === 'cliente' && (
              <div className="flex justify-between"><span className="text-muted-foreground">Arte-final</span><span className="text-xs">Ficheiro do cliente</span></div>
            )}
            {Array.isArray(orc.opcoesExtra) && orc.opcoesExtra.filter((o: any) => o?.incluida && Number(o?.valor) > 0).map((o: any, i: number) => (
              <div key={i} className="flex justify-between gap-3"><span className="text-muted-foreground truncate">{o.descricao || 'Opção'}</span><span>+{formatCurrency(Number(o.valor) || 0)}</span></div>
            ))}
            {orc.deslocacao && orc.deslocacao.incluir && Number(orc.deslocacao.valor) > 0 && (
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">Deslocação / montagem</span><span>+{formatCurrency(Number(orc.deslocacao.valor) || 0)}</span></div>
            )}
          </div>
          <div className="border-t border-border pt-3">
            <div className="text-xs text-muted-foreground">Total{comIva ? ' s/IVA' : ''}</div>
            <div className="text-2xl font-bold text-emerald-700">{formatCurrency(orc.precoSemIva)}</div>
            {comIva ? (
              <div className="text-xs text-muted-foreground">c/IVA: {formatCurrency(orc.precoComIva)}</div>
            ) : (
              <div className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">ONF — sem IVA (controlo interno)</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabela por quantidade */}
      <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mt-5">
        <h3 className="text-sm font-semibold mb-3">Tabela de Preços por Quantidade{multi ? ' — 1.º produto' : ''}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b border-border text-xs uppercase">
                <th className="text-left py-2 font-medium">Qtd</th>
                <th className="text-right py-2 font-medium">Folhas</th>
                <th className="text-right py-2 font-medium">{(isSticker || isVinil) ? 'Substrato' : 'Papel'}</th>
                <th className="text-right py-2 font-medium">{(isSticker || isVinil) ? 'Tinta' : 'Impressão'}</th>
                <th className="text-right py-2 font-medium">{(isSticker || isVinil) ? 'Máquina' : 'Pré-imp.'}</th>
                <th className="text-right py-2 font-medium">{(isSticker || isVinil) ? 'Corte' : 'Acabamentos'}</th>
                <th className="text-right py-2 font-medium">{comIva ? 's/IVA' : 'Total'}</th>
                {comIva && <th className="text-right py-2 font-medium">c/IVA</th>}
                <th className="text-right py-2 font-medium">Unit.</th>
              </tr>
            </thead>
            <tbody>
              {tabela.map((l: any) => (
                <tr key={l.quantidade} className={`border-b border-border/50 ${l.quantidade === orc.quantidade ? 'bg-emerald-50' : ''}`}>
                  <td className="py-2 font-medium">{l.quantidade}</td>
                  <td className="py-2 text-right">{l.folhas}</td>
                  <td className="py-2 text-right">{formatCurrency(l.custoPapel)}</td>
                  <td className="py-2 text-right">{formatCurrency(l.custoImpressao)}</td>
                  <td className="py-2 text-right">{formatCurrency(l.custoPreImp)}</td>
                  <td className="py-2 text-right">{formatCurrency(l.custoCorte + l.custoVinco + l.custoLaminacoes)}</td>
                  <td className="py-2 text-right font-semibold text-emerald-700">{formatCurrency(l.precoSemIva)}</td>
                  {comIva && <td className="py-2 text-right">{formatCurrency(l.precoComIva)}</td>}
                  <td className="py-2 text-right">{formatCurrency(l.precoUnitario)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {orc.arteFinalModo === 'cliente' && orc.arteFinalFicheiro && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mt-5">
          <h3 className="text-sm font-semibold mb-3">Arte-final — Ficheiro do cliente</h3>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <FileText className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="truncate">{orc.arteFinalNome || 'Ficheiro'}</span>
            </div>
            <button onClick={descarregarArteFicheiro} disabled={arteLoading} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60">
              {arteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descarregar
            </button>
          </div>
        </div>
      )}

      {/* Ficheiros finais / fotos do trabalho produzido */}
      <OrcamentoAnexos orcamentoId={id} />

      {(orc.prazoProducao || orc.entrega24h) && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mt-5">
          <h3 className="text-sm font-semibold mb-2">Prazo de produção</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {orc.prazoProducao ? orc.prazoProducao : 'Produção urgente 24H'}
          </p>
        </div>
      )}

      {orc.notas && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mt-5">
          <h3 className="text-sm font-semibold mb-2">Notas</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{orc.notas}</p>
        </div>
      )}

      {/* Histórico de envios */}
      {Array.isArray(orc.envios) && orc.envios.length > 0 && (
        <div className="bg-card rounded-2xl shadow-sm border border-border p-5 mt-5">
          <h3 className="text-sm font-semibold mb-3">Envios registados</h3>
          <ul className="space-y-2">
            {[...orc.envios].reverse().map((ev: any, i: number) => (
              <li key={i} className="flex items-start gap-3 text-sm p-3 rounded-xl border border-border/60 bg-background">
                <span className={`mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${ev.modo === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {ev.modo === 'whatsapp' ? <MessageCircle className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{ev.modo === 'whatsapp' ? 'WhatsApp' : 'Email'}</span>
                    <span className="text-muted-foreground truncate">{ev.destino}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(ev.quando).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', dateStyle: 'short', timeStyle: 'short' })}
                    {ev.por ? ` · por ${ev.por}` : ''}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Modal de envio (email / WhatsApp) */}
      {enviarOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-6" onClick={() => !enviando && setEnviarOpen(false)}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="text-sm font-semibold">Enviar orçamento</div>
              <button onClick={() => !enviando && setEnviarOpen(false)} className="p-2 rounded-lg border border-input bg-background hover:bg-muted" title="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEnviarModo('email')}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${enviarModo === 'email' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                >
                  <Mail className="h-4 w-4" /> Email
                </button>
                <button
                  type="button"
                  onClick={() => setEnviarModo('whatsapp')}
                  className={`inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${enviarModo === 'whatsapp' ? 'bg-green-600 text-white border-green-600' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </button>
              </div>

              {enviarModo === 'email' ? (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email do cliente</label>
                  <input
                    type="email"
                    value={enviarEmail}
                    onChange={(e) => setEnviarEmail(e.target.value)}
                    placeholder="cliente@exemplo.pt"
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Número de telefone</label>
                  <input
                    type="tel"
                    value={enviarTelefone}
                    onChange={(e) => setEnviarTelefone(e.target.value)}
                    placeholder="912 345 678"
                    className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Gera o PDF do orçamento (com o nome do orçamento) e abre o WhatsApp: envia o ficheiro em anexo se o dispositivo suportar, ou descarrega-o para anexar na conversa. Números nacionais com 9 dígitos assumem o indicativo +351.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Mensagem {enviarModo === 'email' ? '(opcional)' : ''}</label>
                <textarea
                  value={enviarMensagem}
                  onChange={(e) => setEnviarMensagem(e.target.value)}
                  rows={4}
                  placeholder={enviarModo === 'whatsapp' ? mensagemPadrao() : 'Mensagem a incluir no email…'}
                  className="w-full px-3 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <button onClick={() => !enviando && setEnviarOpen(false)} className="px-4 py-2.5 rounded-xl border border-input bg-background hover:bg-muted text-sm font-medium">Cancelar</button>
              {enviarModo === 'email' ? (
                <button onClick={enviarPorEmail} disabled={enviando} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60">
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Enviar email
                </button>
              ) : (
                <button onClick={enviarPorWhatsapp} disabled={enviando} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-60">
                  {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Abrir WhatsApp
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de pré-visualização do PDF */}
      {previewUrl && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-3 sm:p-6" onClick={fecharPreview}>
          <div className="bg-card rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{formatNumeroOrcamento(orc.tipoOrcamento, orc.numeroTipo, anoDe(orc.createdAt))}</div>
                <div className="text-xs text-muted-foreground truncate">{orc.clienteEmpresa || orc.clienteNome || 'Sem cliente associado'}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={descarregarDoPreview} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-sm font-medium">
                  <Download className="h-4 w-4" /> Descarregar
                </button>
                <button onClick={fecharPreview} className="p-2 rounded-lg border border-input bg-background hover:bg-muted" title="Fechar">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <iframe src={previewUrl} title="Pré-visualização do PDF" className="flex-1 w-full bg-muted" />
          </div>
        </div>
      )}
    </div>
  );
}
