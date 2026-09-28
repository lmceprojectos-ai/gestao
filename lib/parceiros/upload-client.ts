export interface UploadedFileMeta {
  cloud_storage_path: string
  fileName: string
  contentType: string
  fileSize: number
}

export async function uploadFile(file: File): Promise<UploadedFileMeta> {
  const contentType = file.type || 'application/octet-stream'
  const presignRes = await fetch('/api/parceiros/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, contentType }),
  })
  const presign = await presignRes.json().catch(() => ({}))
  if (!presignRes.ok || !presign?.uploadUrl) {
    throw new Error(presign?.message ?? 'Falha ao preparar o upload.')
  }
  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  })
  if (!putRes.ok) {
    throw new Error('Falha ao enviar o ficheiro.')
  }
  return {
    cloud_storage_path: presign.cloud_storage_path,
    fileName: file.name,
    contentType,
    fileSize: file.size,
  }
}

export async function downloadAttachment(attachmentId: string): Promise<void> {
  const res = await fetch(`/api/parceiros/attachments/${attachmentId}`, { cache: 'no-store' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.url) {
    throw new Error(data?.message ?? 'Não foi possível obter o documento.')
  }
  const a = document.createElement('a')
  a.href = data.url
  a.rel = 'noopener'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
