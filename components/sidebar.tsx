'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Scale,
  DatabaseBackup,
  Landmark,
  Users,
  Truck,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  FileMinus,
  FilePlus,
  FileCheck,
  ClipboardList,
  RefreshCcw,
  BarChart3,
  LogOut,
  Menu,
  X,
  Plug,
  Receipt,
  ShoppingCart,
  Wallet,
  Briefcase,
  ArrowLeftRight,
  Handshake,
  Settings,
  UserCog,
  ChevronDown,
  GripVertical,
  FileUp,
  ListOrdered,
  ShieldCheck,
  FolderLock,
  UserCircle,
  ScanLine,
  Clock,
  Share2,
  FileSearch,
  RotateCcw,
} from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { type AreaKey, type RolePermissions, DEFAULT_PERMISSIONS } from '@/lib/permissions';

type NavItem = {
  href: string;
  label: string;
  // Item novo que deve aparecer no topo da secção mesmo num menu já personalizado.
  primeiro?: boolean;
  // Desativado por agora: não aparece no menu (a página continua a existir).
  oculto?: boolean;
  icon: any;
  tipo?: string;
  origem?: string;
  sub?: boolean;
  adminOnly?: boolean;
  adminEditorOnly?: boolean;
  hideForInsercao?: boolean;
  area?: AreaKey;
};

const navSections: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  ] },
  { title: 'Clientes', items: [
    { href: '/painel-clientes', label: 'Dashboard', icon: LayoutDashboard, area: 'clientes', primeiro: true },
    { href: '/clientes', label: 'Clientes', icon: Users, area: 'clientes' },
    { href: '/faturas?tipo=emitida&origem=cliente', label: 'Faturas Clientes', icon: FileText, tipo: 'emitida', origem: 'cliente', sub: true, area: 'clientes' },
    { href: '/faturas?tipo=recibo&origem=cliente', label: 'Recibos', icon: FileCheck, tipo: 'recibo', origem: 'cliente', sub: true, area: 'clientes' },
    { href: '/faturas?tipo=nota&origem=cliente', label: 'Notas de Crédito', icon: FileMinus, tipo: 'nota', origem: 'cliente', sub: true, area: 'clientes' },
    { href: '/recebimentos', label: 'Recebimentos', icon: ArrowDownCircle, area: 'clientes' },
  ] },
  { title: 'Fornecedores', items: [
    { href: '/painel-fornecedores', label: 'Dashboard', icon: LayoutDashboard, area: 'fornecedores', primeiro: true },
    { href: '/fornecedores', label: 'Fornecedores', icon: Truck, area: 'fornecedores' },
    { href: '/faturas?tipo=recebida&origem=fornecedor', label: 'Faturas Fornecedores', icon: FileText, tipo: 'recebida', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/faturas?tipo=recibo&origem=fornecedor', label: 'Recibos', icon: FileCheck, tipo: 'recibo', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/faturas?tipo=nota&origem=fornecedor', label: 'Notas de Crédito', icon: FileMinus, tipo: 'nota', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/faturas?tipo=orcamento&origem=fornecedor', label: 'Orçamentos', icon: ClipboardList, tipo: 'orcamento', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/pagamentos', label: 'Pagamentos', icon: ArrowUpCircle, area: 'fornecedores' },
    { href: '/efatura', label: 'e-Fatura (AT)', icon: FileSearch, area: 'fornecedores' },
  ] },
  { title: 'Documentos', items: [
    { href: '/despesas', label: 'Despesas', icon: ShoppingCart, area: 'documentos' },
    { href: '/impostos', label: 'Impostos', icon: Receipt, area: 'documentos' },
    { href: '/seguros', label: 'Seguros', icon: ShieldCheck, area: 'documentos' },
    { href: '/vencimentos', label: 'Vencimentos', icon: Briefcase, area: 'documentos' },
    { href: '/digitalizacoes', label: 'Digitalizações OneDrive', icon: ScanLine, area: 'documentos' },
  ] },
  { title: 'Gestão Privada', items: [
    { href: '/perfil', label: 'O Meu Perfil', icon: UserCircle },
    { href: '/documentos-irs', label: 'Documentos IRS', icon: FolderLock },
  ] },
  { title: 'Bancos', items: [
    { href: '/contas', label: 'Contas Bancárias', icon: Landmark, hideForInsercao: true, area: 'bancos' },
    { href: '/caixa', label: 'Caixa', icon: Wallet, area: 'bancos' },
    { href: '/transferencias', label: 'Mov. Bancários Internos', icon: ArrowLeftRight, area: 'bancos' },
    { href: '/importar-extrato', label: 'Importar Extrato', icon: FileUp, area: 'bancos' },
    { href: '/movimentos-bancarios', label: 'Movimentos Bancários', icon: ListOrdered, area: 'bancos' },
    { href: '/reconciliacao', label: 'Reconciliação', icon: RefreshCcw, area: 'bancos' },
    { href: '/balancete', label: 'Balancete', icon: Scale, area: 'bancos' },
  ] },
  { title: 'Gestão', items: [
    { href: '/emprestimos', label: 'Empréstimos Sócio', icon: Handshake, hideForInsercao: true, area: 'gestao' },
    { href: '/relatorios', label: 'Relatórios', icon: BarChart3, hideForInsercao: true, area: 'gestao' },
    { href: '/moloni', label: 'Moloni', icon: Plug, area: 'gestao' },
    { href: '/utilizadores', label: 'Utilizadores', icon: UserCog, adminEditorOnly: true, area: 'utilizadores' },
    { href: '/backups', label: 'Backups', icon: DatabaseBackup, adminOnly: true },
    { href: '/configuracoes', label: 'Configurações', icon: Settings },
  ] },
];

