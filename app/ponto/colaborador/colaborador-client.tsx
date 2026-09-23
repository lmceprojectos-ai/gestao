"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  Clock, Wifi, WifiOff, LogIn, Coffee, Utensils, LogOut, Plus,
  Loader2, CalendarX2, History, FileText, Upload, CheckCircle2, XCircle,
  Timer, AlertTriangle, MonitorSmartphone, Send, Palmtree, Trash2, Camera, ScanLine, CameraOff, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatTime, formatDateStr, todayStr } from "@/lib/ponto/format";
import { PUNCH_LABELS, ABSENCE_LABELS, formatMinutes } from "@/lib/ponto/schedule";
import { monthLabel } from "@/lib/ponto/payslip";
import { FichaColaborador } from "./ficha-colaborador";
import { IdCard } from "lucide-react";

type Punch = {
  id: string; type: string; timestamp: string; ipAddress?: string | null;
  device?: string | null; lateMinutes: number; extraMinutes: number;
  delayReason?: string | null;
};
type Absence = {
  id: string; absenceDate: string; status: string; reason?: string | null;
  observation?: string | null; attachmentName?: string | null; decisionNote?: string | null;
};
type Vacation = {
  id: string; startDate: string; endDate: string; days: number; status: string;
  reason?: string | null; decisionNote?: string | null;
};
type BonusStatus = {
  month: string; value: number; maxDelays: number; effective: boolean;
  qualified: boolean; amount: number; absInjustDays: number;
  unjustifiedDelays: number; maxUnjustifiedDelayMinutes: number; taskMisses?: number; reasons: string[];
};

const VAC_LABELS: Record<string, string> = {
  PENDENTE: "Pendente de aprovação",
  APROVADA: "Aprovado",
  REJEITADA: "Rejeitado",
};
function vacBadge(status: string) {
  const map: Record<string, string> = {
    PENDENTE: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    APROVADA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    REJEITADA: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  };
  return map[status] ?? "bg-secondary text-secondary-foreground";
}

const PUNCH_BUTTONS = [
  { type: "ENTRADA", icon: LogIn, color: "bg-emerald-600 hover:bg-emerald-700" },
  { type: "SAIDA_ALMOCO", icon: Coffee, color: "bg-amber-600 hover:bg-amber-700" },
  { type: "REGRESSO_ALMOCO", icon: Utensils, color: "bg-sky-600 hover:bg-sky-700" },
  { type: "SAIDA_FINAL", icon: LogOut, color: "bg-rose-600 hover:bg-rose-700" },
  { type: "HORA_EXTRA", icon: Plus, color: "bg-violet-600 hover:bg-violet-700" },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    POR_JUSTIFICAR: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    EM_ANALISE: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    JUSTIFICADA: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    INJUSTIFICADA: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  };
  return map[status] ?? "bg-secondary text-secondary-foreground";
}

