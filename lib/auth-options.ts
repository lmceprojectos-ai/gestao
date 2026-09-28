import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { normalizeUserPerms, roleBasePerms } from '@/lib/permissions';

// Lê as permissões PERSONALIZADAS de um utilizador (ou as do perfil, em falta).
async function loadPermsForUser(userId?: string | null, role?: string | null) {
  try {
    if (!userId) return roleBasePerms(role);
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { permissions: true, role: true } });
    let raw: any = null;
    if ((u as any)?.permissions) {
      try { raw = JSON.parse((u as any).permissions); } catch { raw = null; }
    }
    return normalizeUserPerms(raw, u?.role ?? role);
  } catch {
    return roleBasePerms(role);
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e password são obrigatórios');
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        if (!user) {
          throw new Error('Credenciais inválidas');
        }
        if ((user as any).active === false) {
          throw new Error('Conta desativada. Contacte um administrador.');
        }
        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error('Credenciais inválidas');
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {});
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          pontoRole: (user as any).pontoRole ?? null,
          parceiroId: (user as any).parceiroId ?? null,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.pontoRole = (user as any).pontoRole ?? null;
        token.parceiroId = (user as any).parceiroId ?? null;
        token.perms = await loadPermsForUser(user.id, user.role);
        token.lastSync = Date.now();
        return token;
      }
      // Reler o perfil da base de dados periodicamente para que as alterações
      // de perfil (ex.: promover a administrador) façam efeito sem obrigar o
      // utilizador a terminar e reiniciar sessão.
      const SYNC_INTERVAL = 30 * 1000; // 30 segundos
      if (token?.id && (!token.lastSync || Date.now() - token.lastSync > SYNC_INTERVAL)) {
        try {
          const fresh = await prisma.user.findUnique({
            where: { id: token.id },
            select: { role: true, pontoRole: true, name: true, permissions: true, parceiroId: true },
          });
          if (fresh) {
            token.role = fresh.role;
            token.pontoRole = (fresh as any).pontoRole ?? null;
            token.parceiroId = (fresh as any).parceiroId ?? null;
            token.name = fresh.name;
            // Recarregar também as permissões personalizadas (podem ter sido
            // alteradas pelo administrador).
            let raw: any = null;
            if ((fresh as any).permissions) {
              try { raw = JSON.parse((fresh as any).permissions); } catch { raw = null; }
            }
            token.perms = normalizeUserPerms(raw, fresh.role);
          }
          token.lastSync = Date.now();
        } catch {
          // Em caso de falha, manter os valores atuais do token.
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).pontoRole = token.pontoRole ?? null;
        (session.user as any).parceiroId = token.parceiroId ?? null;
        (session.user as any).perms = token.perms ?? null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