// Cores pastel, sóbrias, por área do menu (sobre o fundo azul-escuro da barra).
const SECTION_COLORS: Record<string, string> = {
  __main__: '#cbd5e1',      // Dashboard — cinza-azulado
  'Clientes': '#93c5fd',    // azul-céu suave
  'Fornecedores': '#6ee7b7',// verde-menta suave
  'Documentos': '#c4b5fd',  // lilás suave
  'Gestão Privada': '#5eead4', // turquesa suave
  'Bancos': '#fcd34d',      // âmbar/areia suave
  'Orçamentos': '#f9a8d4',      // rosa-pó suave
  'Gestão': '#a5b4fc',       // azul-lavanda suave
};
const sectionColor = (title: string | null) => SECTION_COLORS[title ?? '__main__'] ?? '#cbd5e1';

type PosicaoLargar = 'antes' | 'depois';

// Item do menu que pode ser arrastado (com o rato) para outra posição ou outra
// secção. Toma sempre a cor da secção onde está.
function NavItemArrastavel({
  item,
  isActive,
  color,
  aArrastar,
  indicador,
  onNavigate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  item: NavItem;
  isActive: boolean;
  color: string;
  aArrastar: boolean;
  indicador: PosicaoLargar | null;
  onNavigate: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const Icon = item?.icon;
  return (
    <div className="relative" onDragOver={onDragOver} onDrop={onDrop}>
      {indicador === 'antes' && <div className="absolute -top-0.5 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: color }} />}
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={{ backgroundColor: isActive ? color + '2e' : undefined }}
        className={cn(
          'group flex items-center rounded-lg text-[14px] font-medium transition-all duration-150 select-none cursor-grab active:cursor-grabbing',
          isActive ? 'text-white shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white',
          aArrastar && 'opacity-40'
        )}
      >
        <span
          aria-hidden="true"
          title="Arrastar para mudar de lugar ou de secção"
          className="flex-shrink-0 pl-2 pr-1 py-2.5 cursor-grab active:cursor-grabbing text-white/25 group-hover:text-white/60"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        <Link
          href={item?.href ?? '/'}
          onClick={onNavigate}
          className={cn('flex items-center gap-3 py-2.5 pr-3 flex-1 min-w-0 select-none', item?.sub ? 'pl-2' : 'pl-0')}
        >
          {Icon && <Icon style={{ color }} className={cn('flex-shrink-0 transition-colors', item?.sub ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
          <span className="truncate">{item?.label}</span>
        </Link>
      </div>
      {indicador === 'depois' && <div className="absolute -bottom-0.5 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: color }} />}
    </div>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role || '';
  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
  // Parceiros (conta corrente com a Reclamarte): administradores e quem tem empresa parceira.
  const verParceiros = isAdmin || !!(session?.user as any)?.parceiroEmpresa;
  const isInsercao = role === 'insercao';
  // Permissões por perfil (áreas visíveis). Vêm da sessão; em falta, usa os
  // valores por defeito para o perfil. O administrador vê sempre tudo.
  const perms: RolePermissions | null = isAdmin
    ? null
    : (((session?.user as any)?.perms as RolePermissions | undefined) ||
       (DEFAULT_PERMISSIONS as any)[role] ||
       null);
  const areaVisible = (area?: AreaKey) => {
    if (!area || isAdmin) return true;
    if (!perms) return true; // sem informação: não esconder
    return perms[area] !== 'none';
  };
  const curTipo = searchParams?.get('tipo') || '';
  const curOrigem = searchParams?.get('origem') || '';
  const [mobileOpen, setMobileOpen] = useState(false);
  // Secções recolhidas (por título). Começa tudo expandido para evitar mismatch de hidratação.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved) setCollapsed(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleSection = (title: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      try { localStorage.setItem('sidebar_collapsed', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  // Organização personalizada do menu (que itens ficam em que secção e por que ordem),
  // guardada no navegador. Começa vazia para a hidratação ser determinística.
  // Lê também a chave antiga 'sidebar_order' (mesma forma: secção → lista de links).
  const [layout, setLayout] = useState<Record<string, string[]>>({});

  // Ordem das secções (títulos), também guardada no navegador. O Dashboard fica sempre no topo.
  const [ordemSecoes, setOrdemSecoes] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_layout') ?? localStorage.getItem('sidebar_order');
      if (saved) setLayout(JSON.parse(saved));
      const secoes = localStorage.getItem('sidebar_sections_order');
      if (secoes) setOrdemSecoes(JSON.parse(secoes));
    } catch {}
  }, []);

  const sectionKey = (title: string | null) => title ?? '__main__';

  const itemVisivel = (it: NavItem) =>
    !it.oculto && (!it.adminOnly || isAdmin) && (!it.adminEditorOnly || isAdmin || isEditor) && !(it.hideForInsercao && isInsercao) && areaVisible(it.area);

  // Secções como definidas no código (só com os itens que o perfil pode ver).
  const base = navSections.map((s) => ({ ...s, items: s.items.filter(itemVisivel) }));
  const porHref = new Map(base.flatMap((s) => s.items).map((it) => [it.href, it]));
  // Aplica a organização guardada; itens não mencionados ficam na secção original, no fim.
  const colocados = new Set<string>();
  const arrumadas = base.map((s) => {
    const items: NavItem[] = [];
    for (const href of layout[sectionKey(s.title)] ?? []) {
      const it = porHref.get(href);
      if (it && !colocados.has(href)) { items.push(it); colocados.add(href); }
    }
    return { ...s, items };
  });
  base.forEach((s, i) => s.items.forEach((it) => {
    if (!colocados.has(it.href)) {
      if (it.primeiro) arrumadas[i].items.unshift(it); else arrumadas[i].items.push(it);
      colocados.add(it.href);
    }
  }));
  // Uma secção esvaziada continua visível, para se poder voltar a largar itens nela.
  const visiveis = arrumadas.filter((s, i) => s.items.length > 0 || base[i].items.length > 0);
  const posicaoSecao = (title: string | null) => {
    if (!title) return -1; // Dashboard sempre primeiro
    const i = ordemSecoes.indexOf(title);
    return i === -1 ? ordemSecoes.length + navSections.findIndex((s) => s.title === title) : i;
  };
  const sections = [...visiveis].sort((a, b) => posicaoSecao(a.title) - posicaoSecao(b.title));
  const menuPersonalizado = Object.keys(layout).length > 0 || ordemSecoes.length > 0;

  // Arrastar e largar (rato).
  const [aArrastar, setAArrastar] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<{ secao: string; href: string | null; posicao: PosicaoLargar } | null>(null);

  const guardarLayout = (novo: Record<string, string[]>) => {
    setLayout(novo);
    try {
      localStorage.setItem('sidebar_layout', JSON.stringify(novo));
      localStorage.removeItem('sidebar_order');
    } catch {}
  };

  const moverItem = (href: string, secao: string, antesDe: string | null, posicao: PosicaoLargar) => {
    const atual: Record<string, string[]> = Object.fromEntries(
      sections.map((sec) => [sectionKey(sec.title), sec.items.map((it) => it.href).filter((h) => h !== href)])
    );
    const lista = atual[secao] ?? [];
    let idx = antesDe ? lista.indexOf(antesDe) : -1;
    if (idx === -1) idx = lista.length;
    else if (posicao === 'depois') idx += 1;
    lista.splice(idx, 0, href);
    atual[secao] = lista;
    guardarLayout(atual);
  };

  const [secaoAArrastar, setSecaoAArrastar] = useState<string | null>(null);
  const [alvoSecao, setAlvoSecao] = useState<{ titulo: string; posicao: PosicaoLargar } | null>(null);

  const moverSecao = (titulo: string, destino: string, posicao: PosicaoLargar) => {
    const titulos = sections.map((sec) => sec.title).filter((t): t is string => !!t && t !== titulo);
    let idx = titulos.indexOf(destino);
    if (idx === -1) idx = titulos.length;
    else if (posicao === 'depois') idx += 1;
    titulos.splice(idx, 0, titulo);
    setOrdemSecoes(titulos);
    try { localStorage.setItem('sidebar_sections_order', JSON.stringify(titulos)); } catch {}
  };

  const terminarArrasto = () => { setAArrastar(null); setAlvo(null); setSecaoAArrastar(null); setAlvoSecao(null); };

  const reporMenu = () => {
    setLayout({});
    setOrdemSecoes([]);
    try {
      localStorage.removeItem('sidebar_layout');
      localStorage.removeItem('sidebar_order');
      localStorage.removeItem('sidebar_sections_order');
    } catch {}
  };

  const itemIsActive = (item: NavItem) => {
    if (item.tipo) {
      return pathname === '/faturas' && curTipo === item.tipo && curOrigem === (item.origem || '');
    }
    if (item.href === '/') return pathname === '/';
    // Non-parametrized items: match by pathname but never light up the shared /faturas route
    const path = item.href.split('?')[0];
    if (path === '/faturas') return false;
    return pathname === path || pathname?.startsWith?.(path + '/');
  };

  const NavContent = () => (
    <>
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        <div className="relative w-10 h-10 flex-shrink-0 overflow-hidden">
          <Image src="/icon-criaconsensos.png" alt="CRIACONSENSOS" fill className="object-contain" />
        </div>
        <div>
          <h1 className="text-lg font-display font-bold text-white tracking-tight leading-tight">
            CRIACONSENSOS
          </h1>
          <p className="text-[10px] text-white/60">Gestão Financeira</p>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
        {/* Item destacado: Gestão de Ponto (fora das secções da Gestão) */}
        <Link
          href="/ponto"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'group flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-[14px] transition-all duration-150 shadow-sm border',
            pathname?.startsWith('/ponto')
              ? 'bg-emerald-400 text-[#0f2438] border-emerald-300'
              : 'bg-emerald-500/15 text-white border-emerald-400/40 hover:bg-emerald-500/25'
          )}
        >
          <span
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
              pathname?.startsWith('/ponto') ? 'bg-white/25' : 'bg-emerald-400/25'
            )}
          >
            <Clock className={cn('h-5 w-5', pathname?.startsWith('/ponto') ? 'text-[#0f2438]' : 'text-emerald-300')} />
          </span>
          <span className="truncate">Gestão de Ponto</span>
        </Link>

        {/* Item destacado: Parceiros — conta corrente com a Reclamarte (como o Ponto) */}
        {verParceiros && (
          <Link
            href="/parceiros"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-[14px] transition-all duration-150 shadow-sm border',
              pathname?.startsWith('/parceiros')
                ? 'bg-sky-400 text-[#0f2438] border-sky-300'
                : 'bg-sky-500/15 text-white border-sky-400/40 hover:bg-sky-500/25'
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
                pathname?.startsWith('/parceiros') ? 'bg-white/25' : 'bg-sky-400/25'
              )}
            >
              <Handshake className={cn('h-5 w-5', pathname?.startsWith('/parceiros') ? 'text-[#0f2438]' : 'text-sky-300')} />
            </span>
            <span className="truncate">Parceiros</span>
          </Link>
        )}

        {/* Item destacado: Redes Sociais (apenas administradores e editores) */}
        {(isAdmin || isEditor) && (
          <Link
            href="/redes-sociais"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'group flex items-center gap-3 rounded-xl px-3 py-3 font-semibold text-[14px] transition-all duration-150 shadow-sm border',
              pathname?.startsWith('/redes-sociais')
                ? 'bg-fuchsia-400 text-[#2a0f38] border-fuchsia-300'
                : 'bg-fuchsia-500/15 text-white border-fuchsia-400/40 hover:bg-fuchsia-500/25'
            )}
          >
            <span
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
                pathname?.startsWith('/redes-sociais') ? 'bg-white/25' : 'bg-fuchsia-400/25'
              )}
            >
              <Share2 className={cn('h-5 w-5', pathname?.startsWith('/redes-sociais') ? 'text-[#2a0f38]' : 'text-fuchsia-300')} />
            </span>
            <span className="truncate">Redes Sociais</span>
          </Link>
        )}

        {sections?.map((section: any) => {
          const chave = sectionKey(section.title);
          const cor = sectionColor(section.title);
          const isCollapsed = section?.title ? !!collapsed[section.title] : false;
          const secaoAlvo = !!aArrastar && alvo?.secao === chave;
          // Largar em cima do título ou do espaço vazio da secção → fica no fim dela.
          const sobreSecao = (e: React.DragEvent) => {
            if (secaoAArrastar) {
              if (!section.title || secaoAArrastar === section.title) return;
              e.preventDefault();
              const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const posicao: PosicaoLargar = e.clientY < r.top + r.height / 2 ? 'antes' : 'depois';
              if (alvoSecao?.titulo !== section.title || alvoSecao?.posicao !== posicao) setAlvoSecao({ titulo: section.title, posicao });
              return;
            }
            if (!aArrastar) return;
            e.preventDefault();
            if (alvo?.secao !== chave || alvo.href !== null) setAlvo({ secao: chave, href: null, posicao: 'depois' });
          };
          const largarNaSecao = (e: React.DragEvent) => {
            if (secaoAArrastar) {
              e.preventDefault();
              if (section.title && secaoAArrastar !== section.title) moverSecao(secaoAArrastar, section.title, alvoSecao?.posicao ?? 'antes');
              terminarArrasto();
              return;
            }
            if (!aArrastar) return;
            e.preventDefault();
            moverItem(aArrastar, chave, alvo?.secao === chave ? alvo.href : null, alvo?.posicao ?? 'depois');
            terminarArrasto();
          };
          return (
          <div
            key={chave}
            onDragOver={sobreSecao}
            onDrop={largarNaSecao}
            style={secaoAlvo ? { outline: `1px dashed ${cor}`, backgroundColor: cor + '14' } : undefined}
            className={cn('relative space-y-1 rounded-lg transition-colors', secaoAArrastar === section.title && 'opacity-40')}
          >
            {secaoAArrastar && alvoSecao?.titulo === section.title && (
              <div
                className={cn('absolute left-2 right-2 h-0.5 rounded-full', alvoSecao?.posicao === 'antes' ? '-top-2' : '-bottom-2')}
                style={{ backgroundColor: sectionColor(secaoAArrastar) }}
              />
            )}
            {section?.title && (
              <div
                role="button"
                tabIndex={0}
                draggable
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(section.title); }
                }}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', section.title);
                  setSecaoAArrastar(section.title);
                }}
                onDragEnd={terminarArrasto}
                onClick={() => toggleSection(section.title)}
                title="Clique para abrir/fechar · arraste para mudar a ordem"
                style={{ color: cor }}
                className="group/titulo select-none w-full flex items-center justify-between px-3 pt-1 pb-0.5 text-[14px] font-semibold uppercase tracking-wider opacity-80 hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
              >
                <span className="flex items-center gap-1.5">
                  <GripVertical className="-ml-2 h-3.5 w-3.5 opacity-0 group-hover/titulo:opacity-60 transition-opacity" />
                  {section.title}
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isCollapsed && '-rotate-90')} />
              </div>
            )}
            <AnimatePresence initial={false}>
              {!isCollapsed && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-1 py-0.5">
                    {section.items.map((item: NavItem) => (
                      <NavItemArrastavel
                        key={item.href}
                        item={item}
                        isActive={itemIsActive(item)}
                        color={cor}
                        aArrastar={aArrastar === item.href}
                        indicador={aArrastar && aArrastar !== item.href && alvo?.secao === chave && alvo.href === item.href ? alvo.posicao : null}
                        onNavigate={() => setMobileOpen(false)}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          e.dataTransfer.setData('text/plain', item.href);
                          setAArrastar(item.href);
                        }}
                        onDragEnd={terminarArrasto}
                        onDragOver={(e) => {
                          if (!aArrastar) return;
                          e.preventDefault();
                          e.stopPropagation();
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const posicao: PosicaoLargar = e.clientY < r.top + r.height / 2 ? 'antes' : 'depois';
                          if (alvo?.secao !== chave || alvo.href !== item.href || alvo.posicao !== posicao) {
                            setAlvo({ secao: chave, href: item.href, posicao });
                          }
                        }}
                        onDrop={(e) => {
                          if (!aArrastar) return;
                          e.preventDefault();
                          e.stopPropagation();
                          if (aArrastar !== item.href) moverItem(aArrastar, chave, item.href, alvo?.posicao ?? 'antes');
                          terminarArrasto();
                        }}
                      />
                    ))}
                    {section.items.length === 0 && (
                      <p className="px-3 py-2 text-xs italic text-white/40">Arraste itens para aqui</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        {menuPersonalizado && (
          <button
            type="button"
            onClick={reporMenu}
            title="Voltar à organização original do menu"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-white/50 hover:bg-white/10 hover:text-white transition-all w-full"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Repor menu original</span>
          </button>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-[14px] font-medium text-white/70 hover:bg-white/10 hover:text-white transition-all w-full"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-primary text-primary-foreground p-2 rounded-lg shadow-lg"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#1e3a5f] z-40">
        {NavContent()}
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-64 bg-[#1e3a5f] z-50 lg:hidden flex flex-col"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 text-white/70 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
              {NavContent()}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export function Sidebar() {
  return (
    <Suspense fallback={<aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#1e3a5f] z-40" />}>
      <SidebarInner />
    </Suspense>
  );
}
