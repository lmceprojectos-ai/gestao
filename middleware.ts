import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { effectivePontoRole, hasGestaoAccess } from '@/lib/ponto/roles';
import { areasForPath, isPathAllowed, roleBasePerms, type RolePermissions } from '@/lib/permissions';

export default withAuth(
  function middleware(req) {
    const token: any = (req as any).nextauth?.token;
    const { pathname } = req.nextUrl;
    const method = req.method;

    // Sem token: deixar os handlers/páginas tratarem (401 / redireccionamento)
    if (!token) return NextResponse.next();

    const role = token.role || 'admin';

    // Perfil exclusivo dos Parceiros (ex.: a conta da Reclamarte): só a conta corrente.
    if (role === 'parceiro') {
      const allowed = pathname.startsWith('/parceiros') || pathname.startsWith('/api/parceiros') || pathname.startsWith('/api/auth');
      if (allowed) return NextResponse.next();
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      return NextResponse.redirect(new URL('/parceiros', req.url));
    }

    // Perfil efetivo no módulo de ponto (dá prioridade ao pontoRole dedicado).
    const effPonto = effectivePontoRole(token.pontoRole, role);

    // Perfis exclusivos do módulo de ponto: contas SEM acesso à Gestão cujo perfil
    // de ponto é COLABORADOR ou QR. Só podem aceder ao módulo de ponto e à sua
    // área pessoal. Colaboradores que TAMBÉM são perfis da Gestão (ex.: admin/editor)
    // mantêm o acesso normal à Gestão e não são reencaminhados.
    if (!hasGestaoAccess(role) && (effPonto === 'COLABORADOR' || effPonto === 'QR')) {
      const pontoDest = effPonto === 'QR' ? '/ponto/presenca' : '/ponto/colaborador';
      const allowed =
        pathname.startsWith('/ponto') ||
        pathname.startsWith('/api/ponto') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/perfil') ||
        pathname.startsWith('/perfil') ||
        // Conexus: só as suas tarefas, se a conta estiver ligada a um colaborador.
        (!!token.collaboratorId && (pathname.startsWith('/conexus') || pathname.startsWith('/api/conexus')));
      if (pathname.startsWith('/api/')) {
        if (!allowed) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
        return NextResponse.next();
      }
      if (!allowed) return NextResponse.redirect(new URL(pontoDest, req.url));
      return NextResponse.next();
    }

    const isAdmin = role === 'admin';

    // Conexus (agenda de assuntos): administradores e contas ligadas a um
    // colaborador do Conexus (estas só veem as suas tarefas — ver as rotas).
    if (!isAdmin && !token.collaboratorId && (pathname.startsWith('/conexus') || pathname.startsWith('/api/conexus'))) {
      if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Permissões do utilizador (personalizadas pelo administrador ou as do
    // perfil). Guardadas no token; se ausentes (sessões antigas), usar os
    // valores por defeito do perfil, que reproduzem o comportamento base.
    const perms: RolePermissions = token.perms || roleBasePerms(role);

    // Área de gestão de utilizadores: reservada a administradores e editores
    // (backstop). O acesso fino do editor é depois governado pela matriz.
    if (pathname.startsWith('/api/users')) {
      if (role !== 'admin' && role !== 'editor') return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    if (pathname.startsWith('/utilizadores')) {
      if (role !== 'admin' && role !== 'editor') return NextResponse.redirect(new URL('/', req.url));
    }

    // Espaço pessoal de Documentos IRS: qualquer utilizador autenticado gere os SEUS
    // próprios documentos (a rota valida a posse por userId). Isento das restrições.
    if (pathname.startsWith('/api/documentos-irs')) {
      return NextResponse.next();
    }
    // Perfil pessoal: qualquer utilizador autenticado gere o SEU próprio perfil.
    if (pathname.startsWith('/api/perfil')) {
      return NextResponse.next();
    }

    // ===== Governação por ÁREA (matriz de permissões por perfil) =====
    if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
      const areas = areasForPath(pathname);
      if (areas.length > 0) {
        // Caminho governado pela matriz.
        if (!isAdmin && !isPathAllowed(perms, pathname, method)) {
          return NextResponse.json({ error: 'Sem permissão para esta operação. Contacte um administrador.' }, { status: 403 });
        }
      } else {
        // Caminho NÃO governado (ex.: categorias, configurações, dashboard):
        // manter as regras base por perfil como salvaguarda.
        if (role === 'leitura' && !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
          return NextResponse.json({ error: 'Sem permissão para alterar dados (perfil de leitura)' }, { status: 403 });
        }
        if (role === 'insercao' && !['GET', 'HEAD', 'OPTIONS', 'POST'].includes(method)) {
          return NextResponse.json({ error: 'Sem permissão para editar ou apagar (perfil de inserção). Contacte um administrador.' }, { status: 403 });
        }
      }
    } else if (!pathname.startsWith('/api/')) {
      // Páginas governadas: exigir pelo menos acesso de leitura à área.
      const areas = areasForPath(pathname);
      if (areas.length > 0 && !isAdmin && !isPathAllowed(perms, pathname, 'GET')) {
        return NextResponse.redirect(new URL('/', req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // Rotas de API: deixar passar (os handlers validam a sessão e devolvem 401)
        if (pathname.startsWith('/api/')) return true;
        // Páginas: exigem sessão
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: [
    '/((?!login|signup|convite|forgot-password|reset-password|api/auth|api/local-storage|_next/static|_next/image|favicon|apple-icon|manifests/|icones/|icon-criaconsensos|og-image\.png|logo-criaconsensos).*)',
  ],
};
