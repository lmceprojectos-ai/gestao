"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Save, Upload, Eye, Trash2, IdCard, ChevronDown, ChevronRight, FileImage,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTime } from "@/lib/ponto/format";

type DocT = {
  id: string;
  label?: string | null;
  category?: string | null;
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
} | null;
type Row = { userId: string; userName: string; userEmail: string; file: FileT };

export function FichasAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ponto/admin/client-files");
      if (res.ok) {
        const data = await res.json();
        setRows(data?.files ?? []);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> A carregar fichas...
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-6" style={{ boxShadow: "var(--shadow-md)" }}>
      <div className="flex items-center gap-2 mb-4">
        <IdCard className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Fichas de colaborador</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Consulte e altere qualquer dado das fichas dos colaboradores. Pode adicionar ou remover as fotografias dos documentos.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ainda não existem colaboradores.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <FichaRow
              key={r.userId}
              row={r}
              open={openId === r.userId}
              onToggle={() => setOpenId(openId === r.userId ? null : r.userId)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FichaRow({
  row, open, onToggle, onChanged,
}: {
  row: Row;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const f = row.file;
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [documents, setDocuments] = useState<DocT[]>(f?.documents ?? []);

  const [fullName, setFullName] = useState(f?.fullName ?? "");
  const [address, setAddress] = useState(f?.address ?? "");
  const [phone, setPhone] = useState(f?.phone ?? "");
  const [nif, setNif] = useState(f?.nif ?? "");
  const [notes, setNotes] = useState(f?.notes ?? "");

  const [docLabel, setDocLabel] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [ibanFile, setIbanFile] = useState<File | null>(null);
  const [uploadingIban, setUploadingIban] = useState(false);
  const [toDelete, setToDelete] = useState<DocT | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Separa o(s) comprovativo(s) de IBAN dos restantes documentos da ficha.
  const ibanDocs = documents.filter((d) => d.category === "iban");
  const otherDocs = documents.filter((d) => d.category !== "iban");

  useEffect(() => {
    setDocuments(row.file?.documents ?? []);
    setFullName(row.file?.fullName ?? "");
    setAddress(row.file?.address ?? "");
    setPhone(row.file?.phone ?? "");
    setNif(row.file?.nif ?? "");
    setNotes(row.file?.notes ?? "");
  }, [row]);

  async function saveData() {
    setSaving(true);
    try {
      const res = await fetch(`/api/ponto/admin/client-files/${row.userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, address, phone, nif, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Erro ao guardar.");
      } else {
        toast.success("Ficha atualizada.");
        setDocuments(data?.file?.documents ?? []);
      }
    } catch {
      toast.error("Erro ao guardar.");
    } finally {
      setSaving(false);
    }
  }

  // Envio genérico de um documento para a ficha (usado tanto pelas fotografias
  // dos documentos como pelo comprovativo de IBAN, distinguidos pela categoria).
  async function doUpload(file: File, label: string, category?: string) {
    const presRes = await fetch("/api/ponto/upload/presigned", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: file.name, contentType: file.type || "application/octet-stream" }),
    });
    if (!presRes.ok) throw new Error("presigned");
    const pres = await presRes.json();
    const put = await fetch(pres.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file,
    });
    if (!put.ok) throw new Error("upload");
    const res = await fetch("/api/ponto/admin/client-files/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: row.userId,
        cloud_storage_path: pres.cloud_storage_path,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        label,
        category,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? "Erro ao carregar.");
    setDocuments(data?.file?.documents ?? []);
  }

  async function uploadDocument() {
    if (!docFile) {
      toast.error("Escolha um ficheiro.");
      return;
    }
    setUploading(true);
    try {
      await doUpload(docFile, docLabel);
      toast.success("Documento carregado.");
      setDocFile(null);
      setDocLabel("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar o documento.");
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
      await doUpload(ibanFile, "Comprovativo de IBAN", "iban");
      toast.success("Comprovativo de IBAN carregado.");
      setIbanFile(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao carregar o comprovativo.");
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

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/ponto/admin/client-files/documents/${toDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.message ?? "Erro ao remover.");
      } else {
        toast.success("Documento removido.");
        setDocuments((prev) => prev.filter((d) => d.id !== toDelete.id));
      }
    } catch {
      toast.error("Erro ao remover o documento.");
    } finally {
      setDeleting(false);
      setToDelete(null);
    }
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-secondary/40 hover:bg-secondary/70 transition-colors text-left"
      >
        <div className="min-w-0">
          <p className="font-medium truncate">{row.userName}</p>
          <p className="text-xs text-muted-foreground truncate">{row.userEmail}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{documents.length} doc(s)</span>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="p-4 grid lg:grid-cols-2 gap-6">
          {/* Dados */}
          <div className="space-y-3">
            <div>
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Morada</Label>
              <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label>NIF</Label>
                <Input value={nif} onChange={(e) => setNif(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
            <Button onClick={saveData} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Guardar dados
            </Button>
          </div>

          {/* Documentos */}
          <div className="space-y-3">
            {/* Comprovativo de IBAN */}
            <div className="rounded-xl border border-border p-3 space-y-3 bg-secondary/20">
              <div className="flex items-center gap-2">
                <IdCard className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Comprovativo de IBAN</span>
              </div>
              {ibanDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem comprovativo de IBAN.</p>
              ) : (
                <ul className="space-y-2">
                  {ibanDocs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{d.label || d.fileName}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="outline" onClick={() => viewDocument(d.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setToDelete(d)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2">
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => setIbanFile(e.target.files?.[0] ?? null)} />
                <Button onClick={uploadIban} disabled={uploadingIban || !ibanFile} className="w-full" variant="secondary">
                  {uploadingIban ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Carregar comprovativo de IBAN
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <FileImage className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Fotografias dos documentos</span>
            </div>
            {otherDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-xl bg-secondary/50 p-3">Sem documentos.</p>
            ) : (
              <ul className="space-y-2">
                {otherDocs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{d.label || d.fileName}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(d.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => viewDocument(d.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-rose-600 hover:text-rose-700" onClick={() => setToDelete(d)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-3 border-t border-border pt-3">
              <div>
                <Label>Descrição (opcional)</Label>
                <Input value={docLabel} onChange={(e) => setDocLabel(e.target.value)} placeholder="Ex.: Cartão de Cidadão - frente" />
              </div>
              <div>
                <Label>Ficheiro</Label>
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
              </div>
              <Button onClick={uploadDocument} disabled={uploading || !docFile} className="w-full">
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                Carregar documento
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remover documento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem a certeza que pretende remover o documento «{toDelete?.label || toDelete?.fileName}»? Esta ação é irreversível.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
