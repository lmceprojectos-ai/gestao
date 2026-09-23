"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock, CalendarX2, Users, Wifi, BarChart3, Loader2, CheckCircle2, XCircle,
  Trash2, Plus, FileSpreadsheet, FileText, Eye, Pencil, ShieldCheck, User as UserIcon,
  CalendarDays, List, ChevronLeft, ChevronRight, Palmtree, KeyRound, Copy, RefreshCw,
  Receipt, Upload, Save, Wallet, CalendarCheck, Mail, Send, Download, ArrowLeft, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { formatDateTime, formatDateStr, formatTime, currentMonth, todayStr } from "@/lib/ponto/format";
import { PUNCH_LABELS, ABSENCE_LABELS, formatMinutes } from "@/lib/ponto/schedule";
import { nonWorkingInfoForMonth, bridgeHolidayName, holidayName } from "@/lib/ponto/holidays";
import { downloadCSV, printReport } from "@/lib/ponto/export-utils";
import { eur, monthLabel } from "@/lib/ponto/payslip";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ResponsiveContainer } from "recharts";
import { IdCard } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { hasGestaoAccess } from "@/lib/ponto/roles";
import { ThemeToggle } from "@/components/ponto/theme-toggle";
import { AccountBox } from "@/components/ponto/account-box";
import { FichasAdmin } from "./fichas-admin";

type UserT = { id: string; name: string; email: string; role: string; active: boolean; sendToAccounting?: boolean; partTime?: boolean };
type PunchT = { id: string; type: string; timestamp: string; workDate: string; ipAddress?: string | null; device?: string | null; lateMinutes: number; extraMinutes: number; note?: string | null; delayReason?: string | null; user: { name: string; email: string } };
type AbsenceT = { id: string; absenceDate: string; status: string; reason?: string | null; observation?: string | null; attachmentName?: string | null; decisionNote?: string | null; user: { name: string; email: string } };
type ReportRow = { userId: string; name: string; email: string; role: string; daysWorked: number; workedMinutes: number; lateMinutes: number; extraMinutes: number; absencesTotal: number; absencesJustified: number; absencesUnjustified: number; absencesPending: number };
type IpT = { id: string; address: string; label?: string | null };
type VacationT = { id: string; startDate: string; endDate: string; days: number; status: string; reason?: string | null; decisionNote?: string | null; user: { name: string; email: string } };
type TaskMissT = { id: string; userId: string; missDate: string; note?: string | null; user?: { name: string; email: string } };

const VAC_LABELS: Record<string, string> = { PENDENTE: "Pendente", APROVADA: "Aprovado", REJEITADA: "Rejeitado" };
function vacBadge(status: string) {
  const map: Record<string, string> = {
    PENDENTE: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    APROVADA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    REJEITADA: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  };
  return map[status] ?? "bg-secondary text-secondary-foreground";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    POR_JUSTIFICAR: "bg-amber-100 text-amber-800", EM_ANALISE: "bg-sky-100 text-sky-800",
    JUSTIFICADA: "bg-emerald-100 text-emerald-800", INJUSTIFICADA: "bg-rose-100 text-rose-800",
  };
  return map[status] ?? "bg-secondary";
}

// Deteta se um registo de ausência corresponde a um período de férias.
function isFeriasAbsence(a: { reason?: string | null; observation?: string | null }): boolean {
  const s = `${a?.reason ?? ""} ${a?.observation ?? ""}`.toLowerCase();
  return s.includes("féri") || s.includes("feri");
}
// Rótulo a mostrar: "Férias" quando for férias, senão o rótulo normal da falta.
function absenceLabel(a: { status: string; reason?: string | null; observation?: string | null }): string {
  return isFeriasAbsence(a) ? "Férias" : (ABSENCE_LABELS[a.status] ?? a.status);
}
// Estilo do crachá: azul (sky) para férias, senão o estilo normal do estado.
function absenceBadge(a: { status: string; reason?: string | null; observation?: string | null }): string {
  return isFeriasAbsence(a)
    ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
    : statusBadge(a.status);
}

