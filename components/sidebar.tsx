'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
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
  Printer,
  Calculator,
  GripVertical,
  FileUp,
  ListOrdered,
  ShieldCheck,
  FolderLock,
  UserCircle,
  ScanLine,
  Clock,
  Share2,
} from 'lucide-react';
import { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import Image from 'next/image';
import { type AreaKey, type RolePermissions, DEFAULT_PERMISSIONS } from '@/lib/permissions';

type NavItem = {
  href: string;
  label: string;
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
    { href: '/clientes', label: 'Clientes', icon: Users, area: 'clientes' },
    { href: '/faturas?tipo=emitida&origem=cliente', label: 'Faturas Clientes', icon: FileText, tipo: 'emitida', origem: 'cliente', sub: true, area: 'clientes' },
    { href: '/faturas?tipo=recibo&origem=cliente', label: 'Recibos', icon: FileCheck, tipo: 'recibo', origem: 'cliente', sub: true, area: 'clientes' },
    { href: '/faturas?tipo=nota&origem=cliente', label: 'Notas', icon: FileMinus, tipo: 'nota', origem: 'cliente', sub: true, area: 'clientes' },
    { href: '/recebimentos', label: 'Recebimentos', icon: ArrowDownCircle, area: 'clientes' },
  ] },
  { title: 'Fornecedores', items: [
    { href: '/fornecedores', label: 'Fornecedores', icon: Truck, area: 'fornecedores' },
    { href: '/faturas?tipo=recebida&origem=fornecedor', label: 'Faturas Fornecedores', icon: FileText, tipo: 'recebida', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/faturas?tipo=recibo&origem=fornecedor', label: 'Recibos', icon: FileCheck, tipo: 'recibo', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/faturas?tipo=nota&origem=fornecedor', label: 'Notas', icon: FileMinus, tipo: 'nota', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/faturas?tipo=orcamento&origem=fornecedor', label: 'Orçamentos', icon: ClipboardList, tipo: 'orcamento', origem: 'fornecedor', sub: true, area: 'fornecedores' },
    { href: '/pagamentos', label: 'Pagamentos', icon: ArrowUpCircle, area: 'fornecedores' },
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
  ] },
  { title: 'Orçamentos', items: [
    { href: '/orcamentos-graficos', label: 'Orçamentos Gráficos', icon: Printer, area: 'orcamentos' },
    { href: '/orcamentos-graficos/dashboard', label: 'Dashboard de Orçamentos', icon: LayoutDashboard, sub: true, area: 'orcamentos' },
    { href: '/orcamentos-graficos/config', label: 'Configuração Gráfica', icon: Calculator, sub: true, adminOnly: true, area: 'orcamentos' },
  ]},
  { title: 'Gestão', items: [
    { href: '/emprestimos', label: 'Empréstimos Sócio', icon: Handshake, hideForInsercao: true, area: 'gestao' },
    { href: '/relatorios', label: 'Relatórios', icon: BarChart3, hideForInsercao: true, area: 'gestao' },
    { href: '/moloni', label: 'Moloni', icon: Plug, area: 'gestao' },
    { href: '/utilizadores', label: 'Utilizadores', icon: UserCog, adminEditorOnly: true, area: 'utilizadores' },
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

function ReorderableNavItem({
  item,
  isActive,
  color,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  color: string;
  onNavigate: () => void;
}) {
  const controls = useDragControls();
  const Icon = item?.icon;
  return (
    <Reorder.Item
      as="div"
      value={item}
      dragListener={false}
      dragControls={controls}
      style={{ backgroundColor: isActive ? color + '2e' : undefined }}
      className={cn(
        'group flex items-center rounded-lg text-[14px] font-medium transition-all duration-150',
        isActive ? 'text-white shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white'
      )}
    >
      <button
        type="button"
        aria-label="Reordenar item"
        onPointerDown={(e) => controls.start(e)}
        onClick={(e) => e.preventDefault()}
        className="flex-shrink-0 pl-2 pr-1 py-2.5 cursor-grab active:cursor-grabbing text-white/25 hover:text-white/70 touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Link
        href={item?.href ?? '/'}
        onClick={onNavigate}
        className={cn('flex items-center gap-3 py-2.5 pr-3 flex-1 min-w-0', item?.sub ? 'pl-2' : 'pl-0')}
      >
        {Icon && <Icon style={{ color }} className={cn('flex-shrink-0', item?.sub ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
        <span className="truncate">{item?.label}</span>
      </Link>
    </Reorder.Item>
  );
}

function SidebarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession() || {};
  const role = (session?.user as any)?.role || '';
  const isAdmin = role === 'admin';
  const isEditor = role === 'editor';
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

  // Ordem personalizada dos itens (por secção), guardada no navegador por utilizador.
  // Começa vazio para manter a hidratação determinística; carrega em useEffect após montar.
  const [order, setOrder] = useState<Record<string, string[]>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sidebar_order');
      if (saved) setOrder(JSON.parse(saved));
    } catch {}
  }, []);

  const sectionKey = (title: string | null) => title ?? '__main__';

  const applyOrder = (title: string | null, items: NavItem[]) => {
    const saved = order[sectionKey(title)];
    if (!saved || saved.length === 0) return items;
    const byHref = new Map(items.map((it) => [it.href, it]));
    const result: NavItem[] = [];
    for (const href of saved) {
      const it = byHref.get(href);
      if (it) { result.push(it); byHref.delete(href); }
    }
    // Itens novos/desconhecidos ficam no fim, mantendo a ordem original.
    for (const it of items) if (byHref.has(it.href)) result.push(it);
    return result;
  };

  const handleReorder = (title: string | null, newItems: NavItem[]) => {
    setOrder((prev) => {
      const next = { ...prev, [sectionKey(title)]: newItems.map((it) => it.href) };
      try { localStorage.setItem('sidebar_order', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const sections = navSections
    .map((s) => ({ ...s, items: s.items.filter((it) => (!it.adminOnly || isAdmin) && (!it.adminEditorOnly || isAdmin || isEditor) && !(it.hideForInsercao && isInsercao) && areaVisible(it.area)) }))
    .filter((s) => s.items.length > 0);

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

        {sections?.map((section: any, si: number) => {
          const isCollapsed = section?.title ? !!collapsed[section.title] : false;
          return (
          <div key={si} className="space-y-1">
            {section?.title && (
              <button
                type="button"
                onClick={() => toggleSection(section.title)}
                style={{ color: sectionColor(section.title) }}
                className="w-full flex items-center justify-between px-3 pt-1 pb-0.5 text-[14px] font-semibold uppercase tracking-wider opacity-80 hover:opacity-100 transition-opacity"
              >
                <span>{section.title}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-200', isCollapsed && '-rotate-90')} />
              </button>
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
                  <Reorder.Group
                    as="div"
                    axis="y"
                    values={applyOrder(section.title, section.items)}
                    onReorder={(newItems: NavItem[]) => handleReorder(section.title, newItems)}
                    className="space-y-1"
                  >
                    {applyOrder(section.title, section.items).map((item: NavItem) => (
                      <ReorderableNavItem
                        key={item.href}
                        item={item}
                        isActive={itemIsActive(item)}
                        color={sectionColor(section.title)}
                        onNavigate={() => setMobileOpen(false)}
                      />
                    ))}
                  </Reorder.Group>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
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
        <NavContent />
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
              <NavContent />
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
