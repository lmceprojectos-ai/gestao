'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Handshake, X, ChevronDown, ChevronUp, RotateCcw, Trash2, Edit2, Search, Camera, Loader2, Eye, Download, Printer, CheckCircle2 } from 'lucide-react';
import { FilePreviewFrame } from '@/components/file-preview-frame';
import { PageHeader } from '@/components/page-header';
import { formatCurrency, formatDate, formatDateInput } from '@/lib/format';
import { EmptyState } from '@/components/empty-state';
import { toast } from 'sonner';
import { compressImage } from '@/lib/compress-image';
import { ImageCropModal } from '@/components/image-crop-modal';

function EstadoEmprestimo({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ativo: { label: 'Ativo', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    parcial: { label: 'Parcial', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    devolvido: { label: 'Devolvido', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  };
  const s = map[estado] || map.ativo;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>;
}

export default function EmprestimosPage() {
  const [emprestimos, setEmprestimos] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showDevModal, setShowDevModal] = useState<string | null>(null);
  const [form, setForm] = useState({ socioNome: '', descricao: '', valor: '', dataEmprestimo: '', contaBancariaId: '', notas: '' });
  const [devForm, setDevForm] = useState({ valor: '', dataDevolucao: '', descricao: '', contaBancariaId: '' });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropImage, setCropImage] = useState<{ src: string; callback: (blob: Blob) => void } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');

  const load = async () => {
    try {
      const [e, c] = await Promise.all([
        fetch('/api/emprestimos').then(r => r.json()),
        fetch('/api/contas').then(r => r.json()),
      ]);
      setEmprestimos(Array.isArray(e) ? e : []);
      setContas(Array.isArray(c) ? c : []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => setForm({ socioNome: '', descricao: '', valor: '', dataEmprestimo: '', contaBancariaId: '', notas: '' });

  const openNew = () => { resetForm(); setEditing(null); setSelectedFile(null); setShowModal(true); };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]; if (!rawFile) return;
    const file = await compressImage(rawFile);
    if (file.type.startsWith('image/')) {
      const src = URL.createObjectURL(file);
      setCropImage({ src, callback: (blob: Blob) => { const c = new File([blob], file.name, { type: 'image/jpeg' }); setCropImage(null); URL.revokeObjectURL(src); setSelectedFile(c); } });
    } else { setSelectedFile(file); }
    e.target.value = '';
  };

  const openPreview = async (id: string) => {
    try {
      const r = await fetch(`/api/emprestimos/${id}`); const d = await r.json();
      if (d.url) { setPreviewUrl(d.url); setPreviewType(d.contentType || 'image/jpeg'); }
      else toast.error('Sem comprovativo');
    } catch { toast.error('Erro ao abrir comprovativo'); }
  };
  const openEdit = (e: any) => {
    setForm({
      socioNome: e.socioNome || '',
      descricao: e.descricao || '',
      valor: String(e.valor || ''),
      dataEmprestimo: formatDateInput(e.dataEmprestimo) || '',
      contaBancariaId: e.contaBancariaId || '',
      notas: e.notas || '',
    });
    setEditing(e);
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.socioNome || !form.valor || !form.dataEmprestimo) { toast.error('Preencha os campos obrigatórios'); return; }
    setSaving(true);
    try {
      let cloudStoragePath = editing?.cloudStoragePath || null;
      let contentType = editing?.contentType || null;
      let nomeOriginal = editing?.nomeOriginal || null;

      if (selectedFile) {
        const presRes = await fetch('/api/upload/presigned', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: selectedFile.name, contentType: selectedFile.type, isPublic: false }) });
        const pres = await presRes.json();
        await fetch(pres.uploadUrl, { method: 'PUT', headers: { 'Content-Type': selectedFile.type, 'Content-Disposition': 'attachment' }, body: selectedFile });
        cloudStoragePath = pres.cloud_storage_path;
        contentType = selectedFile.type;
        nomeOriginal = selectedFile.name;
      }

      const url = editing ? `/api/emprestimos/${editing.id}` : '/api/emprestimos';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cloudStoragePath, contentType, nomeOriginal }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Erro'); }
      toast.success(editing ? 'Empréstimo atualizado!' : 'Empréstimo registado!');
      setShowModal(false); resetForm(); setEditing(null); setSelectedFile(null); load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja eliminar este empréstimo e todas as devoluções associadas?')) return;
    try {
      const res = await fetch(`/api/emprestimos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro ao eliminar');
      toast.success('Empréstimo eliminado!'); load();
    } catch { toast.error('Erro ao eliminar'); }
  };

  const handleDevolucao = async () => {
    if (!showDevModal || !devForm.valor || !devForm.dataDevolucao) { toast.error('Preencha valor e data'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/emprestimos/${showDevModal}/devolucoes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(devForm),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Erro'); }
      toast.success('Devolução registada!');
      setShowDevModal(null); setDevForm({ valor: '', dataDevolucao: '', descricao: '', contaBancariaId: '' }); load();
    } catch (err: any) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDeleteDev = async (emprestimoId: string, devolucaoId: string) => {
    if (!confirm('Eliminar esta devolução?')) return;
    try {
      const res = await fetch(`/api/emprestimos/${emprestimoId}/devolucoes?devolucaoId=${devolucaoId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Erro');
      toast.success('Devolução eliminada!'); load();
    } catch { toast.error('Erro ao eliminar devolução'); }
  };

  const totalEmprestado = emprestimos.reduce((s, e) => s + (e.valor || 0), 0);
  const totalDevolvido = emprestimos.reduce((s, e) => s + (e.totalDevolvido || 0), 0);
  const totalPendente = totalEmprestado - totalDevolvido;

  if (loading) return <div className="h-64 bg-muted rounded-xl animate-pulse" />;

  return (
    <div>
      <PageHeader title="Empréstimos de Sócio" description="Registe empréstimos de sócios e as respetivas devoluções" icon={Handshake}
        action={<button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"><Plus className="h-4 w-4" />Novo Empréstimo</button>}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Emprestado</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalEmprestado)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Total Devolvido</p>
          <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalDevolvido)}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card rounded-xl p-4 shadow-sm">
          <p className="text-xs text-muted-foreground mb-1">Saldo Pendente</p>
          <p className={`text-xl font-bold ${totalPendente > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{formatCurrency(totalPendente)}</p>
        </motion.div>
      </div>

      <div className="relative max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><input value={search} onChange={ev => setSearch(ev.target.value)} placeholder="Pesquisar por sócio, descrição, valor..." className="w-full pl-10 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary outline-none" /></div>

      {(() => { const filtered = emprestimos.filter(e => { if (!search) return true; const s = search.toLowerCase(); return e.socioNome?.toLowerCase().includes(s) || e.descricao?.toLowerCase().includes(s) || String(e.valor)?.includes(s); }); return filtered.length === 0 ? (
        <EmptyState icon={Handshake} title="Sem empréstimos" description={search ? 'Nenhum resultado encontrado.' : 'Ainda não existem empréstimos de sócio registados.'} />
      ) : (
        <div className="space-y-3">
          {filtered.map((e) => {
            const isExpanded = expandedId === e.id;
            return (
              <motion.div key={e.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setExpandedId(isExpanded ? null : e.id)}>
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <Handshake className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{e.socioNome}</p>
                        <EstadoEmprestimo estado={e.estado} />
                      </div>
                      <p className="text-xs text-muted-foreground">{formatDate(e.dataEmprestimo)}{e.descricao ? ` • ${e.descricao}` : ''}</p>
                      {e.criadoPor && <p className="text-[11px] text-muted-foreground/70">Registado por {e.criadoPor}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="font-mono font-bold text-sm text-blue-700">{formatCurrency(e.valor)}</p>
                      {e.saldoPendente > 0.01 && <p className="text-xs text-amber-600">{formatCurrency(e.saldoPendente)} pendente</p>}
                      {e.saldoPendente <= 0.01 && <p className="text-xs text-emerald-600">Devolvido</p>}
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 border-t">
                        {/* Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 text-xs">
                          <div><span className="text-muted-foreground">Valor:</span> <span className="font-medium">{formatCurrency(e.valor)}</span></div>
                          <div><span className="text-muted-foreground">Devolvido:</span> <span className="font-medium text-emerald-600">{formatCurrency(e.totalDevolvido)}</span></div>
                          <div><span className="text-muted-foreground">Pendente:</span> <span className="font-medium text-amber-600">{formatCurrency(e.saldoPendente)}</span></div>
                          {e.notas && <div className="col-span-2"><span className="text-muted-foreground">Notas:</span> <span className="font-medium">{e.notas}</span></div>}
                        </div>

                        {/* Devoluções */}
                        <div className="mb-3">
                          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Devoluções ({e.devolucoes?.length || 0})</h4>
                          {(e.devolucoes?.length || 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">Sem devoluções registadas</p>
                          ) : (
                            <div className="space-y-1.5">
                              {e.devolucoes.map((d: any) => (
                                <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                                  <div>
                                    <span className="font-medium text-emerald-700">{formatCurrency(d.valor)}</span>
                                    <span className="text-muted-foreground ml-2">{formatDate(d.dataDevolucao)}</span>
                                    {d.descricao && <span className="text-muted-foreground ml-2">• {d.descricao}</span>}
                                    {d.criadoPor && <span className="block text-[11px] text-muted-foreground/70 mt-0.5">Registado por {d.criadoPor}</span>}
                                  </div>
                                  <button onClick={(ev) => { ev.stopPropagation(); handleDeleteDev(e.id, d.id); }} className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors"><Trash2 className="h-3 w-3" /></button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                          {e.cloudStoragePath && (
                            <button onClick={(ev) => { ev.stopPropagation(); openPreview(e.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                              <Eye className="h-3 w-3" />Ver Comprovativo
                            </button>
                          )}
                          {e.saldoPendente > 0.01 && (
                            <button onClick={(ev) => { ev.stopPropagation(); setDevForm({ valor: '', dataDevolucao: formatDateInput(new Date()) || '', descricao: '', contaBancariaId: '' }); setShowDevModal(e.id); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
                              <RotateCcw className="h-3 w-3" />Registar Devolução
                            </button>
                          )}
                          <button onClick={(ev) => { ev.stopPropagation(); openEdit(e); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                            <Edit2 className="h-3 w-3" />Editar
                          </button>
                          <button onClick={(ev) => { ev.stopPropagation(); handleDelete(e.id); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">
                            <Trash2 className="h-3 w-3" />Eliminar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ); })()}

      {/* Modal Novo/Editar Empréstimo */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">{editing ? 'Editar Empréstimo' : 'Novo Empréstimo de Sócio'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                {/* Comprovativo Upload */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Comprovativo</label>
                  <div className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg p-3 text-center cursor-pointer hover:border-green-500/50 transition-colors mt-1" onClick={() => fileRef.current?.click()}>
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-2 text-green-600"><CheckCircle2 className="h-5 w-5" /><span className="text-sm">{selectedFile.name}</span></div>
                    ) : editing?.cloudStoragePath ? (
                      <span className="text-sm text-green-600">✓ Comprovativo já anexado (clique para substituir)</span>
                    ) : (
                      <div className="flex flex-col items-center gap-1"><Camera className="h-6 w-6 text-green-500/60" /><span className="text-sm text-muted-foreground">Tirar foto ao comprovativo</span></div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*,.pdf" capture="environment" className="hidden" onChange={handleFileSelect} />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nome do Sócio *</label>
                  <input value={form.socioNome} onChange={(e) => setForm(f => ({ ...f, socioNome: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" placeholder="Nome do sócio" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Valor *</label>
                    <input type="number" step="0.01" value={form.valor} onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Data *</label>
                    <input type="date" value={form.dataEmprestimo} onChange={(e) => setForm(f => ({ ...f, dataEmprestimo: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                  <input value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" placeholder="Descrição opcional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Conta Bancária</label>
                  <select value={form.contaBancariaId} onChange={(e) => setForm(f => ({ ...f, contaBancariaId: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background">
                    <option value="">Selecionar...</option>
                    {contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome} - {c.banco}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Notas</label>
                  <textarea value={form.notas} onChange={(e) => setForm(f => ({ ...f, notas: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" rows={2} placeholder="Notas adicionais" />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {saving ? 'A guardar...' : editing ? 'Guardar' : 'Registar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Devolução */}
      <AnimatePresence>
        {showDevModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDevModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Registar Devolução</h2>
                <button onClick={() => setShowDevModal(null)} className="p-1 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
              </div>
              {(() => {
                const emp = emprestimos.find(e => e.id === showDevModal);
                return emp ? (
                  <div className="mb-3 p-3 bg-muted/30 rounded-lg text-xs">
                    <p><span className="text-muted-foreground">Empréstimo:</span> <span className="font-medium">{emp.socioNome}</span> • {formatCurrency(emp.valor)}</p>
                    <p><span className="text-muted-foreground">Pendente:</span> <span className="font-medium text-amber-600">{formatCurrency(emp.saldoPendente)}</span></p>
                  </div>
                ) : null;
              })()}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Valor *</label>
                    <input type="number" step="0.01" value={devForm.valor} onChange={(e) => setDevForm(f => ({ ...f, valor: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Data *</label>
                    <input type="date" value={devForm.dataDevolucao} onChange={(e) => setDevForm(f => ({ ...f, dataDevolucao: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                  <input value={devForm.descricao} onChange={(e) => setDevForm(f => ({ ...f, descricao: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background" placeholder="Descrição opcional" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Conta Bancária</label>
                  <select value={devForm.contaBancariaId} onChange={(e) => setDevForm(f => ({ ...f, contaBancariaId: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm bg-background">
                    <option value="">Selecionar...</option>
                    {contas.map((c: any) => <option key={c.id} value={c.id}>{c.nome} - {c.banco}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowDevModal(null)} className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={handleDevolucao} disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50">
                  {saving ? 'A guardar...' : 'Registar Devolução'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => { setPreviewUrl(null); setPreviewType(''); }}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-card rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="font-semibold">Comprovativo</h3>
                <div className="flex items-center gap-2">
                  <a href={previewUrl} download className="p-2 rounded-lg hover:bg-muted" title="Descarregar"><Download className="h-4 w-4" /></a>
                  <button onClick={() => { const w = window.open(previewUrl, '_blank'); if (w) { w.onload = () => w.print(); } }} className="p-2 rounded-lg hover:bg-muted" title="Imprimir"><Printer className="h-4 w-4" /></button>
                  <button onClick={() => { setPreviewUrl(null); setPreviewType(''); }} className="p-2 rounded-lg hover:bg-muted"><X className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="p-4 flex-1 overflow-auto flex items-center justify-center">
                {previewType.startsWith('image/') ? (
                  <img src={previewUrl} alt="Comprovativo" className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                ) : (
                  <FilePreviewFrame url={previewUrl} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {cropImage && <ImageCropModal imageSrc={cropImage.src} onConfirm={cropImage.callback} onCancel={() => { URL.revokeObjectURL(cropImage.src); setCropImage(null); }} />}
    </div>
  );
}
