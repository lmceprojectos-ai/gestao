export function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printReport(title: string, html: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}h1{color:#1f2937;border-bottom:3px solid #feca00;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;font-size:13px}th{background:#1f2937;color:#feca00}</style></head><body>${html}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
}
