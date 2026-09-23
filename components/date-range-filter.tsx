'use client';

import { useEffect, useRef, useState } from 'react';

export type DateRange = { inicio: string; fim: string };

export const DATE_PRESETS: { key: string; label: string }[] = [
  { key: 'personalizado', label: 'Personalizado' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'este_mes', label: 'Este mês' },
  { key: 'ultimos_30', label: 'Últimos 30 dias' },
  { key: 'mes_anterior', label: 'Mês anterior' },
  { key: 'este_trimestre', label: 'Este trimestre' },
  { key: 'trimestre_anterior', label: 'Trimestre anterior' },
  { key: 'este_semestre', label: 'Este semestre' },
  { key: 'este_ano', label: 'Este ano' },
  { key: 'ano_anterior', label: 'Ano anterior' },
];

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function rangeForPreset(preset: string): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = (yy: number, mm: number) => new Date(yy, mm, 1);
  const last = (yy: number, mm: number) => new Date(yy, mm + 1, 0);
  switch (preset) {
    case 'hoje':
      return { inicio: toISO(now), fim: toISO(now) };
    case 'este_mes':
      return { inicio: toISO(first(y, m)), fim: toISO(last(y, m)) };
    case 'ultimos_30': {
      const s = new Date(now);
      s.setDate(s.getDate() - 29);
      return { inicio: toISO(s), fim: toISO(now) };
    }
    case 'mes_anterior': {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      return { inicio: toISO(first(py, pm)), fim: toISO(last(py, pm)) };
    }
    case 'este_trimestre': {
      const q = Math.floor(m / 3) * 3;
      return { inicio: toISO(first(y, q)), fim: toISO(last(y, q + 2)) };
    }
    case 'trimestre_anterior': {
      let q = Math.floor(m / 3) * 3 - 3;
      let qy = y;
      if (q < 0) {
        q = 9;
        qy = y - 1;
      }
      return { inicio: toISO(first(qy, q)), fim: toISO(last(qy, q + 2)) };
    }
    case 'este_semestre': {
      const h = m < 6 ? 0 : 6;
      return { inicio: toISO(first(y, h)), fim: toISO(last(y, h + 5)) };
    }
    case 'este_ano':
      return { inicio: toISO(first(y, 0)), fim: toISO(last(y, 11)) };
    case 'ano_anterior':
      return { inicio: toISO(first(y - 1, 0)), fim: toISO(last(y - 1, 11)) };
    default:
      return { inicio: '', fim: '' };
  }
}

// Verifica se uma data (DateTime/ISO) cai dentro do intervalo (comparação por dia, hora local).
export function dateInRange(d: any, range: DateRange): boolean {
  if (!range || (!range.inicio && !range.fim)) return true;
  if (!d) return false;
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return false;
  const iso = toISO(dt);
  if (range.inicio && iso < range.inicio) return false;
  if (range.fim && iso > range.fim) return false;
  return true;
}

const fmtPt = (iso: string) => {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}-${m}-${a}`;
};

export function rangeLabel(range: DateRange): string {
  if (!range || (!range.inicio && !range.fim)) return 'todos os períodos';
  if (range.inicio && range.fim) return `${fmtPt(range.inicio)} a ${fmtPt(range.fim)}`;
  if (range.inicio) return `desde ${fmtPt(range.inicio)}`;
  return `até ${fmtPt(range.fim)}`;
}

type Props = {
  value: DateRange;
  onChange: (r: DateRange) => void;
  defaultPreset?: string;
  className?: string;
};

export function DateRangeFilter({ value, onChange, defaultPreset = 'este_ano', className }: Props) {
  const [preset, setPreset] = useState(defaultPreset);
  const emitted = useRef(false);

  // Aplica o intervalo predefinido no arranque (evita mismatch de hidratação por usar new Date()).
  useEffect(() => {
    if (!emitted.current && defaultPreset !== 'personalizado' && !value.inicio && !value.fim) {
      emitted.current = true;
      onChange(rangeForPreset(defaultPreset));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyPreset = (p: string) => {
    setPreset(p);
    if (p === 'personalizado') return;
    onChange(rangeForPreset(p));
  };

  const setDate = (field: 'inicio' | 'fim', v: string) => {
    setPreset('personalizado');
    onChange({ ...value, [field]: v });
  };

  const inputCls =
    'px-3 py-2.5 border border-input rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary outline-none';

  return (
    <div className={`flex flex-col sm:flex-row gap-2 sm:items-center ${className ?? ''}`}>
      <select
        value={preset}
        onChange={(e) => applyPreset(e.target.value)}
        className={`${inputCls} sm:w-48`}
        title="Período"
      >
        {DATE_PRESETS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={value.inicio}
          onChange={(e) => setDate('inicio', e.target.value)}
          className={inputCls}
          title="Data de início"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <input
          type="date"
          value={value.fim}
          onChange={(e) => setDate('fim', e.target.value)}
          className={inputCls}
          title="Data de fim"
        />
      </div>
    </div>
  );
}
