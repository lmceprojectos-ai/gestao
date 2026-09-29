'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Pencil, Building2, Loader2, Users, ArrowRight, Trash2, Link2, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatSigned } from '@/lib/parceiros/format';
import type { Totals } from '@/lib/parceiros/calc';

type Ficha = { nif: string | null; morada: string | null; codigoPostal: string | null; localidade: string | null; pais: string | null; responsavel: string | null; telefone: string | null; emailFaturacao: string | null };
type Conta = Ficha & { id: string; link: string; convite: string | null; nome: string; emailAvisos: string | null; ativo: boolean; registos: number; utilizadores: number; totals: Totals };

const CAMPOS = [
  ['nif', 'NIF', 'text', '500000000'],
  ['morada', 'Morada', 'text', 'Rua, número, andar'],
  ['codigoPostal', 'Código postal', 'text', '2830-000'],
  ['localidade', 'Localidade', 'text', 'Barreiro'],
  ['pais', 'País', 'text', 'Portugal'],
  ['responsavel', 'Pessoa responsável', 'text', 'Nome'],
  ['telefone', 'Contacto (telefone)', 'tel', '912 345 678'],
  ['emailAvisos', 'Email de contacto', 'email', 'geral@empresa.pt'],
  ['emailFaturacao', 'Email para faturação', 'email', 'faturacao@empresa.pt'],
] as const;

const cls = (v: number) => (v > 0 ? 'val-pos' : v < 0 ? 'val-neg' : 'text-muted-foreground');