export function ColaboradorClient({ userName, partTime }: { userName: string; partTime?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  const [diaCompleto, setDiaCompleto] = useState(false);
  const [network, setNetwork] = useState<{ ip: string; allowed: boolean; device: string; requireQr?: boolean } | null>(null);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  // Leitor de câmara para ler o QR rotativo mostrado na conta do administrador
  const [scanOpen, setScanOpen] = useState(false);
  const [scanType, setScanType] = useState<string | null>(null);
  const [scanStarting, setScanStarting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<any>(null);
  const handlingRef = useRef(false);

  // formulário falta
  const [absDate, setAbsDate] = useState(todayStr());
  const [absReason, setAbsReason] = useState("");
  const [absObs, setAbsObs] = useState("");
  const [absFile, setAbsFile] = useState<File | null>(null);
  const [absType, setAbsType] = useState<"JUSTIFICADA" | "INJUSTIFICADA">("JUSTIFICADA");
  const [submittingAbs, setSubmittingAbs] = useState(false);

  // férias
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [vacPeriods, setVacPeriods] = useState<{ start: string; end: string }[]>([{ start: "", end: "" }]);
  const [vacReason, setVacReason] = useState("");
  const [submittingVac, setSubmittingVac] = useState(false);

  // Justificação de atraso (> 5 min)
  const [bonus, setBonus] = useState<BonusStatus | null>(null);
  const [delayRecord, setDelayRecord] = useState<Punch | null>(null);
  const [delayText, setDelayText] = useState("");
  const [submittingDelay, setSubmittingDelay] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadNetwork = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/network");
      const data = await res.json();
      setNetwork(data);
    } catch { /* ignore */ }
  }, []);

  const loadPunches = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/punch");
      if (res.ok) {
        const data = await res.json();
        setPunches(data?.punches ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadAbsences = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/absences");
      if (res.ok) {
        const data = await res.json();
        setAbsences(data?.absences ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadVacations = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/vacations");
      if (res.ok) {
        const data = await res.json();
        setVacations(data?.vacations ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  const loadBonus = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/bonus-status");
      if (res.ok) {
        const data = await res.json();
        setBonus(data ?? null);
      }
    } catch { /* ignore */ }
  }, []);

  const submitDelayReason = useCallback(async () => {
    if (!delayRecord) return;
    if (delayText.trim().length < 3) {
      toast.error("Descreva o motivo do atraso.");
      return;
    }
    setSubmittingDelay(true);
    try {
      const res = await fetch("/api/ponto/punch/delay-reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: delayRecord.id, reason: delayText.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Motivo do atraso registado.");
        setDelayRecord(null);
        setDelayText("");
        loadPunches();
        loadBonus();
      } else {
        toast.error(data?.message ?? "Erro ao guardar o motivo.");
      }
    } catch {
      toast.error("Erro ao guardar o motivo do atraso.");
    } finally {
      setSubmittingDelay(false);
    }
  }, [delayRecord, delayText, loadPunches, loadBonus]);

  useEffect(() => {
    loadNetwork();
    loadPunches();
    loadAbsences();
    loadVacations();
    loadBonus();
    const t = setInterval(loadNetwork, 30000);
    return () => clearInterval(t);
  }, [loadNetwork, loadPunches, loadAbsences, loadVacations, loadBonus]);

  const submitPunch = useCallback(async (type: string, qrToken: string) => {
    setLoadingType(type);
    try {
      const res = await fetch("/api/ponto/punch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, qrToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Erro ao registar marcação.");
      } else {
        const late = data?.record?.lateMinutes ?? 0;
        const extra = data?.record?.extraMinutes ?? 0;
        let msg = `${PUNCH_LABELS[type]} registada com sucesso.`;
        if (late > 0) msg += ` Atraso: ${formatMinutes(late)}.`;
        if (extra > 0) msg += ` Hora extra: ${formatMinutes(extra)}.`;
        toast.success(msg);
        loadPunches();
        loadBonus();
      }
    } catch {
      toast.error("Erro ao registar marcação.");
    } finally {
      setLoadingType(null);
    }
  }, [loadPunches, loadBonus]);

  const stopScanner = useCallback(async () => {
    const inst = scannerRef.current;
    scannerRef.current = null;
    if (inst) {
      try { await inst.stop(); } catch { /* ignore */ }
      try { await inst.clear(); } catch { /* ignore */ }
    }
  }, []);

  const handleDecoded = useCallback((decoded: string) => {
    if (handlingRef.current) return;
    handlingRef.current = true;
    let token = decoded;
    try {
      // Aceita tanto o token puro como um endereço com ?qr=<token>
      if (decoded.includes("qr=")) {
        const u = new URL(decoded);
        token = u.searchParams.get("qr") ?? decoded;
      }
    } catch { /* usa o texto tal como veio */ }
    const type = scanType;
    stopScanner();
    setScanOpen(false);
    if (type) submitPunch(type, token);
    setTimeout(() => { handlingRef.current = false; }, 1500);
  }, [scanType, stopScanner, submitPunch]);

  const startScanner = useCallback(async () => {
    setScanError(null);
    setScanStarting(true);
    try {
      const mod = await import("html5-qrcode");
      const instance = new mod.Html5Qrcode("qr-reader-colab");
      scannerRef.current = instance;
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (text: string) => handleDecoded(text),
        () => { /* ignora falhas de leitura por frame */ },
      );
    } catch {
      setScanError("Não foi possível aceder à câmara. Autorize o acesso à câmara e utilize uma ligação segura (HTTPS).");
      await stopScanner();
    } finally {
      setScanStarting(false);
    }
  }, [handleDecoded, stopScanner]);

  function openScanner(type: string) {
    setScanType(type);
    setScanError(null);
    handlingRef.current = false;
    setScanOpen(true);
  }

  // Arranca/pára a câmara conforme o diálogo abre/fecha.
  useEffect(() => {
    if (scanOpen) {
      startScanner();
    }
    return () => { stopScanner(); };
  }, [scanOpen, startScanner, stopScanner]);

  async function handleSubmitAbsence(e: React.FormEvent) {
    e.preventDefault();
    if (!absDate || !absReason.trim()) {
      toast.error("Preencha a data e o motivo da falta.");
      return;
    }
    if (absType === "JUSTIFICADA" && !absFile) {
      toast.error("Para uma falta justificada tem de anexar o comprovativo.");
      return;
    }
    setSubmittingAbs(true);
    try {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      if (absFile) {
        const presRes = await fetch("/api/ponto/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: absFile.name, contentType: absFile.type || "application/octet-stream" }),
        });
        if (!presRes.ok) throw new Error("presigned");
        const pres = await presRes.json();
        const put = await fetch(pres.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": absFile.type || "application/octet-stream" },
          body: absFile,
        });
        if (!put.ok) throw new Error("upload");
        attachmentPath = pres.cloud_storage_path;
        attachmentName = absFile.name;
      }
      const res = await fetch("/api/ponto/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ absenceDate: absDate, reason: absReason, observation: absObs, attachmentPath, attachmentName, declaredType: absType }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Erro ao submeter falta.");
      } else {
        toast.success(absType === "JUSTIFICADA" ? "Falta justificada submetida. O administrador foi notificado." : "Falta injustificada registada.");
        setAbsReason(""); setAbsObs(""); setAbsFile(null); setAbsDate(todayStr()); setAbsType("JUSTIFICADA");
        loadAbsences();
      }
    } catch {
      toast.error("Erro ao submeter justificação.");
    } finally {
      setSubmittingAbs(false);
    }
  }

  function addVacPeriod() {
    setVacPeriods((prev) => [...prev, { start: "", end: "" }]);
  }
  function removeVacPeriod(idx: number) {
    setVacPeriods((prev) => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx));
  }
  function updateVacPeriod(idx: number, field: "start" | "end", value: string) {
    setVacPeriods((prev) => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  async function handleSubmitVacation(e: React.FormEvent) {
    e.preventDefault();
    const filled = vacPeriods.filter((p) => p.start && p.end);
    if (filled.length === 0) {
      toast.error("Indique pelo menos um período com data de início e de fim.");
      return;
    }
    for (const p of filled) {
      if (p.end < p.start) {
        toast.error("A data de fim não pode ser anterior à de início.");
        return;
      }
    }
    setSubmittingVac(true);
    try {
      let okCount = 0;
      let lastError = "";
      for (const p of filled) {
        const res = await fetch("/api/ponto/vacations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ startDate: p.start, endDate: p.end, reason: vacReason }),
        });
        const data = await res.json();
        if (res.ok) okCount++;
        else lastError = data?.message ?? "Erro ao submeter pedido de férias.";
      }
      if (okCount > 0) {
        toast.success(okCount === 1 ? "Pedido de férias enviado para aprovação." : `${okCount} períodos de férias enviados para aprovação.`);
        setVacPeriods([{ start: "", end: "" }]); setVacReason("");
        loadVacations();
      }
      if (lastError && okCount === 0) toast.error(lastError);
      else if (lastError) toast.error(`Alguns períodos não foram submetidos: ${lastError}`);
    } catch {
      toast.error("Erro ao submeter pedido de férias.");
    } finally {
      setSubmittingVac(false);
    }
  }

  // Conta dias úteis (seg-sex) do período selecionado, para pré-visualização
  function previewWeekdays(start: string, end: string): number {
    if (!start || !end || end < start) return 0;
    let count = 0;
    const [sy, sm, sd] = start.split("-").map(Number);
    const [ey, em, ed] = end.split("-").map(Number);
    const cur = new Date(Date.UTC(sy, sm - 1, sd));
    const last = new Date(Date.UTC(ey, em - 1, ed));
    while (cur.getTime() <= last.getTime()) {
      const wd = cur.getUTCDay();
      if (wd >= 1 && wd <= 5) count++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
  }
  const vacPreviewDays = vacPeriods.reduce((sum, p) => sum + previewWeekdays(p.start, p.end), 0);

  const doneTypes = new Set(punches.map((p) => p.type));
  // Colaborador a tempo parcial: por defeito marca apenas Entrada e Saída.
  // Com "Dia completo" ativo, mostra também saída/regresso do almoço.
  const visiblePunchButtons = !partTime
    ? PUNCH_BUTTONS
    : diaCompleto
      ? PUNCH_BUTTONS
      : PUNCH_BUTTONS.filter(
          (b) => b.type === "ENTRADA" || b.type === "SAIDA_FINAL" || b.type === "HORA_EXTRA"
        );
  const totalLate = punches.reduce((s, p) => s + (p.lateMinutes ?? 0), 0);
  const totalExtra = punches.reduce((s, p) => s + (p.extraMinutes ?? 0), 0);

  const timeStr = now
    ? new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now)
    : "--:--:--";
  const dateStrFull = now
    ? new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now)
    : "";

  return (
    <main className="mx-auto max-w-[1200px] px-3 sm:px-4 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Olá, {userName}</h1>
        <p className="text-muted-foreground">Marque o seu ponto, justifique faltas e consulte o seu registo do dia.</p>
      </div>

      {bonus?.effective && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-card rounded-2xl p-5"
          style={{ boxShadow: "var(--shadow-sm)" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Award className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold leading-tight">Prémio de assiduidade e pontualidade</p>
                <p className="text-sm text-muted-foreground">
                  {monthLabel(bonus.month)} · {new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(bonus.value)} por mês
                </p>
              </div>
            </div>
            {bonus.qualified ? (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white">
                <CheckCircle2 className="h-4 w-4" />Qualificado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white">
                <XCircle className="h-4 w-4" />Não qualificado
              </span>
            )}
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-muted-foreground">Faltas injustificadas</p>
              <p className="font-semibold">{bonus.absInjustDays} <span className="font-normal text-muted-foreground">(máximo permitido: 0)</span></p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-muted-foreground">Atrasos injustificados (mais de 5 min)</p>
              <p className="font-semibold">{bonus.unjustifiedDelays} <span className="font-normal text-muted-foreground">(máximo permitido: {bonus.maxDelays})</span></p>
            </div>
            <div className="rounded-xl bg-secondary/50 p-3">
              <p className="text-muted-foreground">Dias sem as tarefas diárias cumpridas</p>
              <p className="font-semibold">{bonus.taskMisses ?? 0} <span className="font-normal text-muted-foreground">(máximo permitido: 4)</span></p>
            </div>
          </div>

          {bonus.qualified ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
              Está a cumprir todos os critérios este mês. Se mantiver a assiduidade e a pontualidade até ao fim do mês, o prémio será incluído no seu recibo.
            </p>
          ) : (
            <div className="mt-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Motivos pelos quais ainda não está qualificado este mês:</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {bonus.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="mt-2">Pode justificar os atrasos superiores a 5 minutos no separador «Registo de Hoje» para que não contem para o prémio.</p>
            </div>
          )}
        </motion.div>
      )}

      <Tabs defaultValue="ponto" className="w-full">
        <TabsList className="mb-6 flex w-full flex-wrap justify-start gap-1 h-auto">
          <TabsTrigger value="ponto"><Clock className="h-4 w-4 mr-1" />Marcar Ponto</TabsTrigger>
          <TabsTrigger value="faltas"><CalendarX2 className="h-4 w-4 mr-1" />Faltas</TabsTrigger>
          <TabsTrigger value="ferias"><Palmtree className="h-4 w-4 mr-1" />Férias</TabsTrigger>
          <TabsTrigger value="hist"><History className="h-4 w-4 mr-1" />Registo de Hoje</TabsTrigger>
          <TabsTrigger value="ficha"><IdCard className="h-4 w-4 mr-1" />Ficha</TabsTrigger>
        </TabsList>

        {/* PONTO */}
        <TabsContent value="ponto">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Relógio + rede */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="lg:col-span-1 bg-card rounded-2xl p-6 flex flex-col items-center justify-center text-center" style={{ boxShadow: "var(--shadow-md)" }}>
              <div className="font-mono text-5xl font-bold tracking-tight text-primary">{timeStr}</div>
              <p className="text-muted-foreground capitalize mt-2 text-sm">{dateStrFull}</p>
              <div className="mt-5 w-full">
                {network ? (
                  network.allowed ? (
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <Wifi className="h-4 w-4" /><span className="text-sm font-medium">Ligado à rede da empresa</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                      <WifiOff className="h-4 w-4" /><span className="text-sm font-medium">Fora da rede da empresa</span>
                    </div>
                  )
                ) : (
                  <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary">
                    <Loader2 className="h-4 w-4 animate-spin" /><span className="text-sm">A verificar rede...</span>
                  </div>
                )}
                {network && (
                  <div className="mt-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-mono">IP: {network.ip}</p>
                    <p className="flex items-center justify-center gap-1"><MonitorSmartphone className="h-3 w-3" />{network.device}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-4 leading-relaxed">{partTime ? (diaCompleto ? "Horário: dia completo (manhã e tarde)" : "Tempo parcial: entrada e saída") : "Horário: 09:00–13:00 e 14:30–18:30"}</p>
            </motion.div>

            {/* Botões de marcação */}
            <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
              {partTime && (
                <div className="sm:col-span-2 flex items-center justify-between rounded-2xl bg-card px-5 py-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <div className="pr-3"><p className="font-semibold text-sm">Dia completo (manhã + tarde)</p><p className="text-xs text-muted-foreground">Ative para registar também a saída e o regresso do almoço.</p></div>
                  <Switch checked={diaCompleto} onCheckedChange={setDiaCompleto} />
                </div>
              )}
              {visiblePunchButtons.map((b, i) => {
                const done = doneTypes.has(b.type) && b.type !== "HORA_EXTRA";
                const btnLabel = partTime && !diaCompleto && b.type === "SAIDA_FINAL" ? "Saída" : PUNCH_LABELS[b.type];
                const disabled = !network?.allowed || loadingType !== null || done;
                return (
                  <motion.button
                    key={b.type}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={!disabled ? { scale: 1.02 } : {}}
                    whileTap={!disabled ? { scale: 0.98 } : {}}
                    onClick={() => openScanner(b.type)}
                    disabled={disabled}
                    className={`relative rounded-2xl p-6 text-white text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed ${b.color}`}
                    style={{ boxShadow: "var(--shadow-md)" }}
                  >
                    <div className="flex items-center justify-between">
                      <b.icon className="h-7 w-7" />
                      {loadingType === b.type && <Loader2 className="h-5 w-5 animate-spin" />}
                      {done && <CheckCircle2 className="h-5 w-5" />}
                    </div>
                    <p className="mt-4 font-semibold text-lg">{btnLabel}</p>
                    <p className="text-white/80 text-sm">{done ? "Já registado hoje" : "Tocar e ler o QR do administrador"}</p>
                  </motion.button>
                );
              })}
              <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                <div className="rounded-2xl p-5 bg-card flex items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center"><Timer className="h-5 w-5 text-amber-600 dark:text-amber-300" /></div>
                  <div><p className="text-xs text-muted-foreground">Atraso hoje</p><p className="font-bold text-lg">{formatMinutes(totalLate)}</p></div>
                </div>
                <div className="rounded-2xl p-5 bg-card flex items-center gap-3" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <div className="h-10 w-10 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center"><Plus className="h-5 w-5 text-violet-600 dark:text-violet-300" /></div>
                  <div><p className="text-xs text-muted-foreground">Horas extra hoje</p><p className="font-bold text-lg">{formatMinutes(totalExtra)}</p></div>
                </div>
              </div>
            </div>
          </div>

          {/* Como validar a marcação */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-md)" }}>
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <ScanLine className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-display text-xl font-bold tracking-tight">Como validar a marcação</h2>
                <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                  Escolha a marcação pretendida e abra a câmara. Aponte ao QR que aparece na conta do
                  administrador — que se renova a cada 30 segundos. A marcação só é registada depois de ler esse código.
                </p>
              </div>
            </div>
          </motion.div>
        </TabsContent>

        {/* FALTAS */}
        <TabsContent value="faltas">
          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-md)" }}>
              <h2 className="font-display text-xl font-bold tracking-tight mb-1 flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Registar falta</h2>
              <p className="text-muted-foreground text-sm mb-5">Indique se a falta é justificada (com comprovativo) ou injustificada.</p>
              <form onSubmit={handleSubmitAbsence} className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de falta</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setAbsType("JUSTIFICADA")}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${absType === "JUSTIFICADA" ? "bg-emerald-600 text-white border-emerald-600" : "bg-secondary text-muted-foreground border-transparent hover:bg-accent"}`}>
                      Justificada
                    </button>
                    <button type="button" onClick={() => setAbsType("INJUSTIFICADA")}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors ${absType === "INJUSTIFICADA" ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-200 dark:border-rose-700" : "bg-secondary text-muted-foreground border-transparent hover:bg-accent"}`}>
                      Injustificada
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="absDate">Dia da falta</Label>
                  <Input id="absDate" type="date" value={absDate} onChange={(e) => setAbsDate(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="absReason">Motivo</Label>
                  <Input id="absReason" value={absReason} onChange={(e) => setAbsReason(e.target.value)} placeholder="Ex.: Consulta médica" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="absObs">Observação (opcional)</Label>
                  <Textarea id="absObs" value={absObs} onChange={(e) => setAbsObs(e.target.value)} placeholder="Detalhes adicionais..." rows={3} />
                </div>
                {absType === "JUSTIFICADA" ? (
                  <div className="space-y-2">
                    <Label htmlFor="absFile">Comprovativo (foto/documento) <span className="text-rose-600">*</span></Label>
                    <div className="flex items-center gap-3">
                      <label htmlFor="absFile" className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-accent transition-colors text-sm">
                        <Upload className="h-4 w-4" />Escolher ficheiro
                      </label>
                      <span className="text-sm text-muted-foreground truncate">{absFile?.name ?? "Nenhum ficheiro"}</span>
                      <input id="absFile" type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setAbsFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <p className="text-xs text-muted-foreground">Obrigatório anexar o comprovativo para a falta ser considerada justificada.</p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
                    Uma falta injustificada pode implicar desconto na remuneração do mês.
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={submittingAbs}>
                  {submittingAbs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submeter falta
                </Button>
              </form>
            </motion.div>

            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold tracking-tight">As minhas faltas</h2>
              {absences.length === 0 ? (
                <div className="bg-card rounded-2xl p-8 text-center text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <CalendarX2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Sem faltas registadas.</p>
                </div>
              ) : (
                absences.map((a, i) => (
                  <motion.div key={a.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="bg-card rounded-2xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{formatDateStr(a.absenceDate)}</p>
                        <p className="text-sm text-muted-foreground">{a.reason ?? "—"}</p>
                        {a.observation && <p className="text-xs text-muted-foreground mt-1">{a.observation}</p>}
                        {a.attachmentName && <p className="text-xs text-primary mt-1 flex items-center gap-1"><FileText className="h-3 w-3" />{a.attachmentName}</p>}
                        {a.decisionNote && <p className="text-xs italic text-muted-foreground mt-1">Nota: {a.decisionNote}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${statusBadge(a.status)}`}>{ABSENCE_LABELS[a.status]}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* FÉRIAS */}
        <TabsContent value="ferias">
          <div className="grid lg:grid-cols-2 gap-6">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-md)" }}>
              <h2 className="font-display text-xl font-bold tracking-tight mb-1 flex items-center gap-2"><Palmtree className="h-5 w-5 text-primary" />Solicitar férias</h2>
              <p className="text-muted-foreground text-sm mb-5">Escolha o período pretendido. O pedido segue para aprovação da administração.</p>
              <form onSubmit={handleSubmitVacation} className="space-y-4">
                <div className="space-y-3">
                  {vacPeriods.map((p, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                      <div className="space-y-2">
                        <Label htmlFor={`vacStart-${idx}`}>Início{vacPeriods.length > 1 ? ` ${idx + 1}` : ""}</Label>
                        <Input id={`vacStart-${idx}`} type="date" value={p.start} onChange={(e) => updateVacPeriod(idx, "start", e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`vacEnd-${idx}`}>Fim{vacPeriods.length > 1 ? ` ${idx + 1}` : ""}</Label>
                        <Input id={`vacEnd-${idx}`} type="date" value={p.end} min={p.start || undefined} onChange={(e) => updateVacPeriod(idx, "end", e.target.value)} />
                      </div>
                      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => removeVacPeriod(idx)} disabled={vacPeriods.length === 1} title="Remover período">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" className="w-full" onClick={addVacPeriod}>
                    <Plus className="h-4 w-4" />Adicionar outro período
                  </Button>
                </div>
                {vacPreviewDays > 0 && (
                  <div className="rounded-xl bg-primary/10 px-4 py-3 text-sm flex items-center gap-2">
                    <CalendarX2 className="h-4 w-4 text-primary" />
                    <span><strong>{vacPreviewDays}</strong> dia{vacPreviewDays > 1 ? "s" : ""} útil{vacPreviewDays > 1 ? "eis" : ""} (seg. a sex.) no período selecionado.</span>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="vacReason">Observação (opcional)</Label>
                  <Textarea id="vacReason" value={vacReason} onChange={(e) => setVacReason(e.target.value)} placeholder="Ex.: Férias de verão" rows={3} />
                </div>
                <Button type="submit" className="w-full" disabled={submittingVac}>
                  {submittingVac ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar pedido
                </Button>
              </form>
            </motion.div>

            <div className="space-y-3">
              <h2 className="font-display text-xl font-bold tracking-tight">Os meus pedidos de férias</h2>
              {vacations.length === 0 ? (
                <div className="bg-card rounded-2xl p-8 text-center text-muted-foreground" style={{ boxShadow: "var(--shadow-sm)" }}>
                  <Palmtree className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Ainda não tem pedidos de férias.</p>
                </div>
              ) : (
                vacations.map((v, i) => (
                  <motion.div key={v.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="bg-card rounded-2xl p-4" style={{ boxShadow: "var(--shadow-sm)" }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{formatDateStr(v.startDate)} → {formatDateStr(v.endDate)}</p>
                        <p className="text-sm text-muted-foreground">{v.days} dia{v.days > 1 ? "s" : ""} útil{v.days > 1 ? "eis" : ""}{v.reason ? ` · ${v.reason}` : ""}</p>
                        {v.decisionNote && <p className="text-xs italic text-muted-foreground mt-1">Nota: {v.decisionNote}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${vacBadge(v.status)}`}>{VAC_LABELS[v.status] ?? v.status}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        {/* REGISTO HOJE */}
        <TabsContent value="hist">
          <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-md)" }}>
            <h2 className="font-display text-xl font-bold tracking-tight mb-4">Marcações de hoje · {formatDateStr(todayStr())}</h2>
            {punches.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Ainda não registou marcações hoje.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {punches.map((p, i) => (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="flex items-center justify-between p-4 rounded-xl bg-secondary">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Clock className="h-5 w-5 text-primary" /></div>
                      <div>
                        <p className="font-semibold">{PUNCH_LABELS[p.type]}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2"><MonitorSmartphone className="h-3 w-3" />{p.device ?? "—"} · {p.ipAddress ?? "—"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-lg">{formatTime(p.timestamp)}</p>
                      {p.lateMinutes > 0 && <p className="text-xs text-amber-600 flex items-center gap-1 justify-end"><AlertTriangle className="h-3 w-3" />Atraso {formatMinutes(p.lateMinutes)}</p>}
                      {p.extraMinutes > 0 && <p className="text-xs text-violet-600 flex items-center gap-1 justify-end"><Plus className="h-3 w-3" />Extra {formatMinutes(p.extraMinutes)}</p>}
                      {p.lateMinutes > 5 && (
                        p.delayReason ? (
                          <button
                            type="button"
                            onClick={() => { setDelayRecord(p); setDelayText(p.delayReason ?? ""); }}
                            className="mt-1 text-xs text-primary underline underline-offset-2 hover:opacity-80"
                          >
                            Motivo registado · editar
                          </button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50"
                            onClick={() => { setDelayRecord(p); setDelayText(""); }}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />Explicar atraso
                          </Button>
                        )
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* FICHA */}
        <TabsContent value="ficha">
          <FichaColaborador />
        </TabsContent>
      </Tabs>

      {/* Diálogo do leitor de câmara para ler o QR do administrador */}
      <Dialog open={scanOpen} onOpenChange={(open) => { if (!open) { stopScanner(); setScanOpen(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              {scanType ? PUNCH_LABELS[scanType] : "Marcar ponto"}
            </DialogTitle>
            <DialogDescription>
              Aponte a câmara ao QR mostrado na conta do administrador. A marcação é registada assim que o código for lido.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-full max-w-[320px] aspect-square overflow-hidden rounded-2xl bg-black">
              <div id="qr-reader-colab" className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-cover" />
              {scanStarting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-white">
                  <Loader2 className="h-7 w-7 animate-spin" />
                  <span className="text-sm">A iniciar a câmara...</span>
                </div>
              )}
            </div>
            {scanError ? (
              <div className="mt-4 w-full rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-4 py-3 text-sm text-rose-800 dark:text-rose-200 flex items-start gap-2">
                <CameraOff className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{scanError}</span>
              </div>
            ) : (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Mantenha o QR do administrador dentro do quadrado. O código renova-se a cada 30 segundos.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {scanError && (
              <Button variant="outline" className="flex-1" onClick={() => startScanner()}>
                <Camera className="h-4 w-4 mr-2" />Tentar novamente
              </Button>
            )}
            <Button variant="outline" className="flex-1" onClick={() => { stopScanner(); setScanOpen(false); }}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo para justificar um atraso superior a 5 minutos */}
      <Dialog open={!!delayRecord} onOpenChange={(open) => { if (!open) { setDelayRecord(null); setDelayText(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Explicar atraso
            </DialogTitle>
            <DialogDescription>
              {delayRecord ? `${PUNCH_LABELS[delayRecord.type]} · atraso de ${formatMinutes(delayRecord.lateMinutes)}. Descreva o motivo.` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={delayText}
              onChange={(e) => setDelayText(e.target.value)}
              placeholder="Ex.: Trânsito intenso na A1..."
              rows={4}
              autoFocus
            />
            <div className="flex gap-2">
              <Button className="flex-1" onClick={submitDelayReason} disabled={submittingDelay}>
                {submittingDelay ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
                Guardar motivo
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => { setDelayRecord(null); setDelayText(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