export function AdminClient({ name = "Administrador", email }: { name?: string; email?: string }) {
  const router = useRouter();
  const { data: session } = useSession() || {};
  const canManage = hasGestaoAccess((session?.user as any)?.role);
  // Alterna para a vista de colaborador ("Ver como utilizador").
  function verComoUtilizador() {
    document.cookie = "ponto_view_mode=user; path=/; max-age=31536000; samesite=lax";
    router.push("/ponto/colaborador");
    router.refresh();
  }
  const [users, setUsers] = useState<UserT[]>([]);
  const [punches, setPunches] = useState<PunchT[]>([]);
  const [absences, setAbsences] = useState<AbsenceT[]>([]);
  const [report, setReport] = useState<ReportRow[]>([]);
  const [ips, setIps] = useState<IpT[]>([]);
  const [vacations, setVacations] = useState<VacationT[]>([]);
  const [taskMisses, setTaskMisses] = useState<TaskMissT[]>([]);
  const [month, setMonth] = useState(currentMonth());
  const [punchUser, setPunchUser] = useState("ALL");
  const [punchView, setPunchView] = useState<"lista" | "calendario">("calendario");
  const [punchMonth, setPunchMonth] = useState(currentMonth());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [u, p, a, i, v, t] = await Promise.all([
        fetch("/api/ponto/admin/users").then((r) => r.json()),
        fetch("/api/ponto/admin/punches").then((r) => r.json()),
        fetch("/api/ponto/admin/absences").then((r) => r.json()),
        fetch("/api/ponto/admin/ips").then((r) => r.json()),
        fetch("/api/ponto/admin/vacations").then((r) => r.json()),
        fetch("/api/ponto/admin/task-misses").then((r) => r.json()),
      ]);
      setUsers(u?.users ?? []); setPunches(p?.punches ?? []);
      setAbsences(a?.absences ?? []); setIps(i?.ips ?? []);
      setVacations(v?.vacations ?? []);
      setTaskMisses(t?.taskMisses ?? []);
    } catch { toast.error("Erro ao carregar dados."); }
    finally { setLoading(false); }
  }, []);

  const loadReport = useCallback(async (m: string) => {
    try {
      const r = await fetch(`/api/ponto/admin/reports?month=${m}`).then((res) => res.json());
      setReport(r?.report ?? []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadReport(month); }, [month, loadReport]);

  async function decideVacation(id: string, status: string) {
    const note = status === "REJEITADA"
      ? (window.prompt("Motivo da rejeição (opcional):", "") ?? "")
      : (window.prompt("Nota para o colaborador (opcional):", "") ?? "");
    try {
      const res = await fetch(`/api/ponto/admin/vacations/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, decisionNote: note }),
      });
      if (res.ok) { toast.success("Pedido atualizado. Colaborador notificado."); load(); }
      else toast.error("Erro ao atualizar o pedido.");
    } catch { toast.error("Erro ao atualizar o pedido."); }
  }

  async function deleteVacation(id: string) {
    if (!window.confirm("Remover este pedido de férias?")) return;
    try {
      const res = await fetch(`/api/ponto/admin/vacations/${id}`, { method: "DELETE" });
      if (res.ok) { toast.success("Pedido removido."); load(); }
      else toast.error("Erro ao remover.");
    } catch { toast.error("Erro ao remover."); }
  }

  async function viewAttachment(id: string) {
    try {
      const res = await fetch(`/api/ponto/file?absenceId=${id}`);
      const data = await res.json();
      if (res.ok && data?.url) window.open(data.url, "_blank");
      else toast.error("Comprovativo indisponível.");
    } catch { toast.error("Erro ao abrir comprovativo."); }
  }

  // Admin aceita (justifica) ou recusa (injustifica) uma falta, notificando o colaborador.
  async function decideAbsence(id: string, status: "JUSTIFICADA" | "INJUSTIFICADA") {
    const note = status === "INJUSTIFICADA"
      ? (window.prompt("Motivo da recusa (opcional):", "") ?? "")
      : (window.prompt("Observação para o colaborador (opcional):", "") ?? "");
    try {
      const res = await fetch(`/api/ponto/admin/absences/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, decisionNote: note }),
      });
      if (res.ok) {
        toast.success(status === "JUSTIFICADA" ? "Falta aceite e justificada. Colaborador notificado." : "Falta recusada. Colaborador notificado.");
        load();
      } else toast.error("Erro ao atualizar a falta.");
    } catch { toast.error("Erro ao atualizar a falta."); }
  }

  async function deletePunch(id: string) {
    if (!window.confirm("Remover esta marcação?")) return;
    const res = await fetch(`/api/ponto/admin/punches/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Marcação removida."); load(); } else toast.error("Erro.");
  }

  async function deleteUser(id: string) {
    if (!window.confirm("Remover este colaborador? Os seus registos serão eliminados.")) return;
    const res = await fetch(`/api/ponto/admin/users/${id}`, { method: "DELETE" });
    const d = await res.json();
    if (res.ok) { toast.success("Colaborador removido."); load(); } else toast.error(d?.message ?? "Erro.");
  }

  async function deleteIp(id: string) {
    if (!window.confirm("Remover este IP autorizado?")) return;
    const res = await fetch(`/api/ponto/admin/ips/${id}`, { method: "DELETE" });
    if (res.ok) { toast.success("IP removido."); load(); } else toast.error("Erro.");
  }

  function monthLabel(ym: string) {
    const [yy, mm] = ym.split("-").map(Number);
    return `${MONTHS_PT[mm - 1]} ${yy}`;
  }
  function exportPunchesCSV() {
    const base = punchUser === "ALL" ? colabPunches : punches.filter((p) => p.user?.email === punchUser);
    const list = base.filter((p) => typeof p.workDate === "string" && p.workDate.startsWith(punchMonth));
    const rows: (string | number)[][] = [["Colaborador", "Email", "Tipo", "Data/Hora", "IP", "Dispositivo", "Atraso", "Horas extra", "Nota"]];
    list.forEach((p) => rows.push([p.user?.name ?? "", p.user?.email ?? "", PUNCH_LABELS[p.type], formatDateTime(p.timestamp), p.ipAddress ?? "", p.device ?? "", formatMinutes(p.lateMinutes), formatMinutes(p.extraMinutes), p.note ?? ""]));
    downloadCSV(`marcacoes_ponto_${punchMonth}.csv`, rows);
  }
  function exportPunchesPDF() {
    const base = punchUser === "ALL" ? colabPunches : punches.filter((p) => p.user?.email === punchUser);
    const list = base.filter((p) => typeof p.workDate === "string" && p.workDate.startsWith(punchMonth));
    const who = punchUser === "ALL" ? "Todos os colaboradores" : (base[0]?.user?.name ?? users.find((u) => u.email === punchUser)?.name ?? punchUser);
    const ml = monthLabel(punchMonth);
    const body = `<h1>Registo de Ponto — ${ml}</h1><p style="color:#1f2937;font-size:14px;font-weight:600;margin:0 0 2px;">${who}</p><p style="color:#64748b;font-size:12px;">Documento confidencial · Criaconsensos Unipessoal Lda · ${ml} · ${list.length} marcações</p><table><tr><th>Colaborador</th><th>Tipo</th><th>Data/Hora</th><th>IP</th><th>Dispositivo</th><th>Atraso</th><th>Extra</th></tr>${list.map((p) => `<tr><td>${p.user?.name ?? ""}</td><td>${PUNCH_LABELS[p.type]}</td><td>${formatDateTime(p.timestamp)}</td><td>${p.ipAddress ?? ""}</td><td>${p.device ?? ""}</td><td>${p.lateMinutes > 0 ? formatMinutes(p.lateMinutes) : "—"}</td><td>${p.extraMinutes > 0 ? formatMinutes(p.extraMinutes) : "—"}</td></tr>`).join("")}</table>`;
    printReport(`Registo_Ponto_${punchMonth}`, body);
  }

  function exportReportCSV() {
    const rows: (string | number)[][] = [["Nome", "Email", "Dias trabalhados", "Horas trabalhadas", "Atrasos", "Horas extra", "Faltas total", "Justificadas", "Injustificadas", "Pendentes"]];
    report.forEach((r) => rows.push([r.name, r.email, r.daysWorked, formatMinutes(r.workedMinutes), formatMinutes(r.lateMinutes), formatMinutes(r.extraMinutes), r.absencesTotal, r.absencesJustified, r.absencesUnjustified, r.absencesPending]));
    downloadCSV(`relatorio_${month}.csv`, rows);
  }
  function exportReportPDF() {
    const body = `<h1>Relatório de Assiduidade — ${month}</h1><table><tr><th>Nome</th><th>Dias</th><th>Horas trab.</th><th>Atrasos</th><th>Extra</th><th>Faltas</th><th>Justif.</th><th>Injust.</th></tr>${report.map((r) => `<tr><td>${r.name}</td><td>${r.daysWorked}</td><td>${formatMinutes(r.workedMinutes)}</td><td>${formatMinutes(r.lateMinutes)}</td><td>${formatMinutes(r.extraMinutes)}</td><td>${r.absencesTotal}</td><td>${r.absencesJustified}</td><td>${r.absencesUnjustified}</td></tr>`).join("")}</table>`;
    printReport(`Relatorio_${month}`, body);
  }

  if (loading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const pendingAbs = absences.filter((a) => a.status === "EM_ANALISE" || a.status === "POR_JUSTIFICAR").length;
  const colaboradores = users.filter((u) => u.role === "COLABORADOR");
  // Emails apenas de colaboradores (exclui admin e ecrã de presença/QR).
  const colabEmails = new Set(colaboradores.map((u) => u.email));
  // Marcações/faltas só de colaboradores (para a vista "Todos os colaboradores").
  const colabPunches = punches.filter((p) => p.user?.email && colabEmails.has(p.user.email));
  const colabAbsences = absences.filter((a) => a.user?.email && colabEmails.has(a.user.email));

  return (
    <Tabs defaultValue="faltas" orientation="vertical" className="min-h-screen">
      <div className="lg:flex lg:min-h-screen">
        {/* MENU LATERAL */}
        <aside className="flex flex-col bg-primary text-slate-900 lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:z-40">
          <div className="flex items-center gap-3 px-5 h-16 border-b border-black/10 shrink-0">
            <div className="relative h-9 w-9 rounded-lg bg-white overflow-hidden shrink-0 ring-1 ring-black/10">
              <Image src="/logo-icon.png" alt="Criaconsensos" fill className="object-contain p-0.5" sizes="36px" />
            </div>
            <div className="leading-tight min-w-0">
              <p className="font-display font-bold text-black truncate">Criaconsensos</p>
              <p className="text-[11px] text-black/70 truncate">Controlo de Ponto</p>
            </div>
          </div>
          <nav className="flex-1 lg:overflow-y-auto px-3 py-4 space-y-5">
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-black/70">Assiduidade</p>
              <TabsList className="flex flex-col h-auto items-stretch bg-transparent p-0 gap-1">
                <SideTab value="faltas" icon={CalendarX2} label="Faltas" />
                <SideTab value="marcacoes" icon={Clock} label="Controlo de Ponto Mensal" />
                <SideTab value="relatorios" icon={BarChart3} label="Relatórios" />
                <SideTab value="ferias" icon={Palmtree} label="Férias" />
              </TabsList>
            </div>
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-black/70">Equipa</p>
              <TabsList className="flex flex-col h-auto items-stretch bg-transparent p-0 gap-1">
                <SideTab value="fichas" icon={IdCard} label="Fichas de colaborador" />
              </TabsList>
            </div>
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-black/70">Documentos</p>
              <TabsList className="flex flex-col h-auto items-stretch bg-transparent p-0 gap-1">
                <SideTab value="recibos" icon={Receipt} label="Registo de assiduidades" />
              </TabsList>
            </div>
            <div>
              <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-black/70">Sistema</p>
              <TabsList className="flex flex-col h-auto items-stretch bg-transparent p-0 gap-1">
                <SideTab value="ips" icon={Wifi} label="Rede / IPs" />
              </TabsList>
            </div>
          </nav>
          <div className="border-t border-black/10 p-3 shrink-0">
            <AccountBox name={name} email={email} />
          </div>
        </aside>

        {/* CONTEÚDO */}
        <div className="flex-1 min-w-0 lg:ml-64">
          <div className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 sm:px-6 bg-background/80 backdrop-blur-md border-b border-border">
            <p className="lg:hidden font-display font-bold">Administração</p>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm font-medium">{name}</span>
                <span className="text-xs text-secondary-foreground/80">· Administrador</span>
              </div>
              <Button variant="outline" size="sm" title="Ver como utilizador" onClick={verComoUtilizador}>
                <UserIcon className="h-4 w-4" />
                <span className="sm:hidden">Utilizador</span>
                <span className="hidden sm:inline">Ver como utilizador</span>
              </Button>
              {canManage && (
                <Button variant="outline" size="sm" title="Voltar à Gestão" onClick={() => router.push("/")}>
                  <ArrowLeft className="h-4 w-4" />
                  <span className="sm:hidden">Gestão</span>
                  <span className="hidden sm:inline">Voltar à Gestão</span>
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
          <main className="px-3 sm:px-6 py-6 sm:py-8 max-w-[1200px]">
            <div className="mb-6">
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Área de Administração</h1>
              <p className="text-muted-foreground">Gira marcações, faltas, colaboradores e relatórios de assiduidade.</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { icon: Users, label: "Colaboradores", value: colaboradores.length, c: "text-sky-600 bg-sky-100" },
                { icon: Clock, label: "Marcações", value: punches.length, c: "text-emerald-600 bg-emerald-100" },
                { icon: CalendarX2, label: "Faltas pendentes", value: pendingAbs, c: "text-amber-600 bg-amber-100" },
                { icon: Wifi, label: "IPs autorizados", value: ips.length, c: "text-violet-600 bg-violet-100" },
              ].map((s, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card rounded-2xl p-5 flex items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${s.c} dark:bg-opacity-20`}><s.icon className="h-5 w-5" /></div>
                  <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="font-bold text-2xl">{s.value}</p></div>
                </motion.div>
              ))}
            </div>

            <div className="min-w-0">

        {/* FALTAS */}
        <TabsContent value="faltas">
          <div className="space-y-3">
            {absences.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 text-center text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>Sem faltas registadas.</div>
            ) : absences.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-2xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{a.user?.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateStr(a.absenceDate)}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${absenceBadge(a)}`}>{absenceLabel(a)}</span>
                    </div>
                    <p className="text-sm mt-1">{a.reason ?? "—"}{a.observation ? ` · ${a.observation}` : ""}</p>
                    {a.decisionNote && <p className="text-xs text-muted-foreground mt-1">Nota da administração: {a.decisionNote}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.attachmentName && <Button size="sm" variant="outline" onClick={() => viewAttachment(a.id)}><Eye className="h-4 w-4" />Comprovativo</Button>}
                    {!isFeriasAbsence(a) && a.status !== "JUSTIFICADA" && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => decideAbsence(a.id, "JUSTIFICADA")}><CheckCircle2 className="h-4 w-4" />Aceitar</Button>}
                    {!isFeriasAbsence(a) && a.status !== "INJUSTIFICADA" && <Button size="sm" variant="destructive" onClick={() => decideAbsence(a.id, "INJUSTIFICADA")}><XCircle className="h-4 w-4" />Recusar</Button>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* FÉRIAS */}
        <TabsContent value="ferias">
          <div className="space-y-3">
            {vacations.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 text-center text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>Sem pedidos de férias.</div>
            ) : vacations.map((v, i) => (
              <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="bg-card rounded-2xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{v.user?.name}</span>
                      <span className="text-xs text-muted-foreground">{formatDateStr(v.startDate)} → {formatDateStr(v.endDate)}</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">{v.days} {v.days === 1 ? "dia útil" : "dias úteis"}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${vacBadge(v.status)}`}>{VAC_LABELS[v.status]}</span>
                    </div>
                    {v.reason && <p className="text-sm mt-1">{v.reason}</p>}
                    {v.decisionNote && <p className="text-xs text-muted-foreground mt-1">Nota: {v.decisionNote}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {v.status === "PENDENTE" && (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => decideVacation(v.id, "APROVADA")}><CheckCircle2 className="h-4 w-4" />Aceitar</Button>
                        <Button size="sm" variant="destructive" onClick={() => decideVacation(v.id, "REJEITADA")}><XCircle className="h-4 w-4" />Rejeitar</Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" onClick={() => deleteVacation(v.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* MARCAÇÕES */}
        <TabsContent value="marcacoes">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="punchUser" className="whitespace-nowrap">Colaborador:</Label>
              <Select value={punchUser} onValueChange={setPunchUser}>
                <SelectTrigger id="punchUser" className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os colaboradores</SelectItem>
                  {colaboradores.map((u) => (<SelectItem key={u.id} value={u.email}>{u.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button onClick={() => setPunchView("calendario")} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${punchView === "calendario" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}><CalendarDays className="h-4 w-4" />Calendário</button>
                <button onClick={() => setPunchView("lista")} className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${punchView === "lista" ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}><List className="h-4 w-4" />Lista</button>
              </div>
              <ValidateWorkDayDialog colaboradores={colaboradores} punches={colabPunches} absences={colabAbsences} onReload={load} />
              <Button variant="outline" onClick={exportPunchesCSV}><FileSpreadsheet className="h-4 w-4" />Excel (CSV)</Button>
              <Button onClick={exportPunchesPDF}><FileText className="h-4 w-4" />Exportar PDF</Button>
            </div>
          </div>
          <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold">Validar dia de trabalho:</span> use este botão para confirmar rapidamente, de uma só vez, os colaboradores que trabalharam num determinado dia (útil quando ninguém conseguiu registar o ponto). Também pode editar dia-a-dia no calendário, clicando em cada dia.
          </div>

          {punchView === "calendario" ? (
            <PunchCalendar
              month={punchMonth}
              onMonthChange={setPunchMonth}
              punchUser={punchUser}
              users={colaboradores}
              punches={punchUser === "ALL" ? colabPunches : punches.filter((p) => p.user?.email === punchUser)}
              absences={punchUser === "ALL" ? colabAbsences : absences.filter((a) => a.user?.email === punchUser)}
              taskMisses={punchUser === "ALL" ? taskMisses : taskMisses.filter((t) => t.user?.email === punchUser)}
              onReload={load}
            />
          ) : (
          <div className="bg-card rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary"><tr>
                  <th className="text-left p-3">Colaborador</th><th className="text-left p-3">Tipo</th><th className="text-left p-3">Data/Hora</th><th className="text-left p-3">IP / Dispositivo</th><th className="text-left p-3">Atraso/Extra</th><th className="p-3"></th>
                </tr></thead>
                <tbody>
                  {(punchUser === "ALL" ? colabPunches : punches.filter((p) => p.user?.email === punchUser)).slice(0, 200).map((p) => (
                    <tr key={p.id} className="border-t border-border hover:bg-secondary/50">
                      <td className="p-3 font-medium">{p.user?.name}</td>
                      <td className="p-3">{PUNCH_LABELS[p.type]}</td>
                      <td className="p-3 font-mono text-xs">{formatDateTime(p.timestamp)}</td>
                      <td className="p-3 text-xs text-muted-foreground">{p.ipAddress}<br />{p.device}</td>
                      <td className="p-3 text-xs">{p.lateMinutes > 0 && <span className="text-amber-600">Atraso {formatMinutes(p.lateMinutes)}</span>}{p.extraMinutes > 0 && <span className="text-violet-600">Extra {formatMinutes(p.extraMinutes)}</span>}{p.lateMinutes === 0 && p.extraMinutes === 0 && "—"}{p.delayReason && <span className="block mt-0.5 text-amber-700 dark:text-amber-300">Motivo: {p.delayReason}</span>}</td>
                      <td className="p-3"><Button size="sm" variant="ghost" onClick={() => deletePunch(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}
          <p className="text-xs text-muted-foreground mt-2">Documento confidencial de acesso exclusivo da administração. Filtre por colaborador, consulte o calendário de presenças e exporte o registo de ponto em PDF ou Excel.</p>
        </TabsContent>

        {/* RELATÓRIOS */}
        <TabsContent value="relatorios">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="month">Mês:</Label>
              <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={exportReportCSV}><FileSpreadsheet className="h-4 w-4" />Excel (CSV)</Button>
              <Button variant="outline" onClick={exportReportPDF}><FileText className="h-4 w-4" />PDF</Button>
            </div>
          </div>
          <div className="bg-card rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary"><tr>
                  <th className="text-left p-3">Colaborador</th><th className="text-left p-3">Dias</th><th className="text-left p-3">Horas trab.</th><th className="text-left p-3">Atrasos</th><th className="text-left p-3">Extra</th><th className="text-left p-3">Faltas (J/I)</th>
                </tr></thead>
                <tbody>
                  {report.map((r) => (
                    <tr key={r.userId} className="border-t border-border">
                      <td className="p-3"><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.email}</p></td>
                      <td className="p-3">{r.daysWorked}</td>
                      <td className="p-3 font-medium">{formatMinutes(r.workedMinutes)}</td>
                      <td className="p-3 text-amber-600">{formatMinutes(r.lateMinutes)}</td>
                      <td className="p-3 text-violet-600">{formatMinutes(r.extraMinutes)}</td>
                      <td className="p-3">{r.absencesTotal} <span className="text-xs text-muted-foreground">({r.absencesJustified}/{r.absencesUnjustified})</span></td>
                    </tr>
                  ))}
                  {report.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem dados para este mês.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Recibos */}
        <TabsContent value="recibos">
          <PayslipsTab />
        </TabsContent>

        {/* FICHAS DE CLIENTE */}
        <TabsContent value="fichas">
          <FichasAdmin />
        </TabsContent>

        {/* IPs */}
        <TabsContent value="ips">
          <div className="flex justify-end mb-4"><NewIpDialog onCreated={load} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            {ips.map((ip) => (
              <div key={ip.id} className="bg-card rounded-2xl p-4 flex items-center justify-between" style={{ boxShadow: "var(--shadow-sm)" }}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center"><Wifi className="h-5 w-5 text-violet-600 dark:text-violet-300" /></div>
                  <div><p className="font-mono font-semibold text-sm">{ip.address}</p><p className="text-xs text-muted-foreground">{ip.label ?? "—"}</p></div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteIp(ip.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Apenas dispositivos com estes endereços IP podem marcar o ponto.</p>
        </TabsContent>
            </div>
          </main>
        </div>
      </div>
    </Tabs>
  );
}

// Botão de navegação do menu lateral (aba), com ícone e rótulo.
function SideTab({ value, icon: Icon, label }: { value: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <TabsTrigger value={value} className="w-full justify-start gap-2.5 px-3 py-2 rounded-lg text-black hover:bg-black/10 hover:text-black data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-none">
      <Icon className="h-4 w-4 shrink-0" />{label}
    </TabsTrigger>
  );
}

const MONTHS_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const WEEKDAYS_PT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Calcula o offset (minutos) de Europe/Lisbon para um dado instante
function lisbonOffsetMinutes(date: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const map: Record<string, string> = {};
  fmt.formatToParts(date).forEach((p) => { map[p.type] = p.value; });
  const asUTC = Date.UTC(+map.year, +map.month - 1, +map.day, +map.hour, +map.minute, +map.second);
  return (asUTC - date.getTime()) / 60000;
}

// Devolve um Date correspondente a uma hora-de-relogio em Lisboa
function lisbonDate(dateStr: string, h: number, m: number): Date {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const utcGuess = Date.UTC(Y, Mo - 1, D, h, m, 0);
  const offset = lisbonOffsetMinutes(new Date(utcGuess));
  return new Date(utcGuess - offset * 60000);
}

const PRESENCE_PUNCHES: { type: string; h: number; m: number }[] = [
  { type: "ENTRADA", h: 9, m: 0 },
  { type: "SAIDA_ALMOCO", h: 13, m: 0 },
  { type: "REGRESSO_ALMOCO", h: 14, m: 30 },
  { type: "SAIDA_FINAL", h: 18, m: 30 },
];

function ValidateWorkDayDialog({ colaboradores, punches, absences, onReload }: {
  colaboradores: UserT[]; punches: PunchT[]; absences: AbsenceT[]; onReload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayStr());
  const [period, setPeriod] = useState<"completo" | "manha" | "tarde">("completo");
  const [tEntrada, setTEntrada] = useState("09:00");
  const [tSaidaAlmoco, setTSaidaAlmoco] = useState("13:00");
  const [tRegresso, setTRegresso] = useState("14:30");
  const [tSaidaFinal, setTSaidaFinal] = useState("18:30");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // Estado atual de cada colaborador para a data escolhida
  const statusByUser: Record<string, "presente" | "falta" | "nenhum"> = {};
  colaboradores.forEach((u) => {
    const hasPresence = punches.some((p) => p.user?.email === u.email && p.workDate === date && p.type === "ENTRADA");
    const hasAbsence = absences.some((a) => a.user?.email === u.email && a.absenceDate === date);
    statusByUser[u.id] = hasPresence ? "presente" : hasAbsence ? "falta" : "nenhum";
  });

  // Ao abrir ou mudar a data, pré-seleciona quem ainda não tem presença marcada
  useEffect(() => {
    if (!open) return;
    const init: Record<string, boolean> = {};
    colaboradores.forEach((u) => { init[u.id] = statusByUser[u.id] !== "presente"; });
    setSelected(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  const selectedCount = colaboradores.filter((u) => selected[u.id]).length;

  function toggle(id: string) { setSelected((s) => ({ ...s, [id]: !s[id] })); }
  function selectAll() { const n: Record<string, boolean> = {}; colaboradores.forEach((u) => { n[u.id] = true; }); setSelected(n); }
  function clearAll() { setSelected({}); }

  function toHM(v: string): { h: number; m: number } {
    const [h, m] = v.split(":").map(Number);
    return { h: h || 0, m: m || 0 };
  }

  async function submit() {
    const targets = colaboradores.filter((u) => selected[u.id]);
    if (targets.length === 0) { toast.error("Selecione pelo menos um colaborador."); return; }
    if (!date) { toast.error("Escolha uma data."); return; }
    let seq: { type: string; h: number; m: number }[];
    if (period === "manha") {
      // Só de manhã: entra e sai ao almoço
      seq = [
        { type: "ENTRADA", ...toHM(tEntrada) },
        { type: "SAIDA_FINAL", ...toHM(tSaidaAlmoco) },
      ];
    } else if (period === "tarde") {
      // Só de tarde: entra após almoço e sai ao fim do dia
      seq = [
        { type: "ENTRADA", ...toHM(tRegresso) },
        { type: "SAIDA_FINAL", ...toHM(tSaidaFinal) },
      ];
    } else {
      seq = [
        { type: "ENTRADA", ...toHM(tEntrada) },
        { type: "SAIDA_ALMOCO", ...toHM(tSaidaAlmoco) },
        { type: "REGRESSO_ALMOCO", ...toHM(tRegresso) },
        { type: "SAIDA_FINAL", ...toHM(tSaidaFinal) },
      ];
    }
    setBusy(true);
    let okCount = 0; let failCount = 0;
    try {
      for (const u of targets) {
        try {
          // Remove registos existentes do dia para evitar duplicados
          const dayPunches = punches.filter((p) => p.user?.email === u.email && p.workDate === date);
          const dayAbs = absences.filter((a) => a.user?.email === u.email && a.absenceDate === date);
          for (const a of dayAbs) await fetch(`/api/ponto/admin/absences/${a.id}`, { method: "DELETE" });
          for (const p of dayPunches) await fetch(`/api/ponto/admin/punches/${p.id}`, { method: "DELETE" });
          for (const pp of seq) {
            const dt = lisbonDate(date, pp.h, pp.m).toISOString();
            const res = await fetch("/api/ponto/admin/punches", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: u.id, type: pp.type, datetime: dt, note: "Presenca validada pelo administrador" }),
            });
            if (!res.ok) throw new Error("punch");
          }
          okCount++;
        } catch { failCount++; }
      }
      if (okCount > 0) toast.success(`${okCount} colaborador(es) validado(s) para ${formatDateStr(date)}.`);
      if (failCount > 0) toast.error(`${failCount} colaborador(es) não foram validados.`);
      setOpen(false);
      onReload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><CalendarCheck className="h-4 w-4" />Validar dia de trabalho</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Validar dia de trabalho</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Marque a presença de vários colaboradores de uma só vez. Útil quando o registo automático não esteve disponível.</p>

          <div className="space-y-1">
            <Label>Data</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Período trabalhado</Label>
            <div className="flex rounded-lg border border-border overflow-hidden">
              {([["completo", "Dia completo"], ["manha", "Só manhã"], ["tarde", "Só tarde"]] as const).map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setPeriod(val)}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${period === val ? "bg-primary text-primary-foreground" : "bg-card hover:bg-secondary"}`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {period === "completo" && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1"><Label className="text-xs">Entrada</Label><Input type="time" value={tEntrada} onChange={(e) => setTEntrada(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Saída almoço</Label><Input type="time" value={tSaidaAlmoco} onChange={(e) => setTSaidaAlmoco(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Regresso</Label><Input type="time" value={tRegresso} onChange={(e) => setTRegresso(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Saída final</Label><Input type="time" value={tSaidaFinal} onChange={(e) => setTSaidaFinal(e.target.value)} /></div>
            </div>
          )}
          {period === "manha" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Entrada</Label><Input type="time" value={tEntrada} onChange={(e) => setTEntrada(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Saída (fim da manhã)</Label><Input type="time" value={tSaidaAlmoco} onChange={(e) => setTSaidaAlmoco(e.target.value)} /></div>
            </div>
          )}
          {period === "tarde" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Entrada (tarde)</Label><Input type="time" value={tRegresso} onChange={(e) => setTRegresso(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs">Saída final</Label><Input type="time" value={tSaidaFinal} onChange={(e) => setTSaidaFinal(e.target.value)} /></div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Colaboradores ({selectedCount} selecionado{selectedCount === 1 ? "" : "s"})</Label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-primary hover:underline">Selecionar todos</button>
                <span className="text-muted-foreground text-xs">·</span>
                <button type="button" onClick={clearAll} className="text-xs text-muted-foreground hover:underline">Limpar</button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {colaboradores.length === 0 && <p className="p-3 text-sm text-muted-foreground">Sem colaboradores.</p>}
              {colaboradores.map((u) => {
                const st = statusByUser[u.id];
                return (
                  <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/50">
                    <input type="checkbox" checked={!!selected[u.id]} onChange={() => toggle(u.id)} className="h-4 w-4 rounded border-border accent-primary" />
                    <span className="flex-1 text-sm font-medium">{u.name}</span>
                    {st === "presente" && <span className="text-xs rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Já presente</span>}
                    {st === "falta" && <span className="text-xs rounded px-1.5 py-0.5 bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">Falta</span>}
                    {st === "nenhum" && <span className="text-xs rounded px-1.5 py-0.5 bg-secondary text-muted-foreground">Sem registo</span>}
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Ao validar, os registos existentes desse dia (para os colaboradores selecionados) são substituídos pelo horário indicado acima.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || selectedCount === 0}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Validar {selectedCount > 0 ? `(${selectedCount})` : ""}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PunchCalendar({ month, onMonthChange, punchUser, users, punches, absences, taskMisses, onReload }: {
  month: string; onMonthChange: (m: string) => void; punchUser: string;
  users: UserT[]; punches: PunchT[]; absences: AbsenceT[]; taskMisses: TaskMissT[]; onReload: () => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekdayMon = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Segunda = 0
  const isSpecific = punchUser !== "ALL";
  const selectedUser = isSpecific ? users.find((u) => u.email === punchUser) : null;
  const selectedName = selectedUser?.name ?? punchUser;
  const userId = selectedUser?.id ?? null;

  const [openDay, setOpenDay] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const punchesByDay: Record<number, PunchT[]> = {};
  punches.forEach((p) => {
    if (typeof p.workDate === "string" && p.workDate.startsWith(month)) {
      const d = Number(p.workDate.slice(8, 10));
      (punchesByDay[d] ??= []).push(p);
    }
  });
  const absencesByDay: Record<number, AbsenceT[]> = {};
  absences.forEach((a) => {
    if (typeof a.absenceDate === "string" && a.absenceDate.startsWith(month)) {
      const d = Number(a.absenceDate.slice(8, 10));
      (absencesByDay[d] ??= []).push(a);
    }
  });
  const taskMissesByDay: Record<number, TaskMissT[]> = {};
  taskMisses.forEach((t) => {
    if (typeof t.missDate === "string" && t.missDate.startsWith(month)) {
      const d = Number(t.missDate.slice(8, 10));
      (taskMissesByDay[d] ??= []).push(t);
    }
  });

  const pad = (n: number) => String(n).padStart(2, "0");
  // Feriados e pontes do mês (dias não úteis, marcados como férias para todos).
  const { holidays: holidayDays, bridges: bridgeDays } = nonWorkingInfoForMonth(month);
  // Dia útil JÁ PASSADO (anterior a hoje), excluindo fim de semana/feriado/ponte.
  // "Após passar a data": o dia de hoje só conta como falta depois de passar.
  const today = todayStr();
  const isPastWorkingDay = (d: number): boolean => {
    const ds = `${month}-${pad(d)}`;
    if (ds >= today) return false;
    const dow = new Date(y, m - 1, d).getDay();
    if (dow === 0 || dow === 6) return false;
    if (holidayDays.has(d) || bridgeDays.has(d)) return false;
    return true;
  };
  // Apenas os colaboradores a tempo inteiro têm dias em branco a contar como falta.
  const fullTimeSpecific = isSpecific && selectedUser?.partTime !== true;

  // Resumo do mes (para colaborador especifico)
  let presentDays = 0, lateDays = 0, absenceCount = 0, feriasCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dp = punchesByDay[d] ?? [];
    const da = absencesByDay[d] ?? [];
    const hasEntrada = dp.some((p) => p.type === "ENTRADA");
    if (hasEntrada) presentDays++;
    if (dp.some((p) => p.lateMinutes > 0)) lateDays++;
    for (const a of da) {
      if (isFeriasAbsence(a)) feriasCount++; else absenceCount++;
    }
    // Dia útil passado sem marcação nem registo conta como falta (tempo inteiro).
    if (fullTimeSpecific && da.length === 0 && !hasEntrada && isPastWorkingDay(d)) {
      absenceCount++;
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekdayMon; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  async function applyAction(action: "presenca" | "ferias" | "falta" | "limpar") {
    if (!userId || openDay === null) return;
    const dateStr = `${month}-${pad(openDay)}`;
    const dayPunches = punchesByDay[openDay] ?? [];
    const dayAbs = absencesByDay[openDay] ?? [];
    setBusy(true);
    try {
      // Limpar registos existentes do dia
      for (const a of dayAbs) await fetch(`/api/ponto/admin/absences/${a.id}`, { method: "DELETE" });
      for (const p of dayPunches) await fetch(`/api/ponto/admin/punches/${p.id}`, { method: "DELETE" });

      if (action === "presenca") {
        for (const pp of PRESENCE_PUNCHES) {
          const dt = lisbonDate(dateStr, pp.h, pp.m).toISOString();
          const res = await fetch("/api/ponto/admin/punches", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, type: pp.type, datetime: dt, note: "Presenca marcada pelo administrador" }),
          });
          if (!res.ok) throw new Error("punch");
        }
        toast.success("Dia marcado como presenca.");
      } else if (action === "ferias") {
        const res = await fetch("/api/ponto/admin/absences", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, absenceDate: dateStr, status: "JUSTIFICADA", reason: "Ferias", observation: "Periodo de ferias" }),
        });
        if (!res.ok) throw new Error("abs");
        toast.success("Dia marcado como ferias.");
      } else if (action === "falta") {
        const res = await fetch("/api/ponto/admin/absences", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, absenceDate: dateStr, status: "INJUSTIFICADA", reason: "Falta", observation: "Falta registada pelo administrador" }),
        });
        if (!res.ok) throw new Error("abs");
        toast.success("Dia marcado como falta.");
      } else {
        toast.success("Registos do dia removidos.");
      }
      setOpenDay(null);
      onReload();
    } catch {
      toast.error("Ocorreu um erro ao atualizar o dia.");
    } finally {
      setBusy(false);
    }
  }

  const openPunches = openDay !== null ? (punchesByDay[openDay] ?? []) : [];
  const openAbs = openDay !== null ? (absencesByDay[openDay] ?? []) : [];
  const openTaskMisses = openDay !== null ? (taskMissesByDay[openDay] ?? []) : [];
  const orderedPunches = [...openPunches].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="sm" onClick={() => onMonthChange(shiftMonth(month, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-center">
          <p className="font-display font-bold text-lg">{MONTHS_PT[m - 1]} {y}</p>
          <p className="text-xs text-muted-foreground">{isSpecific ? selectedName : "Todos os colaboradores"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onMonthChange(shiftMonth(month, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {isSpecific ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center"><p className="text-xs text-muted-foreground">Dias presentes</p><p className="font-bold text-lg text-emerald-600 dark:text-emerald-400">{presentDays}</p></div>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 p-3 text-center"><p className="text-xs text-muted-foreground">Dias com atraso</p><p className="font-bold text-lg text-amber-600 dark:text-amber-400">{lateDays}</p></div>
          <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-3 text-center"><p className="text-xs text-muted-foreground">Férias</p><p className="font-bold text-lg text-sky-600 dark:text-sky-400">{feriasCount}</p></div>
          <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 p-3 text-center"><p className="text-xs text-muted-foreground">Faltas</p><p className="font-bold text-lg text-rose-600 dark:text-rose-400">{absenceCount}</p></div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-4 text-center">Clique num dia para ver e validar as presenças, férias e faltas de cada colaborador. Selecione um colaborador específico para ver o resumo individual.</p>
      )}

      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAYS_PT.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-muted-foreground py-1">{w}</div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} />;
          const weekend = idx % 7 >= 5;
          const dp = punchesByDay[day] ?? [];
          const da = absencesByDay[day] ?? [];
          const dt = taskMissesByDay[day] ?? [];
          const entry = dp.find((p) => p.type === "ENTRADA");
          const exit = dp.find((p) => p.type === "SAIDA_FINAL");
          const hasLate = dp.some((p) => p.lateMinutes > 0);
          const present = !!entry;
          // Dia em branco (sem marcação nem registo) já passado, tempo inteiro.
          const isBlankFalta = fullTimeSpecific && da.length === 0 && !present && isPastWorkingDay(day);

          const dateStrCell = `${month}-${String(day).padStart(2, "0")}`;
          const isHol = holidayDays.has(day);
          const isBrg = bridgeDays.has(day);
          const holLabel = isHol ? holidayName(dateStrCell) : (isBrg ? bridgeHolidayName(dateStrCell) : null);

          let cellBg = weekend ? "bg-secondary/40" : "bg-background";
          let ring = "border-border";
          if (isBrg) { cellBg = "bg-indigo-50 dark:bg-indigo-900/20"; ring = "border-indigo-300 dark:border-indigo-700"; }
          else if (isHol) { cellBg = "bg-violet-50 dark:bg-violet-900/20"; ring = "border-violet-300 dark:border-violet-700"; }
          const dayIsFerias = da.length > 0 && da.every((a) => isFeriasAbsence(a));
          if (da.length > 0) {
            if (dayIsFerias) { cellBg = "bg-sky-50 dark:bg-sky-900/20"; ring = "border-sky-300 dark:border-sky-800"; }
            else { cellBg = "bg-rose-50 dark:bg-rose-900/20"; ring = "border-rose-300 dark:border-rose-800"; }
          }
          else if (present) { cellBg = "bg-emerald-50 dark:bg-emerald-900/20"; ring = "border-emerald-300 dark:border-emerald-800"; }
          else if (isBlankFalta) { cellBg = "bg-rose-50 dark:bg-rose-900/20"; ring = "border-rose-300 dark:border-rose-800"; }

          // Modo "todos": contar presencas distintas
          const distinctPresent = new Set(dp.filter((p) => p.type === "ENTRADA").map((p) => p.user?.email)).size;
          const distinctFerias = new Set(da.filter((a) => isFeriasAbsence(a)).map((a) => a.user?.email)).size;
          const distinctFaltas = new Set(da.filter((a) => !isFeriasAbsence(a)).map((a) => a.user?.email)).size;
          // Colaboradores a tempo inteiro sem marcação nem registo num dia útil já
          // passado contam também como falta (dias em branco).
          let blankFaltasAll = 0;
          if (!isSpecific && isPastWorkingDay(day)) {
            const presentEmails = new Set(dp.filter((p) => p.type === "ENTRADA").map((p) => p.user?.email));
            const absentEmails = new Set(da.map((a) => a.user?.email));
            for (const u of users) {
              if (u.partTime === true || u.active === false) continue;
              if (presentEmails.has(u.email) || absentEmails.has(u.email)) continue;
              blankFaltasAll++;
            }
          }
          const totalFaltasAll = distinctFaltas + blankFaltasAll;
          const distinctTaskMisses = new Set(dt.map((t) => t.userId)).size;
          const userTaskMissed = isSpecific ? dt.length > 0 : false;
          const clickable = true;

          return (
            <div
              key={day}
              onClick={clickable ? () => setOpenDay(day) : undefined}
              className={`min-h-[68px] sm:min-h-[84px] rounded-lg border ${ring} ${cellBg} p-1.5 flex flex-col ${clickable ? "cursor-pointer hover:ring-2 hover:ring-primary/50 transition" : ""}`}
            >
              <span className={`text-xs font-semibold ${weekend ? "text-muted-foreground" : ""}`}>{day}</span>
              <div className="flex-1 flex flex-col gap-0.5 mt-0.5 text-[10px] leading-tight">
                {(isBrg || isHol) && (
                  <span
                    title={holLabel ?? undefined}
                    className={`inline-flex items-center justify-center rounded px-1 py-0.5 font-semibold truncate ${isBrg ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200" : "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"}`}
                  >
                    {isBrg ? "Ponte" : "Feriado"}
                  </span>
                )}
                {isSpecific ? (
                  <>
                    {da.length > 0 && (
                      <span className={`inline-flex items-center justify-center rounded px-1 py-0.5 font-medium ${absenceBadge(da[0])}`}>{absenceLabel(da[0])}</span>
                    )}
                    {present && da.length === 0 && (
                      <>
                        <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-semibold"><CheckCircle2 className="h-2.5 w-2.5" />{formatTime(entry!.timestamp)}</span>
                        {exit && <span className="text-muted-foreground">Saida {formatTime(exit.timestamp)}</span>}
                        {hasLate && <span className="text-amber-600 dark:text-amber-400">Atraso</span>}
                      </>
                    )}
                    {isBlankFalta && (
                      <span className="inline-flex items-center justify-center rounded px-1 py-0.5 font-medium bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">Falta</span>
                    )}
                    {userTaskMissed && <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-medium"><ListChecks className="h-2.5 w-2.5" />Sem tarefas</span>}
                  </>
                ) : (
                  <>
                    {distinctPresent > 0 && <span className="inline-flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-semibold"><CheckCircle2 className="h-2.5 w-2.5" />{distinctPresent} presenca{distinctPresent > 1 ? "s" : ""}</span>}
                    {distinctFerias > 0 && <span className="text-sky-600 dark:text-sky-400">{distinctFerias} férias</span>}
                    {totalFaltasAll > 0 && <span className="text-rose-600 dark:text-rose-400">{totalFaltasAll} falta{totalFaltasAll > 1 ? "s" : ""}</span>}
                    {distinctTaskMisses > 0 && <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400 font-medium"><ListChecks className="h-2.5 w-2.5" />{distinctTaskMisses} sem tarefas</span>}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20" />Presente</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-rose-300 bg-rose-50 dark:bg-rose-900/20" />Falta</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-sky-300 bg-sky-50 dark:bg-sky-900/20" />Férias</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-violet-300 bg-violet-50 dark:bg-violet-900/20" />Feriado</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-indigo-300 bg-indigo-50 dark:bg-indigo-900/20" />Ponte</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded border border-border bg-secondary/40" />Fim de semana</span>
        <span className="ml-auto text-primary">Clique num dia para {isSpecific ? "editar" : "ver e validar"}</span>
      </div>

      {/* Detalhe / edicao do dia (colaborador especifico) */}
      <Dialog open={openDay !== null && isSpecific} onOpenChange={(o) => { if (!o) setOpenDay(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {openDay !== null ? `${selectedName} \u00b7 ${pad(openDay)}/${pad(m)}/${y}` : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold mb-1">Horario registado</p>
              {orderedPunches.length > 0 ? (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {orderedPunches.map((p) => (
                    <div key={p.id} className="px-3 py-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{PUNCH_LABELS[p.type] ?? p.type}</span>
                        <span className="font-semibold tabular-nums">{formatTime(p.timestamp)}{p.lateMinutes > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400 text-xs">+{p.lateMinutes}min</span>}</span>
                      </div>
                      {p.delayReason && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300"><span className="font-medium">Motivo do atraso:</span> {p.delayReason}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : openAbs.length > 0 ? (
                <div className={`rounded-lg border px-3 py-2 text-sm ${isFeriasAbsence(openAbs[0]) ? "border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20" : "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20"}`}>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${absenceBadge(openAbs[0])}`}>{absenceLabel(openAbs[0])}</span>
                  {openAbs[0].reason && !isFeriasAbsence(openAbs[0]) && <span className="ml-2 text-muted-foreground">{openAbs[0].reason}</span>}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sem registos neste dia.</p>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold mb-2">Alterar dia para</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" disabled={busy} onClick={() => applyAction("presenca")} className="justify-start border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"><CheckCircle2 className="h-4 w-4" />Presenca (9h-13h / 14h30-18h30)</Button>
                <Button variant="outline" disabled={busy} onClick={() => applyAction("ferias")} className="justify-start border-sky-300 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-900/20"><CalendarDays className="h-4 w-4" />Ferias</Button>
                <Button variant="outline" disabled={busy} onClick={() => applyAction("falta")} className="justify-start border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"><XCircle className="h-4 w-4" />Falta</Button>
                <Button variant="outline" disabled={busy} onClick={() => applyAction("limpar")} className="justify-start"><Trash2 className="h-4 w-4" />Limpar dia</Button>
              </div>
              {busy && <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />A atualizar...</p>}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detalhe / validação do dia (todos os colaboradores) */}
      {!isSpecific && (
        <DayAllDialog
          open={openDay !== null}
          dateStr={openDay !== null ? `${month}-${pad(openDay)}` : ""}
          titleDate={openDay !== null ? `${pad(openDay)}/${pad(m)}/${y}` : ""}
          colaboradores={users}
          dayPunches={openPunches}
          dayAbsences={openAbs}
          dayTaskMisses={openTaskMisses}
          onClose={() => setOpenDay(null)}
          onReload={onReload}
        />
      )}
    </div>
  );
}

// Sequências de marcações por período (horário padrão da empresa).
const PERIOD_SEQ: Record<"completo" | "manha" | "tarde", { type: string; h: number; m: number }[]> = {
  completo: [
    { type: "ENTRADA", h: 9, m: 0 },
    { type: "SAIDA_ALMOCO", h: 13, m: 0 },
    { type: "REGRESSO_ALMOCO", h: 14, m: 30 },
    { type: "SAIDA_FINAL", h: 18, m: 30 },
  ],
  manha: [
    { type: "ENTRADA", h: 9, m: 0 },
    { type: "SAIDA_FINAL", h: 13, m: 0 },
  ],
  tarde: [
    { type: "ENTRADA", h: 14, m: 30 },
    { type: "SAIDA_FINAL", h: 18, m: 30 },
  ],
};

// Hora-decimal (0-24) de um instante, no fuso de Lisboa.
function lisbonHM(iso: string): number {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return NaN;
  const local = new Date(d.getTime() + lisbonOffsetMinutes(d) * 60000);
  return local.getUTCHours() + local.getUTCMinutes() / 60;
}

// Deteta o período efetivamente trabalhado a partir das marcações do dia.
function detectPeriod(punches: { type: string; timestamp: string }[]): "completo" | "manha" | "tarde" | null {
  const entradas = punches.filter((p) => p.type === "ENTRADA").map((p) => lisbonHM(p.timestamp)).filter((h) => !isNaN(h)).sort((a, b) => a - b);
  if (entradas.length === 0) return null;
  const firstEntry = entradas[0];
  const worksAfternoon = punches.some((p) => { const h = lisbonHM(p.timestamp); return !isNaN(h) && h >= 14; });
  const worksMorning = firstEntry < 12.5;
  if (worksMorning && worksAfternoon) return "completo";
  if (!worksMorning && firstEntry >= 13) return "tarde";
  return "manha";
}

// Diálogo do dia na vista "Todos os colaboradores": ver presenças/horários,
// ver e decidir faltas (comprovativo, aceitar/recusar) e validar o dia
// (completo / manhã / tarde) para cada colaborador.
function DayAllDialog({ open, dateStr, titleDate, colaboradores, dayPunches, dayAbsences, dayTaskMisses, onClose, onReload }: {
  open: boolean; dateStr: string; titleDate: string; colaboradores: UserT[];
  dayPunches: PunchT[]; dayAbsences: AbsenceT[]; dayTaskMisses: TaskMissT[]; onClose: () => void; onReload: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [taskBusyId, setTaskBusyId] = useState<string | null>(null);

  // Marca/desmarca o dia como "tarefas diárias não feitas" para um colaborador.
  async function toggleTask(u: UserT, missed: boolean) {
    if (!dateStr) return;
    setTaskBusyId(u.id);
    try {
      if (missed) {
        const res = await fetch("/api/ponto/admin/task-misses", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: u.id, missDate: dateStr }),
        });
        if (!res.ok) throw new Error("task");
        toast.success(`${u.name}: dia marcado como tarefas diárias NÃO feitas.`);
      } else {
        const res = await fetch(`/api/ponto/admin/task-misses?userId=${encodeURIComponent(u.id)}&missDate=${encodeURIComponent(dateStr)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("task");
        toast.success(`${u.name}: tarefas diárias marcadas como feitas.`);
      }
      onReload();
    } catch {
      toast.error(`Erro ao atualizar as tarefas diárias de ${u.name}.`);
    } finally {
      setTaskBusyId(null);
    }
  }

  async function clearDay(u: UserT) {
    const uAbs = dayAbsences.filter((a) => a.user?.email === u.email);
    const uPun = dayPunches.filter((p) => p.user?.email === u.email);
    for (const a of uAbs) await fetch(`/api/ponto/admin/absences/${a.id}`, { method: "DELETE" });
    for (const p of uPun) await fetch(`/api/ponto/admin/punches/${p.id}`, { method: "DELETE" });
  }

  async function applyForUser(u: UserT, action: "completo" | "manha" | "tarde" | "falta" | "limpar") {
    if (!dateStr) return;
    setBusyId(u.id);
    try {
      await clearDay(u);
      if (action === "falta") {
        const res = await fetch("/api/ponto/admin/absences", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: u.id, absenceDate: dateStr, status: "INJUSTIFICADA", reason: "Falta", observation: "Falta registada pelo administrador" }),
        });
        if (!res.ok) throw new Error("abs");
        toast.success(`${u.name}: dia marcado como falta.`);
      } else if (action === "limpar") {
        toast.success(`${u.name}: registos do dia removidos.`);
      } else {
        for (const pp of PERIOD_SEQ[action]) {
          const dt = lisbonDate(dateStr, pp.h, pp.m).toISOString();
          const res = await fetch("/api/ponto/admin/punches", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: u.id, type: pp.type, datetime: dt, note: "Presenca validada pelo administrador" }),
          });
          if (!res.ok) throw new Error("punch");
        }
        const lbl = action === "completo" ? "dia completo" : action === "manha" ? "só manhã" : "só tarde";
        toast.success(`${u.name}: validado (${lbl}).`);
      }
      onReload();
    } catch {
      toast.error(`Erro ao atualizar ${u.name}.`);
    } finally {
      setBusyId(null);
    }
  }

  async function viewAtt(id: string) {
    try {
      const res = await fetch(`/api/ponto/file?absenceId=${id}`);
      const data = await res.json();
      if (res.ok && data?.url) window.open(data.url, "_blank");
      else toast.error("Comprovativo indisponível.");
    } catch { toast.error("Erro ao abrir comprovativo."); }
  }

  async function decide(id: string, status: "JUSTIFICADA" | "INJUSTIFICADA", who: string) {
    const note = status === "INJUSTIFICADA"
      ? (window.prompt("Motivo da recusa (opcional):", "") ?? "")
      : (window.prompt("Observação para o colaborador (opcional):", "") ?? "");
    setBusyId(who);
    try {
      const res = await fetch(`/api/ponto/admin/absences/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, decisionNote: note }),
      });
      if (res.ok) { toast.success(status === "JUSTIFICADA" ? "Falta aceite. Colaborador notificado." : "Falta recusada. Colaborador notificado."); onReload(); }
      else toast.error("Erro ao atualizar a falta.");
    } catch { toast.error("Erro ao atualizar a falta."); }
    finally { setBusyId(null); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dia {titleDate} · Todos os colaboradores</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Consulte os horários e o estado de cada colaborador. Pode validar o dia (completo, só manhã ou só tarde), marcar falta, limpar o dia e, nas faltas em análise, ver o comprovativo e aceitar ou recusar. Em «Tarefas diárias» pode assinalar se o colaborador cumpriu ou não as tarefas do dia — ao ultrapassar 4 dias sem tarefas feitas no mês, perde o prémio de assiduidade.</p>
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {colaboradores.length === 0 && <p className="text-sm text-muted-foreground">Sem colaboradores.</p>}
          {colaboradores.map((u) => {
            const uPun = dayPunches.filter((p) => p.user?.email === u.email).sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
            const uAbs = dayAbsences.find((a) => a.user?.email === u.email) ?? null;
            const present = uPun.some((p) => p.type === "ENTRADA");
            const isBusy = busyId === u.id;
            const ferias = uAbs ? isFeriasAbsence(uAbs) : false;
            const taskMissed = dayTaskMisses.some((t) => t.userId === u.id);
            const taskBusy = taskBusyId === u.id;
            const detected = present ? detectPeriod(uPun) : null;
            const detectedLabel = ferias ? "Férias" : detected === "completo" ? "Dia completo" : detected === "manha" ? "Só manhã" : detected === "tarde" ? "Só tarde" : null;
            const pcls = (val: "completo" | "manha" | "tarde", base: string) => detected === val ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90 ring-2 ring-primary/40" : base;
            return (
              <div key={u.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="font-semibold">{u.name}</p>
                    {present ? (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                        {uPun.map((p) => (
                          <span key={p.id} className="tabular-nums text-muted-foreground">{PUNCH_LABELS[p.type] ?? p.type}: <span className="font-semibold text-foreground">{formatTime(p.timestamp)}</span>{p.lateMinutes > 0 && <span className="ml-1 text-amber-600 dark:text-amber-400">+{p.lateMinutes}min</span>}</span>
                        ))}
                      </div>
                    ) : uAbs ? (
                      <p className="mt-1 text-xs text-muted-foreground">{uAbs.reason ?? "—"}{uAbs.decisionNote ? ` · Nota: ${uAbs.decisionNote}` : ""}</p>
                    ) : (
                      <p className="mt-1 text-xs text-muted-foreground">Sem registo neste dia.</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${present ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" : uAbs ? absenceBadge(uAbs) : "bg-secondary text-muted-foreground"}`}>
                    {present ? (detected === "manha" ? "Só manhã" : detected === "tarde" ? "Só tarde" : "Presente") : uAbs ? absenceLabel(uAbs) : "Sem registo"}
                  </span>
                </div>

                {uAbs && !ferias && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {uAbs.attachmentName && <Button size="sm" variant="outline" disabled={isBusy} onClick={() => viewAtt(uAbs.id)}><Eye className="h-4 w-4" />Comprovativo</Button>}
                    {uAbs.status !== "JUSTIFICADA" && <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isBusy} onClick={() => decide(uAbs.id, "JUSTIFICADA", u.id)}><CheckCircle2 className="h-4 w-4" />Aceitar</Button>}
                    {uAbs.status !== "INJUSTIFICADA" && <Button size="sm" variant="destructive" disabled={isBusy} onClick={() => decide(uAbs.id, "INJUSTIFICADA", u.id)}><XCircle className="h-4 w-4" />Recusar</Button>}
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground self-center mr-1">Validar dia{detectedLabel ? ` · detetado: ${detectedLabel}` : ""}:</span>
                  {ferias && <span className="inline-flex items-center gap-1 self-center rounded-md border border-sky-300 bg-sky-100 px-2 py-1 text-xs font-medium text-sky-800 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-300"><Palmtree className="h-3.5 w-3.5" />Férias</span>}
                  {!ferias && <Button size="sm" variant="outline" disabled={isBusy} onClick={() => applyForUser(u, "completo")} className={pcls("completo", "border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20")}>{isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Completo</Button>}
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => applyForUser(u, "manha")} className={pcls("manha", "")}>Só manhã</Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => applyForUser(u, "tarde")} className={pcls("tarde", "")}>Só tarde</Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => applyForUser(u, "falta")} className="border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"><XCircle className="h-3.5 w-3.5" />Falta</Button>
                  <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => applyForUser(u, "limpar")}><Trash2 className="h-3.5 w-3.5" />Limpar</Button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
                  <span className="text-xs text-muted-foreground self-center mr-1 inline-flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />Tarefas diárias:</span>
                  <Button size="sm" variant="outline" disabled={taskBusy} onClick={() => toggleTask(u, false)} className={!taskMissed ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 ring-2 ring-emerald-500/40" : "border-emerald-300 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"}>{taskBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}Feitas</Button>
                  <Button size="sm" variant="outline" disabled={taskBusy} onClick={() => toggleTask(u, true)} className={taskMissed ? "bg-rose-600 text-white border-rose-600 hover:bg-rose-700 ring-2 ring-rose-500/40" : "border-rose-300 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"}>{taskBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}Não feitas</Button>
                  {taskMissed && <span className="text-xs font-medium text-rose-700 dark:text-rose-300 self-center">Conta para o limite do prémio</span>}
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewUserDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState("");
  const [password, setPassword] = useState(""); const [role, setRole] = useState("COLABORADOR");
  const [partTime, setPartTime] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!name || !email || !password) { toast.error("Preencha todos os campos."); return; }
    setLoading(true);
    const res = await fetch("/api/ponto/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password, role, partTime: role === "COLABORADOR" ? partTime : false }) });
    const d = await res.json(); setLoading(false);
    if (res.ok) { toast.success("Colaborador criado."); setOpen(false); setName(""); setEmail(""); setPassword(""); setPartTime(false); onCreated(); }
    else toast.error(d?.message ?? "Erro.");
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Novo colaborador</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo colaborador</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1"><Label>Palavra-passe</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div className="space-y-1"><Label>Perfil</Label>
            <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COLABORADOR">Colaborador</SelectItem><SelectItem value="ADMIN">Administrador</SelectItem></SelectContent></Select>
          </div>
          {role === "COLABORADOR" && (
            <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5">
              <div className="pr-3"><Label className="text-sm">Tempo parcial (part-time)</Label><p className="text-xs text-muted-foreground">Marca apenas entrada e saída (com opção de dia completo).</p></div>
              <Switch checked={partTime} onCheckedChange={setPartTime} />
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AccountingToggle({ user, onChanged }: { user: UserT; onChanged: () => void }) {
  const [value, setValue] = useState(!!user.sendToAccounting);
  const [saving, setSaving] = useState(false);
  async function toggle(v: boolean) {
    setValue(v);
    setSaving(true);
    try {
      const res = await fetch(`/api/ponto/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToAccounting: v }),
      });
      if (!res.ok) throw new Error();
      toast.success(v ? "Recibo marcado para a contabilidade." : "Recibo excluído do envio à contabilidade.");
      onChanged();
    } catch {
      setValue(!v);
      toast.error("Erro ao atualizar.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Receipt className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-medium truncate">Enviar recibo à contabilidade</span>
      </div>
      <Switch checked={value} disabled={saving} onCheckedChange={toggle} />
    </div>
  );
}

function ColaboradorPayslipActions({ user }: { user: UserT }) {
  const [month, setMonth] = useState(currentMonth());
  const [gen, setGen] = useState(false);
  const [snd, setSnd] = useState(false);

  async function gerar() {
    setGen(true);
    try {
      const res = await fetch("/api/ponto/admin/payslips/generate-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Erro");
      toast.success(
        data?.createdProfile
          ? "Recibo gerado. Criado perfil salarial (valores a zero) — edite-o em Recibos › Perfis salariais."
          : "Recibo e ponto de assiduidade gerados. Já aparecem na área de recibos."
      );
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar o recibo.");
    } finally {
      setGen(false);
    }
  }

  async function enviar() {
    setSnd(true);
    try {
      const res = await fetch("/api/ponto/admin/payslips/send-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, month }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Erro");
      toast.success(
        data?.emailed
          ? "Recibo enviado à contabilidade por email."
          : "Pedido processado, mas o email não foi confirmado."
      );
    } catch (e: any) {
      toast.error(e?.message || "Erro ao enviar à contabilidade.");
    } finally {
      setSnd(false);
    }
  }

  return (
    <div className="rounded-xl bg-secondary/50 px-3 py-2 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Wallet className="h-4 w-4 text-primary shrink-0" />
        <span className="text-xs font-medium">Recibo do colaborador</span>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="ml-auto text-xs rounded-md border border-input bg-background px-2 py-1"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs" disabled={gen} onClick={gerar}>
          {gen ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
          Gerar recibo
        </Button>
        <Button size="sm" className="flex-1 h-8 text-xs" disabled={snd} onClick={enviar}>
          {snd ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Enviar à contabilidade
        </Button>
      </div>
    </div>
  );
}

function EditUserDialog({ user, onSaved }: { user: UserT; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(user.name); const [role, setRole] = useState(user.role);
  const [active, setActive] = useState(user.active); const [password, setPassword] = useState("");
  const [sendToAccounting, setSendToAccounting] = useState(!!user.sendToAccounting);
  const [partTime, setPartTime] = useState(!!user.partTime);
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    const body: any = { name, role, active, sendToAccounting, partTime: role === "COLABORADOR" ? partTime : false };
    if (password) body.password = password;
    const res = await fetch(`/api/ponto/admin/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setLoading(false);
    if (res.ok) { toast.success("Colaborador atualizado."); setOpen(false); onSaved(); } else toast.error("Erro.");
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="ghost"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar {user.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label>Perfil</Label>
            <Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="COLABORADOR">Colaborador</SelectItem><SelectItem value="ADMIN">Administrador</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Estado</Label>
            <Select value={active ? "1" : "0"} onValueChange={(v) => setActive(v === "1")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Ativo</SelectItem><SelectItem value="0">Inativo</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1"><Label>Nova palavra-passe (opcional)</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Deixar vazio para manter" /></div>
          <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5">
            <div className="pr-3"><Label className="text-sm">Enviar recibo à contabilidade</Label><p className="text-xs text-muted-foreground">Incluir no envio mensal para a contabilidade.</p></div>
            <Switch checked={sendToAccounting} onCheckedChange={setSendToAccounting} />
          </div>
          {role === "COLABORADOR" && (
            <div className="flex items-center justify-between rounded-xl bg-secondary/50 px-3 py-2.5">
              <div className="pr-3"><Label className="text-sm">Tempo parcial (part-time)</Label><p className="text-xs text-muted-foreground">Marca apenas entrada e saída (com opção de dia completo).</p></div>
              <Switch checked={partTime} onCheckedChange={setPartTime} />
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Guardar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewIpDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState(""); const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit() {
    if (!address) { toast.error("Indique o endereço IP."); return; }
    setLoading(true);
    const res = await fetch("/api/ponto/admin/ips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, label }) });
    const d = await res.json(); setLoading(false);
    if (res.ok) { toast.success("IP adicionado."); setOpen(false); setAddress(""); setLabel(""); onCreated(); } else toast.error(d?.message ?? "Erro.");
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4" />Adicionar IP</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Autorizar novo IP</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Endereço IP (IPv4 ou IPv6)</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="46.189.203.107" /></div>
          <div className="space-y-1"><Label>Descrição (opcional)</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Escritório principal" /></div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Adicionar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
function ResetLinkDialog({ user }: { user: UserT }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setLink("");
    try {
      const res = await fetch(`/api/ponto/admin/users/${user.id}/reset-link`, { method: "POST" });
      const d = await res.json();
      if (res.ok && d?.link) {
        setLink(d.link);
        setExpiresAt(d.expiresAt ?? null);
      } else {
        toast.error(d?.message ?? "Erro ao gerar o link.");
      }
    } catch {
      toast.error("Erro ao gerar o link.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o && !link) generate(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Gerar link para repor a palavra-passe"><KeyRound className="h-4 w-4 text-primary" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Repor palavra-passe · {user.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Gere um link seguro e entregue-o diretamente ao colaborador (mensagem, WhatsApp ou pessoalmente).
            Ao abrir o link, o colaborador define uma nova palavra-passe. Não depende do email.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />A gerar link...</div>
          ) : link ? (
            <>
              <div className="space-y-1">
                <Label>Link (válido 24 horas, uso único)</Label>
                <div className="flex gap-2">
                  <Input readOnly value={link} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                  <Button type="button" onClick={copy}><Copy className="h-4 w-4" /></Button>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={generate}><RefreshCw className="h-4 w-4 mr-1" />Gerar novo link</Button>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== RECIBOS ====================
type PayslipT = {
  id: string;
  month: string;
  name: string;
  category?: string | null;
  employeeNumber?: string | null;
  salarioBase: number;
  vencimentoBase: number;
  subsAlimentacao: number;
  subsFerias: number;
  subsNatal: number;
  premioAssiduidade?: number;
  premioQualificado?: boolean;
  outrosAbonos: number;
  totalFaltas: number;
  segSocial: number;
  irs: number;
  outrosDescontos: number;
  totalIliquido: number;
  totalDescontos: number;
  liquido: number;
  workingDays?: number;
  daysWorked?: number;
  absJustDays?: number;
  absInjustDays?: number;
  feriasDays?: number;
  autoGenerated?: boolean;
};

type DraftEntry = {
  employeeNumber?: string;
  name: string;
  category?: string;
  salarioBase: number;
  vencimentoBase: number;
  subsAlimentacao: number;
  subsFerias: number;
  subsNatal: number;
  outrosAbonos: number;
  totalFaltas: number;
  segSocial: number;
  irs: number;
  outrosDescontos: number;
  totalIliquido: number;
  totalDescontos: number;
  liquido: number;
};

type ProfileT = {
  id: string;
  name: string;
  category?: string | null;
  employeeNumber?: string | null;
  vencimentoBase: number;
  periodRate: number;
  mealPerDay: number;
  subsFerias: number;
  subsNatal: number;
  ssRate: number;
  irsRate: number;
  refMonth?: string | null;
  user?: { id: string; name: string; email: string } | null;
};

const CHART_COLORS = ["#feca00", "#0ea5e9", "#22c55e", "#ef4444", "#a855f7", "#f97316", "#14b8a6", "#e11d48"];

type SendLogT = {
  month: string;
  sentAt: string;
  accountingRecipients: string[];
  accountingCount: number;
  accountingEmailed: boolean;
  count: number;
  trigger: "auto" | "manual";
};

function fmtSentAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-PT", {
      timeZone: "Europe/Lisbon",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Cartão: verificação e envio do registo de ponto por email para a contabilidade.
function PayslipEmailCard({ months }: { months: string[] }) {
  const [recipients, setRecipients] = useState<{ accounting: string[] } | null>(null);
  const [logs, setLogs] = useState<Record<string, SendLogT>>({});
  const [loading, setLoading] = useState(true);
  const [sendingMonth, setSendingMonth] = useState<string | null>(null);

  // Pré-visualização
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMonth, setPreviewMonth] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject?: string; html?: string; recipients?: string[]; empty?: boolean; message?: string } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ponto/admin/payslips/email-status");
      const data = await res.json();
      if (res.ok) {
        setRecipients(data.recipients ?? null);
        setLogs(data.logs ?? {});
      }
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const monthList = Array.from(new Set([...months, ...Object.keys(logs)])).sort((a, b) => b.localeCompare(a));

  async function loadPreview(month: string) {
    setPreviewLoading(true);
    setPreviewData(null);
    try {
      const res = await fetch(`/api/ponto/admin/payslips/email-preview?month=${month}`);
      const data = await res.json();
      setPreviewData(data);
    } catch {
      setPreviewData({ message: "Erro ao carregar a pré-visualização." });
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPreview(month: string) {
    setPreviewMonth(month);
    setPreviewOpen(true);
    loadPreview(month);
  }

  async function sendMonth(month: string) {
    const already = logs[month];
    const verb = already ? "reenviar" : "enviar";
    if (!confirm(`Confirmar ${verb} os recibos de ${monthLabel(month)} para os emails indicados?`)) return;
    setSendingMonth(month);
    try {
      const res = await fetch("/api/ponto/admin/payslips/send-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Erro ao enviar"); return; }
      if (data.count === 0) {
        toast.error(data.message || "Sem recibos para enviar neste mês.");
      } else {
        toast.success(`Registo de ponto enviado à contabilidade: ${data.accountingCount} colaborador(es).`);
      }
      loadStatus();
    } catch {
      toast.error("Erro ao enviar recibos");
    } finally {
      setSendingMonth(null);
    }
  }

  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-9 w-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center"><Mail className="h-5 w-5 text-yellow-700 dark:text-yellow-300" /></div>
        <div>
          <p className="font-semibold">Envio de recibos por email</p>
          <p className="text-xs text-muted-foreground">Todos os dias 25 o registo de ponto é enviado automaticamente para a contabilidade. Aqui pode confirmar o que foi enviado, ver o email exato e reenviar se necessário.</p>
        </div>
      </div>

      {recipients && (
        <div className="grid gap-2 mb-4">
          <div className="rounded-xl border p-3 text-sm">
            <p className="text-xs text-muted-foreground mb-1">Registo de ponto enviado para a contabilidade</p>
            <p className="font-medium break-all">{recipients.accounting.join(", ")}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">A carregar…</p>
      ) : monthList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Ainda não há recibos gerados. Gere os recibos de um mês para poder enviar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-2">Mês</th>
                <th className="py-2 px-2">Estado do envio</th>
                <th className="py-2 pl-2 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {monthList.map((m) => {
                const log = logs[m];
                return (
                  <tr key={m} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{monthLabel(m)}</td>
                    <td className="py-2 px-2">
                      {log ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Enviado a {fmtSentAt(log.sentAt)}
                            <span className="text-xs text-muted-foreground">({log.trigger === "auto" ? "automático" : "manual"})</span>
                          </span>
                          <span className="text-xs text-muted-foreground">Contabilidade: {log.accountingCount} colaborador(es) {log.accountingCount > 0 ? (log.accountingEmailed ? "(ok)" : "(falhou)") : ""}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><XCircle className="h-3.5 w-3.5" /> Ainda não enviado</span>
                      )}
                    </td>
                    <td className="py-2 pl-2">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openPreview(m)}><Eye className="h-4 w-4 mr-1" />Ver email</Button>
                        <Button size="sm" onClick={() => sendMonth(m)} disabled={sendingMonth === m} style={{ backgroundColor: "#feca00", color: "#1f2937" }}>
                          {sendingMonth === m ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                          {log ? "Reenviar" : "Enviar agora"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pré-visualização do email — {previewMonth ? monthLabel(previewMonth) : ""}</DialogTitle>
          </DialogHeader>
          {previewData?.recipients && !previewData?.empty && (
            <p className="text-xs text-muted-foreground mb-1"><strong>Para:</strong> {previewData.recipients.join(", ")}</p>
          )}
          {previewData?.subject && !previewData?.empty && (
            <p className="text-xs text-muted-foreground mb-2"><strong>Assunto:</strong> {previewData.subject}</p>
          )}
          <div className="border rounded-xl overflow-hidden bg-white" style={{ height: "60vh" }}>
            {previewLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm"><Loader2 className="h-4 w-4 mr-2 animate-spin" />A carregar…</div>
            ) : previewData?.empty ? (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-6 text-center">{previewData.message}</div>
            ) : previewData?.html ? (
              <iframe title="Pré-visualização do email" srcDoc={previewData.html} className="w-full h-full" style={{ border: 0 }} />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm p-6 text-center">{previewData?.message || "Sem conteúdo."}</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Cartão para escolher QUE colaboradores entram no envio mensal dos recibos
// para a contabilidade. Cada interruptor grava o campo sendToAccounting do
// colaborador (endpoint PATCH /api/ponto/admin/users/[id]).
function AccountingInclusionCard() {
  const [users, setUsers] = useState<UserT[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/ponto/admin/users");
      const data = await res.json();
      if (res.ok) setUsers(data.users ?? []);
    } catch {
      toast.error("Erro ao carregar colaboradores");
    } finally {
      setLoadingUsers(false);
    }
  }, []);
  useEffect(() => { loadUsers(); }, [loadUsers]);
  const colaboradores = users.filter((u) => u.role === "COLABORADOR");
  return (
    <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><Receipt className="h-5 w-5 text-emerald-700 dark:text-emerald-300" /></div>
        <div>
          <p className="font-semibold">Quem entra no envio à contabilidade</p>
          <p className="text-xs text-muted-foreground">Escolha os colaboradores cujos recibos são incluídos no envio mensal para a contabilidade. Ligue o interruptor de cada colaborador que deve ser enviado.</p>
        </div>
      </div>
      {loadingUsers ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : colaboradores.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Ainda não há colaboradores.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {colaboradores.map((u) => (
            <div key={u.id} className="rounded-xl border p-3">
              <p className="font-medium text-sm truncate">{u.name}</p>
              <p className="text-xs text-muted-foreground truncate mb-2">{u.email}</p>
              <AccountingToggle user={u} onChanged={loadUsers} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PayslipsTab() {
  const [profiles, setProfiles] = useState<ProfileT[]>([]);
  const [saved, setSaved] = useState<PayslipT[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [savingProfiles, setSavingProfiles] = useState(false);
  const [draftMonth, setDraftMonth] = useState("");
  const [draft, setDraft] = useState<DraftEntry[] | null>(null);
  const [genMonth, setGenMonth] = useState(currentMonth());
  const [generating, setGenerating] = useState(false);
  const [savingProfileId, setSavingProfileId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rp, rs] = await Promise.all([
        fetch("/api/ponto/admin/salary-profiles"),
        fetch("/api/ponto/admin/payslips"),
      ]);
      const dp = await rp.json();
      const ds = await rs.json();
      if (rp.ok) setProfiles(dp.profiles ?? []);
      if (rs.ok) setSaved(ds.payslips ?? []);
    } catch {
      toast.error("Erro ao carregar dados de recibos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleExtract() {
    if (!file) { toast.error("Selecione um ficheiro PDF"); return; }
    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ponto/admin/payslips/extract", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || data.error || "Falha na leitura do PDF"); return; }
      setDraftMonth(data.month || "");
      setDraft(data.entries || []);
      toast.success(`${(data.entries || []).length} recibo(s) lido(s). Reveja antes de criar os perfis.`);
    } catch {
      toast.error("Erro ao ler o PDF");
    } finally {
      setExtracting(false);
    }
  }

  function updateDraft(idx: number, field: keyof DraftEntry, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const copy = [...prev];
      const numeric = field !== "name" && field !== "category" && field !== "employeeNumber";
      copy[idx] = { ...copy[idx], [field]: numeric ? (parseFloat(value.replace(",", ".")) || 0) : value };
      return copy;
    });
  }

  function removeDraftRow(idx: number) {
    setDraft((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  async function handleSaveProfiles() {
    if (!draft || draft.length === 0) { toast.error("Nada para guardar"); return; }
    if (!/^\d{4}-\d{2}$/.test(draftMonth)) { toast.error("Indique o mês de referência (AAAA-MM)"); return; }
    setSavingProfiles(true);
    try {
      const res = await fetch("/api/ponto/admin/salary-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refMonth: draftMonth, entries: draft }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || data.error || "Erro ao guardar perfis"); return; }
      toast.success(`${data.saved} perfil(is) salarial(is) criado(s)/atualizado(s).`);
      setDraft(null);
      setDraftMonth("");
      setFile(null);
      loadAll();
    } catch {
      toast.error("Erro ao guardar perfis");
    } finally {
      setSavingProfiles(false);
    }
  }

  function updateProfileField(id: string, field: keyof ProfileT, value: string) {
    setProfiles((prev) => prev.map((p) => p.id === id ? { ...p, [field]: parseFloat(value.replace(",", ".")) || 0 } : p));
  }

  async function saveProfile(p: ProfileT) {
    setSavingProfileId(p.id);
    try {
      const res = await fetch(`/api/ponto/admin/salary-profiles/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vencimentoBase: p.vencimentoBase, periodRate: p.periodRate, mealPerDay: p.mealPerDay, subsFerias: p.subsFerias, subsNatal: p.subsNatal }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || "Erro ao guardar"); return; }
      toast.success("Perfil atualizado");
    } catch {
      toast.error("Erro ao guardar perfil");
    } finally {
      setSavingProfileId(null);
    }
  }

  async function deleteProfile(id: string) {
    if (!confirm("Eliminar este perfil salarial?")) return;
    try {
      const res = await fetch(`/api/ponto/admin/salary-profiles/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao eliminar"); return; }
      toast.success("Perfil eliminado");
      loadAll();
    } catch {
      toast.error("Erro ao eliminar perfil");
    }
  }

  async function handleGenerate() {
    if (!/^\d{4}-\d{2}$/.test(genMonth)) { toast.error("Indique o mês (AAAA-MM)"); return; }
    setGenerating(true);
    try {
      const res = await fetch("/api/ponto/admin/payslips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: genMonth }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.message || data.error || "Erro ao gerar recibos"); return; }
      toast.success(`${data.count} recibo(s) gerado(s) para ${monthLabel(genMonth)}.`);
      loadAll();
    } catch {
      toast.error("Erro ao gerar recibos");
    } finally {
      setGenerating(false);
    }
  }

  async function deletePayslip(id: string) {
    if (!confirm("Eliminar este recibo?")) return;
    try {
      const res = await fetch(`/api/ponto/admin/payslips/${id}`, { method: "DELETE" });
      if (!res.ok) { toast.error("Erro ao eliminar"); return; }
      toast.success("Recibo eliminado");
      loadAll();
    } catch {
      toast.error("Erro ao eliminar recibo");
    }
  }

  // Totais acumulados por colaborador
  const perCollab = (() => {
    const map = new Map<string, { name: string; category?: string | null; count: number; iliquido: number; descontos: number; liquido: number }>();
    for (const p of saved) {
      const cur = map.get(p.name) || { name: p.name, category: p.category, count: 0, iliquido: 0, descontos: 0, liquido: 0 };
      cur.count += 1;
      cur.iliquido += p.totalIliquido || 0;
      cur.descontos += p.totalDescontos || 0;
      cur.liquido += p.liquido || 0;
      map.set(p.name, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  })();

  const grandTotal = perCollab.reduce((acc, c) => { acc.iliquido += c.iliquido; acc.descontos += c.descontos; acc.liquido += c.liquido; return acc; }, { iliquido: 0, descontos: 0, liquido: 0 });

  // Agrupar por mês (desc)
  const byMonth = (() => {
    const map = new Map<string, PayslipT[]>();
    for (const p of saved) {
      const arr = map.get(p.month) || [];
      arr.push(p);
      map.set(p.month, arr);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  })();

  // Dados para o gráfico de evolução (líquido por mês por colaborador)
  const collabNames = Array.from(new Set(saved.map((p) => p.name))).sort((a, b) => a.localeCompare(b));
  const chartData = (() => {
    const months = Array.from(new Set(saved.map((p) => p.month))).sort();
    return months.map((m) => {
      const row: any = { month: monthLabel(m) };
      for (const name of collabNames) {
        const rec = saved.find((p) => p.month === m && p.name === name);
        row[name] = rec ? Math.round((rec.liquido || 0) * 100) / 100 : 0;
      }
      return row;
    });
  })();

  return (
    <div className="space-y-6">
      {/* ===== A. Perfis salariais ===== */}
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-xl bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center"><Upload className="h-5 w-5 text-yellow-700 dark:text-yellow-300" /></div>
          <div>
            <p className="font-semibold">Perfis salariais</p>
            <p className="text-xs text-muted-foreground">Importe uma vez o PDF de recibos para aprender a estrutura salarial de cada colaborador. Os recibos passam depois a ser gerados automaticamente a partir dos pontos.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input type="file" accept="application/pdf" className="max-w-xs" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <Button onClick={handleExtract} disabled={extracting || !file} style={{ backgroundColor: "#feca00", color: "#1f2937" }}>
            {extracting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileText className="h-4 w-4 mr-1" />}
            {extracting ? "A ler…" : "Ler PDF"}
          </Button>
        </div>

        {draft && (
          <div className="mt-5 border-t pt-4">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold mb-1 text-sm">Rever antes de criar os perfis</p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="ref-month" className="text-xs">Mês de referência</Label>
                  <Input id="ref-month" value={draftMonth} onChange={(e) => setDraftMonth(e.target.value)} placeholder="2026-06" className="w-32 h-8" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setDraft(null); setDraftMonth(""); }}>Cancelar</Button>
                <Button size="sm" onClick={handleSaveProfiles} disabled={savingProfiles} style={{ backgroundColor: "#feca00", color: "#1f2937" }}>
                  {savingProfiles ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}Criar perfis
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-2">Colaborador</th>
                    <th className="py-2 px-2 text-right">Venc. base</th>
                    <th className="py-2 px-2 text-right">Subs. alim.</th>
                    <th className="py-2 px-2 text-right">Subs. férias</th>
                    <th className="py-2 px-2 text-right">Subs. Natal</th>
                    <th className="py-2 px-2 text-right">Seg. Social</th>
                    <th className="py-2 px-2 text-right">IRS</th>
                    <th className="py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.map((e, idx) => (
                    <tr key={idx} className="border-b last:border-0">
                      <td className="py-2 pr-2">
                        <Input value={e.name} onChange={(ev) => updateDraft(idx, "name", ev.target.value)} className="h-8 min-w-[160px]" />
                        {e.category ? <span className="text-xs text-muted-foreground block mt-0.5">{e.category}</span> : null}
                      </td>
                      <td className="py-2 px-2"><Input value={String(e.vencimentoBase)} onChange={(ev) => updateDraft(idx, "vencimentoBase", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(e.subsAlimentacao)} onChange={(ev) => updateDraft(idx, "subsAlimentacao", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(e.subsFerias)} onChange={(ev) => updateDraft(idx, "subsFerias", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(e.subsNatal)} onChange={(ev) => updateDraft(idx, "subsNatal", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(e.segSocial)} onChange={(ev) => updateDraft(idx, "segSocial", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(e.irs)} onChange={(ev) => updateDraft(idx, "irs", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 pl-2 text-right"><Button size="sm" variant="ghost" onClick={() => removeDraftRow(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground mt-2">A partir destes valores calculamos o subsídio de alimentação por dia e as taxas de Segurança Social e de IRS. O IRS é o definido pelo Estado e não é editável.</p>
            </div>
          </div>
        )}

        <div className="mt-5 border-t pt-4">
          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Ainda não há perfis salariais. Importe um PDF para começar.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-2">Colaborador</th>
                    <th className="py-2 px-2 text-right">Venc. base</th>
                    <th className="py-2 px-2 text-right">Valor/período<span className="block text-[10px] font-normal normal-case text-muted-foreground">(part-time)</span></th>
                    <th className="py-2 px-2 text-right">Alim./dia</th>
                    <th className="py-2 px-2 text-right">Subs. férias</th>
                    <th className="py-2 px-2 text-right">Subs. Natal</th>
                    <th className="py-2 px-2 text-center">Seg. Social</th>
                    <th className="py-2 px-2 text-center">IRS (Estado)</th>
                    <th className="py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-medium">{p.name}{p.category ? <span className="text-xs text-muted-foreground block">{p.category}</span> : null}{!p.user ? <span className="text-xs text-amber-600 block">sem conta associada</span> : null}</td>
                      <td className="py-2 px-2"><Input value={String(p.vencimentoBase)} onChange={(ev) => updateProfileField(p.id, "vencimentoBase", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(p.periodRate)} onChange={(ev) => updateProfileField(p.id, "periodRate", ev.target.value)} className="h-8 w-20 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(p.mealPerDay)} onChange={(ev) => updateProfileField(p.id, "mealPerDay", ev.target.value)} className="h-8 w-20 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(p.subsFerias)} onChange={(ev) => updateProfileField(p.id, "subsFerias", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2"><Input value={String(p.subsNatal)} onChange={(ev) => updateProfileField(p.id, "subsNatal", ev.target.value)} className="h-8 w-24 text-right" /></td>
                      <td className="py-2 px-2 text-center text-muted-foreground">{(p.ssRate * 100).toFixed(1)}%</td>
                      <td className="py-2 px-2 text-center text-muted-foreground">{(p.irsRate * 100).toFixed(1)}%</td>
                      <td className="py-2 pl-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => saveProfile(p)} disabled={savingProfileId === p.id}>{savingProfileId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 text-emerald-600" />}</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteProfile(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ===== B. Gerar recibos ===== */}
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-9 w-9 rounded-xl bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center"><Receipt className="h-5 w-5 text-sky-600 dark:text-sky-300" /></div>
          <div>
            <p className="font-semibold">Gerar recibos do mês</p>
            <p className="text-xs text-muted-foreground">Os recibos são calculados a partir dos pontos: as faltas (justificadas ou injustificadas) descontam proporcionalmente aos dias trabalhados. Os subsídios de férias e de Natal são pagos em duodécimos. Para colaboradores a part-time, o vencimento é calculado pelo valor por período (manhã/tarde) definido no perfil. Todos os dias 25 o registo de ponto é gerado e enviado automaticamente para a contabilidade.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Input value={genMonth} onChange={(e) => setGenMonth(e.target.value)} placeholder="2026-06" className="w-32 h-9" />
          <Button onClick={handleGenerate} disabled={generating || profiles.length === 0} style={{ backgroundColor: "#feca00", color: "#1f2937" }}>
            {generating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {generating ? "A gerar…" : "Gerar recibos"}
          </Button>
        </div>
      </div>
      {/* ===== B1. Quem entra no envio à contabilidade ===== */}
      <AccountingInclusionCard />

      {/* ===== B2. Envio por email ===== */}
      <PayslipEmailCard months={byMonth.map(([m]) => m)} />

      {/* ===== C. Evolução ===== */}
      <div className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center"><BarChart3 className="h-5 w-5 text-emerald-600 dark:text-emerald-300" /></div>
          <p className="font-semibold">Evolução do líquido por colaborador</p>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Ainda não há recibos gerados para mostrar a evolução.</p>
        ) : (
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
                <RTooltip formatter={(v: any) => eur(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {collabNames.map((name, i) => (
                  <Line key={name} type="monotone" dataKey={name} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {perCollab.length > 0 && (
          <div className="overflow-x-auto mt-5">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b">
                  <th className="py-2 pr-2">Colaborador</th>
                  <th className="py-2 px-2 text-center">Meses</th>
                  <th className="py-2 px-2 text-right">Total Ilíquido</th>
                  <th className="py-2 px-2 text-right">Descontos</th>
                  <th className="py-2 px-2 text-right">Líquido acumulado</th>
                </tr>
              </thead>
              <tbody>
                {perCollab.map((c) => (
                  <tr key={c.name} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{c.name}{c.category ? <span className="text-xs text-muted-foreground block">{c.category}</span> : null}</td>
                    <td className="py-2 px-2 text-center">{c.count}</td>
                    <td className="py-2 px-2 text-right">{eur(c.iliquido)}</td>
                    <td className="py-2 px-2 text-right text-rose-600">{eur(c.descontos)}</td>
                    <td className="py-2 px-2 text-right font-semibold">{eur(c.liquido)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold bg-muted/40">
                  <td className="py-2 pr-2" colSpan={2}>TOTAL</td>
                  <td className="py-2 px-2 text-right">{eur(grandTotal.iliquido)}</td>
                  <td className="py-2 px-2 text-right text-rose-600">{eur(grandTotal.descontos)}</td>
                  <td className="py-2 px-2 text-right">{eur(grandTotal.liquido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Detalhe por mês */}
      {byMonth.map(([month, rows]) => {
        const mt = rows.reduce((a, p) => { a.pr += p.premioAssiduidade || 0; a.du += (p.subsFerias || 0) + (p.subsNatal || 0); a.il += p.totalIliquido || 0; a.de += p.totalDescontos || 0; a.li += p.liquido || 0; return a; }, { pr: 0, du: 0, il: 0, de: 0, li: 0 });
        return (
          <div key={month} className="bg-card rounded-2xl p-5" style={{ boxShadow: "var(--shadow-sm)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="font-semibold">{monthLabel(month)}</p>
              <span className="text-xs text-muted-foreground">({rows.length} recibo(s))</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b">
                    <th className="py-2 pr-2">Colaborador</th>
                    <th className="py-2 px-2 text-center">Dias trab.</th>
                    <th className="py-2 px-2 text-center">Faltas injustificadas</th>
                    <th className="py-2 px-2 text-center">Faltas justificadas</th>
                    <th className="py-2 px-2 text-center">Férias</th>
                    <th className="py-2 px-2 text-right">Prémio assid.</th>
                    <th className="py-2 px-2 text-right">Duodécimos</th>
                    <th className="py-2 px-2 text-right">Total Ilíquido</th>
                    <th className="py-2 px-2 text-right">Descontos</th>
                    <th className="py-2 px-2 text-right">Líquido</th>
                    <th className="py-2 pl-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-2">{p.name}{p.category ? <span className="text-xs text-muted-foreground block">{p.category}</span> : null}</td>
                      <td className="py-2 px-2 text-center">{p.daysWorked ?? "—"}{p.workingDays ? <span className="text-xs text-muted-foreground">/{p.workingDays}</span> : null}</td>
                      <td className="py-2 px-2 text-center">{(p.absInjustDays ?? 0) || "—"}</td>
                      <td className="py-2 px-2 text-center">{(p.absJustDays ?? 0) || "—"}</td>
                      <td className="py-2 px-2 text-center">{(p.feriasDays ?? 0) || "—"}</td>
                      <td className="py-2 px-2 text-right">{(p.premioAssiduidade ?? 0) > 0 ? <span className="text-emerald-700 dark:text-emerald-300 font-medium">{eur(p.premioAssiduidade ?? 0)}</span> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 px-2 text-right">{((p.subsFerias ?? 0) + (p.subsNatal ?? 0)) > 0 ? eur((p.subsFerias ?? 0) + (p.subsNatal ?? 0)) : <span className="text-muted-foreground">—</span>}</td>
                      <td className="py-2 px-2 text-right">{eur(p.totalIliquido)}</td>
                      <td className="py-2 px-2 text-right text-rose-600">{eur(p.totalDescontos)}</td>
                      <td className="py-2 px-2 text-right font-semibold">{eur(p.liquido)}</td>
                      <td className="py-2 pl-2 text-right whitespace-nowrap"><Button size="sm" variant="ghost" title="Descarregar recibo em PDF" onClick={() => window.open(`/api/ponto/recibo/${p.id}`, "_blank")}><Download className="h-4 w-4" /></Button><Button size="sm" variant="ghost" title="Descarregar registo de assiduidade em PDF" onClick={() => window.open(`/api/ponto/assiduidade/${p.id}`, "_blank")}><CalendarCheck className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => deletePayslip(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-semibold bg-muted/30">
                    <td className="py-2 pr-2" colSpan={5}>Total do mês</td>
                    <td className="py-2 px-2 text-right">{eur(mt.pr)}</td>
                    <td className="py-2 px-2 text-right">{eur(mt.du)}</td>
                    <td className="py-2 px-2 text-right">{eur(mt.il)}</td>
                    <td className="py-2 px-2 text-right text-rose-600">{eur(mt.de)}</td>
                    <td className="py-2 px-2 text-right">{eur(mt.li)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}