// Lista das contas correntes (uma por parceiro), só para a Criaconsensos.
export function ListaParceiros({ contas }: { contas: Conta[] }) {
  const router = useRouter();
  const [editar, setEditar] = useState<Partial<Conta> | null>(null);
  const [aGuardar, setAGuardar] = useState(false);

  const copiar = async (c: Conta) => {
    try { await navigator.clipboard.writeText(c.convite!); toast.success('Link copiado'); }
    catch { window.prompt('Copie o link:', c.convite!); }
  };
  const whatsapp = (c: Conta) => {
    const texto = `Olá! Este é o link de acesso à conta corrente entre a ${c.nome} e a Criaconsensos. Pode entrar, criar conta ou repor a palavra-passe aqui: ${c.convite}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
  };

  const eliminar = async (c: Conta) => {
    if (!confirm(`Eliminar o parceiro "${c.nome}" e os seus ${c.registos} registos?

Esta ação é permanente e não pode ser desfeita.`)) return;
    const r = await fetch(`/api/parceiros/contas?id=${c.id}`, { method: 'DELETE' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { toast.error(d?.message || 'Não foi possível eliminar'); return; }
    toast.success(`Parceiro eliminado (${d.registos} registos)`);
    router.refresh();
  };

  // Campos da ficha (além do nome).
  const campo = (k: (typeof CAMPOS)[number][0]) => {
    const [, label, tipo, ph] = CAMPOS.find(([x]) => x === k)!;
    return (
      <div className="space-y-1.5">
        <Label htmlFor={`p-${k}`}>{label}</Label>
        <Input id={`p-${k}`} type={tipo} value={((editar as any)?.[k] as string) ?? ''} placeholder={ph}
          onChange={(e) => setEditar((x) => ({ ...x, [k]: e.target.value }))} />
      </div>
    );
  };

  const guardar = async () => {
    if (!editar?.nome?.trim()) { toast.error('Indique o nome da empresa'); return; }
    setAGuardar(true);
    try {
      const r = await fetch('/api/parceiros/contas', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editar.id, nome: editar.nome, ativo: editar.ativo !== false,
          ...Object.fromEntries(CAMPOS.map(([k]) => [k, (editar as any)[k] ?? ''])),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || 'Erro ao guardar');
      toast.success(editar.id ? 'Parceiro atualizado' : 'Parceiro criado');
      setEditar(null);
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <main className="mx-auto max-w-[1200px] px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Parceiros</h1>
          <p className="text-muted-foreground mt-1">Uma conta corrente por parceiro — sempre na perspetiva da Criaconsensos. Cada parceiro só vê a sua.</p>
        </div>
        <Button onClick={() => setEditar({ ativo: true, pais: 'Portugal' })} className="gap-1.5 self-start sm:self-auto"><Plus className="h-4 w-4" /> Novo parceiro</Button>
      </div>

      {contas.length === 0 ? (
        <div className="rounded-xl bg-card shadow-sm p-8 text-center text-muted-foreground">Ainda não há parceiros. Crie o primeiro em "Novo parceiro".</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contas.map((c) => (
            <div key={c.id} className={`rounded-xl bg-card shadow-sm p-5 space-y-4 ${c.ativo ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-lg font-bold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />{c.nome}{!c.ativo && <span className="text-xs font-normal text-muted-foreground">(inativo)</span>}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    {c.registos} registos · <Users className="h-3 w-3" />{c.utilizadores} utilizador(es)
                  </p>
                  <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                    {c.nif && <p>NIF {c.nif}</p>}
                    {(c.responsavel || c.telefone) && <p>{[c.responsavel, c.telefone].filter(Boolean).join(' · ')}</p>}
                    {c.emailAvisos && <p>Contacto: {c.emailAvisos}</p>}
                    {c.emailFaturacao && <p>Faturação: {c.emailFaturacao}</p>}
                  </div>
                </div>
                <div className="flex gap-1">
                  {!c.ativo && <Button variant="ghost" size="icon" onClick={() => eliminar(c)} aria-label="Eliminar parceiro" title="Eliminar parceiro"><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                  <Button variant="ghost" size="icon" onClick={() => setEditar(c)} aria-label="Editar ficha do parceiro" title="Editar ficha"><Pencil className="h-4 w-4" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div><p className="text-xs text-muted-foreground">Faturado</p><p className={`font-mono font-semibold ${cls(c.totals.billed)}`}>{formatSigned(c.totals.billed)}</p></div>
                <div><p className="text-xs text-muted-foreground">Não faturado</p><p className={`font-mono font-semibold ${cls(c.totals.unbilled)}`}>{formatSigned(c.totals.unbilled)}</p></div>
                <div><p className="text-xs text-muted-foreground">Total</p><p className={`font-mono font-bold ${cls(c.totals.total)}`}>{formatSigned(c.totals.total)}</p></div>
              </div>
              <p className="text-xs text-muted-foreground">
                {c.totals.total > 0 ? `${c.nome} deve à Criaconsensos` : c.totals.total < 0 ? `A Criaconsensos deve a ${c.nome}` : 'Saldo liquidado'}
              </p>
              {c.convite && (
                <div className="rounded-lg bg-secondary/60 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">Link de acesso para enviar ao parceiro (entrar, criar conta ou repor a palavra-passe):</p>
                  <p className="text-xs font-mono break-all">{c.convite}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => copiar(c)}><Link2 className="h-4 w-4" /> Copiar link</Button>
                    <Button variant="outline" size="sm" className="gap-1.5 flex-1" onClick={() => whatsapp(c)}><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
                  </div>
                </div>
              )}
              <Button asChild className="w-full gap-1.5"><Link href={c.link}>Abrir conta corrente <ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">Para dar acesso a um parceiro, envie-lhe o link de acesso: ele cria a conta e só vê a conta corrente da sua empresa.</p>

      <Dialog open={!!editar} onOpenChange={(v) => { if (!v) setEditar(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editar?.id ? `Ficha — ${editar.nome ?? ''}` : 'Novo parceiro'}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <section className="space-y-3">
              <p className="text-sm font-semibold">Empresa</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="p-nome">Nome da empresa *</Label>
                  <Input id="p-nome" value={editar?.nome ?? ''} onChange={(e) => setEditar((x) => ({ ...x, nome: e.target.value }))} placeholder="Ex.: Reclamarte, Lda." />
                </div>
                {campo('nif')}
              </div>
            </section>
            <section className="space-y-3">
              <p className="text-sm font-semibold">Dados fiscais</p>
              {campo('morada')}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{campo('codigoPostal')}{campo('localidade')}{campo('pais')}</div>
            </section>
            <section className="space-y-3">
              <p className="text-sm font-semibold">Contactos</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{campo('responsavel')}{campo('telefone')}{campo('emailAvisos')}{campo('emailFaturacao')}</div>
              <p className="text-xs text-muted-foreground">O email de contacto recebe os avisos das alterações na conta corrente (a Criaconsensos recebe sempre).</p>
            </section>
            {editar?.id ? (
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-4 py-3">
                <Label htmlFor="p-ativo">Parceiro ativo</Label>
                <Switch id="p-ativo" checked={editar?.ativo !== false} onCheckedChange={(v) => setEditar((x) => ({ ...x, ativo: v }))} />
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditar(null)} disabled={aGuardar}>Cancelar</Button>
            <Button onClick={guardar} disabled={aGuardar} className="gap-1.5">{aGuardar ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
