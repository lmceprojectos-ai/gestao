"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Loader2, Save, Upload, Eye, Lock, IdCard, Camera, Check, RefreshCw, CreditCard, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DocumentCamera } from "./document-camera";

type DocT = {
  id: string;
  label?: string | null;
  category?: string | null;
  side?: string | null;
  fileName: string;
  contentType: string;
  createdAt: string;
};
type FileT = {
  id: string;
  fullName?: string | null;
  address?: string | null;
  phone?: string | null;
  nif?: string | null;
  notes?: string | null;
  documents: DocT[];
};

type DocType = { category: string; label: string; icon: typeof CreditCard };
const DOC_TYPES: DocType[] = [
  { category: "CC", label: "Cartão de Cidadão", icon: CreditCard },
  { category: "CARTA", label: "Carta de Condução", icon: Car },
];
const SIDES = [
  { key: "FRENTE", label: "Frente" },
  { key: "VERSO", label: "Verso" },
];

type Session = {
  category: string;
  label: string;
  front?: File;
  frontUrl?: string;
  back?: File;
  backUrl?: string;
};

export function FichaColaborador() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocT[]>([]);
  const [ibanFile, setIbanFile] = useState<File | null>(null);
  const [uploadingIban, setUploadingIban] = useState(false);

  const [fullName, setFullName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [nif, setNif] = useState("");
  const [notes, setNotes] = useState("");

  const [session, setSession] = useState<Session | null>(null);
  const [camSide, setCamSide] = useState<"FRENTE" | "VERSO" | null>(null);

  const docFor = useCallback(
    (category: string, side: string) =>
      documents.find((d) => d.category === category && d.side === side) || null,
    [documents]
  );

  // Comprovativo de IBAN (documento sem lado). Depois de carregado, só o admin o altera.
  const ibanDoc = documents.find((d) => d.category === "iban") || null;

  const applyFile = useCallback((f: FileT | null) => {
    setFullName(f?.fullName ?? "");
    setAddress(f?.address ?? "");
    setPhone(f?.phone ?? "");
    setNif(f?.nif ?? "");
    setNotes(f?.notes ?? "");
    setDocuments(f?.documents ?? []);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/client-file");
      if (res.ok) {
        const data = await res.json();
        applyFile(data?.file ?? null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [applyFile]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveData() {
    setSaving(true);
    try {
      const res = await fetch("/api/ponto/client-file", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, address, phone, nif, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Erro ao guardar a ficha.");
      } else {
        toast.success("Ficha guardada.");
        applyFile(data?.file ?? null);
      }
    } catch {
      toast.error("Erro ao guardar a ficha.");
    } finally {
      setSaving(false);
    }
  }

  function startSession(t: DocType) {
    setSession({ category: t.category, label: t.label });
    const firstMissing = !docFor(t.category, "FRENTE")
      ? "FRENTE"
      : !docFor(t.category, "VERSO")
      ? "VERSO"
      : null;
    if (firstMissing) setCamSide(firstMissing as "FRENTE" | "VERSO");
  }

  function closeSession() {
    setSession((s) => {
      if (s?.frontUrl) URL.revokeObjectURL(s.frontUrl);
      if (s?.backUrl) URL.revokeObjectURL(s.backUrl);
      return null;
    });
  }

  function handleCaptured(file: File) {
    const side = camSide;
    setSession((s) => {
      if (!s || !side) return s;
      const url = URL.createObjectURL(file);
      if (side === "FRENTE") {
        if (s.frontUrl) URL.revokeObjectURL(s.frontUrl);
        return { ...s, front: file, frontUrl: url };
      }
      if (s.backUrl) URL.revokeObjectURL(s.backUrl);
      return { ...s, back: file, backUrl: url };
    });
    setCamSide(null);
  }

  async function uploadOne(file: File, category: string, label: string, side: string) {
    const presRes = await fetch("/api/ponto/upload/presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || "image/jpeg" }),
    });
    if (!presRes.ok) throw new Error("presigned");
    const pres = await presRes.json();
    const put = await fetch(pres.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });
    if (!put.ok) throw new Error("upload");
    const res = await fetch("/api/ponto/client-file/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cloud_storage_path: pres.cloud_storage_path,
        fileName: file.name,
        contentType: file.type || "image/jpeg",
        label: `${label} · ${side === "FRENTE" ? "Frente" : "Verso"}`,
        category,
        side,
      }),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  async function uploadSession() {
    if (!session) return;
    const toUpload: { file: File; side: string }[] = [];
    if (session.front && !docFor(session.category, "FRENTE")) toUpload.push({ file: session.front, side: "FRENTE" });
    if (session.back && !docFor(session.category, "VERSO")) toUpload.push({ file: session.back, side: "VERSO" });
    if (toUpload.length === 0) {
      toast.error("Tire pelo menos uma fotografia (frente ou verso).");
      return;
    }
    setUploading(true);
    try {
      let lastFile: FileT | null = null;
      for (const item of toUpload) {
        const { ok, data } = await uploadOne(item.file, session.category, session.label, item.side);
        if (!ok) {
          toast.error(data?.message ?? "Erro ao carregar o documento.");
          if (data?.file) applyFile(data.file);
          setUploading(false);
          return;
        }
        lastFile = data?.file ?? lastFile;
      }
      toast.success("Documento carregado. A partir de agora só o administrador o pode alterar.");
      if (lastFile) applyFile(lastFile);
      closeSession();
    } catch {
      toast.error("Erro ao carregar o documento.");
    } finally {
      setUploading(false);
    }
  }

  async function uploadIban() {
    if (!ibanFile) {
      toast.error("Escolha o comprovativo de IBAN.");
      return;
    }
    setUploadingIban(true);
    try {
      const presRes = await fetch("/api/ponto/upload/presigned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: ibanFile.name, contentType: ibanFile.type || "application/octet-stream" }),
      });
      if (!presRes.ok) throw new Error("presigned");
      const pres = await presRes.json();
      const put = await fetch(pres.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": ibanFile.type || "application/octet-stream" },
        body: ibanFile,
      });
      if (!put.ok) throw new Error("upload");
      const res = await fetch("/api/ponto/client-file/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloud_storage_path: pres.cloud_storage_path,
          fileName: ibanFile.name,
          contentType: ibanFile.type || "application/octet-stream",
          label: "Comprovativo de IBAN",
          category: "iban",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Erro ao carregar o comprovativo.");
        if (data?.file) applyFile(data.file);
        return;
      }
      toast.success("Comprovativo de IBAN carregado. A partir de agora só o administrador o pode alterar.");
      setIbanFile(null);
      applyFile(data?.file ?? null);
    } catch {
      toast.error("Erro ao carregar o comprovativo.");
    } finally {
      setUploadingIban(false);
    }
  }

  async function viewDocument(id: string) {
    try {
      const res = await fetch(`/api/ponto/client-file/document/${id}`);
      const data = await res.json();
      if (!res.ok || !data?.url) {
        toast.error(data?.message ?? "Não foi possível abrir o documento.");
        return;
      }
      const a = document.createElement("a");
      a.href = data.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Não foi possível abrir o documento.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> A carregar a ficha...
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
      {/* Dados pessoais */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-4 sm:p-6" style={{ boxShadow: "var(--shadow-md)" }}>
        <div className="flex items-center gap-2 mb-4">
          <IdCard className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">A minha ficha</h3>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="f-nome">Nome completo</Label>
            <Input id="f-nome" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" />
          </div>
          <div>
            <Label htmlFor="f-morada">Morada</Label>
            <Textarea id="f-morada" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, n.º, código postal, localidade" rows={2} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="f-tel">Telefone</Label>
              <Input id="f-tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Contacto" />
            </div>
            <div>
              <Label htmlFor="f-nif">NIF</Label>
              <Input id="f-nif" value={nif} onChange={(e) => setNif(e.target.value)} placeholder="Número de contribuinte" />
            </div>
          </div>
          <div>
            <Label htmlFor="f-notas">Observações</Label>
            <Textarea id="f-notas" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informação adicional (opcional)" rows={2} />
          </div>
          <Button onClick={saveData} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Guardar ficha
          </Button>
        </div>
      </motion.div>

      {/* Documentos */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="bg-card rounded-2xl p-4 sm:p-6" style={{ boxShadow: "var(--shadow-md)" }}>
        <div className="flex items-center gap-2 mb-1">
          <IdCard className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Documentos de identificação</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 flex items-start gap-1">
          <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          Fotografe a frente e o verso de cada documento. Depois de carregadas, as fotografias só podem ser alteradas pelo administrador.
        </p>

        <div className="space-y-4">
          {DOC_TYPES.map((t) => {
            const Icon = t.icon;
            const isSession = session?.category === t.category;
            const bothDone = !!docFor(t.category, "FRENTE") && !!docFor(t.category, "VERSO");
            return (
              <div key={t.category} className="rounded-xl border border-border p-3 sm:p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm">{t.label}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SIDES.map((s) => {
                    const doc = docFor(t.category, s.key);
                    const captured =
                      isSession && (s.key === "FRENTE" ? session?.frontUrl : session?.backUrl);
                    return (
                      <div key={s.key} className="rounded-lg bg-secondary/50 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{s.label}</span>
                          {doc ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                              <Check className="h-3.5 w-3.5" /> Carregada
                            </span>
                          ) : captured ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
                              <Check className="h-3.5 w-3.5" /> Por carregar
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">Em falta</span>
                          )}
                        </div>
                        <div className="mt-2">
                          {doc ? (
                            <Button size="sm" variant="outline" className="w-full h-8" onClick={() => viewDocument(doc.id)}>
                              <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant={captured ? "outline" : "default"}
                              className="w-full h-8"
                              onClick={() => {
                                if (!isSession) setSession({ category: t.category, label: t.label });
                                setCamSide(s.key as "FRENTE" | "VERSO");
                              }}
                            >
                              {captured ? (
                                <><RefreshCw className="h-3.5 w-3.5 mr-1" /> Repetir</>
                              ) : (
                                <><Camera className="h-3.5 w-3.5 mr-1" /> Fotografar</>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isSession && (session?.front || session?.back) && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Button className="flex-1" onClick={uploadSession} disabled={uploading}>
                      {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Carregar
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={closeSession} disabled={uploading}>
                      Cancelar
                    </Button>
                  </div>
                )}

                {!isSession && !bothDone && (
                  <Button variant="outline" className="w-full mt-3" onClick={() => startSession(t)}>
                    <Camera className="h-4 w-4 mr-2" /> Fotografar {t.label.toLowerCase()}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        {/* Comprovativo de IBAN */}
        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Comprovativo de IBAN</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4 flex items-start gap-1">
            <Lock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Carregue o comprovativo do seu IBAN. Depois de carregado, só pode ser alterado pelo administrador.
          </p>

          <div className="rounded-xl border border-border p-3 sm:p-4">
            {ibanDoc ? (
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{ibanDoc.fileName || "Comprovativo de IBAN"}</span>
                </span>
                <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={() => viewDocument(ibanDoc.id)}>
                  <Eye className="h-3.5 w-3.5 mr-1" /> Ver
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setIbanFile(e.target.files?.[0] ?? null)}
                />
                <Button className="w-full" onClick={uploadIban} disabled={uploadingIban || !ibanFile}>
                  {uploadingIban ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Carregar comprovativo de IBAN
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <DocumentCamera
        open={camSide !== null}
        onOpenChange={(o) => {
          if (!o) setCamSide(null);
        }}
        onCaptured={handleCaptured}
        title={`Fotografar ${session?.label ?? "documento"} — ${camSide === "VERSO" ? "verso" : "frente"}`}
      />
    </div>
  );
}
