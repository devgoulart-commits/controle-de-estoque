// Olga Alumínio — Autenticação e controle de acesso por função (admin / gerente / funcionário)
// Observação: autenticação 100% local (localStorage) para uso em terminal interno do pátio.
// As senhas são guardadas como hash SHA-256, mas isso NÃO substitui um backend real
// caso o sistema passe a ser acessado por vários dispositivos em rede.

namespace OlgaAuth {

  export type Role = "admin" | "gerente" | "funcionario";

  export interface Usuario {
    id: string;
    usuario: string;
    nome: string;
    senhaHash: string;
    role: Role;
  }

  export interface Sessao {
    userId: string;
    usuario: string;
    nome: string;
    role: Role;
  }

  const USERS_KEY = "olga-aluminio-usuarios:v1";
  const SESSION_KEY = "olga-aluminio-sessao:v1";

  export const ROLE_LABEL: Record<Role, string> = {
    admin: "Administrador",
    gerente: "Gerente",
    funcionario: "Funcionário",
  };

  async function sha256(texto: string): Promise<string> {
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function usuariosSeed(): Promise<Usuario[]> {
    const seed: Usuario[] = [
      { id: crypto.randomUUID(), usuario: "admin", nome: "Administrador", senhaHash: await sha256("admin123"), role: "admin" },
      { id: crypto.randomUUID(), usuario: "gerente", nome: "Gerente do Pátio", senhaHash: await sha256("gerente123"), role: "gerente" },
      { id: crypto.randomUUID(), usuario: "funcionario", nome: "Funcionário", senhaHash: await sha256("func123"), role: "funcionario" },
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(seed));
    return seed;
  }

  export async function listarUsuarios(): Promise<Usuario[]> {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return usuariosSeed();
    try {
      const parsed = JSON.parse(raw) as Usuario[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : await usuariosSeed();
    } catch {
      return usuariosSeed();
    }
  }

  function salvarUsuarios(lista: Usuario[]): void {
    localStorage.setItem(USERS_KEY, JSON.stringify(lista));
  }

  export async function criarUsuario(dados: { usuario: string; nome: string; senha: string; role: Role }): Promise<{ ok: boolean; erro?: string }> {
    const lista = await listarUsuarios();
    const usuarioNormalizado = dados.usuario.trim().toLowerCase();
    if (lista.some((u) => u.usuario.toLowerCase() === usuarioNormalizado)) {
      return { ok: false, erro: "Já existe um usuário com esse login." };
    }
    lista.push({
      id: crypto.randomUUID(),
      usuario: dados.usuario.trim(),
      nome: dados.nome.trim(),
      senhaHash: await sha256(dados.senha),
      role: dados.role,
    });
    salvarUsuarios(lista);
    return { ok: true };
  }

  export async function atualizarUsuario(id: string, dados: { usuario: string; nome: string; senha?: string; role: Role }): Promise<{ ok: boolean; erro?: string }> {
    const lista = await listarUsuarios();
    const usuarioNormalizado = dados.usuario.trim().toLowerCase();
    if (lista.some((u) => u.id !== id && u.usuario.toLowerCase() === usuarioNormalizado)) {
      return { ok: false, erro: "Já existe um usuário com esse login." };
    }
    const idx = lista.findIndex((u) => u.id === id);
    if (idx < 0) return { ok: false, erro: "Usuário não encontrado." };

    lista[idx] = {
      ...lista[idx],
      usuario: dados.usuario.trim(),
      nome: dados.nome.trim(),
      role: dados.role,
      senhaHash: dados.senha ? await sha256(dados.senha) : lista[idx].senhaHash,
    };
    salvarUsuarios(lista);

    const sessao = sessaoAtual();
    if (sessao && sessao.userId === id) {
      salvarSessao({ userId: id, usuario: lista[idx].usuario, nome: lista[idx].nome, role: lista[idx].role });
    }
    return { ok: true };
  }

  export async function excluirUsuario(id: string): Promise<{ ok: boolean; erro?: string }> {
    const lista = await listarUsuarios();
    const admins = lista.filter((u) => u.role === "admin");
    const alvo = lista.find((u) => u.id === id);
    if (!alvo) return { ok: false, erro: "Usuário não encontrado." };
    if (alvo.role === "admin" && admins.length <= 1) {
      return { ok: false, erro: "Não é possível remover o único administrador." };
    }
    salvarUsuarios(lista.filter((u) => u.id !== id));
    return { ok: true };
  }

  // ---------- Sessão ----------

  function salvarSessao(sessao: Sessao): void {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
  }

  export function sessaoAtual(): Sessao | null {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Sessao;
    } catch {
      return null;
    }
  }

  export async function login(usuario: string, senha: string): Promise<{ ok: boolean; erro?: string }> {
    const lista = await listarUsuarios();
    const encontrado = lista.find((u) => u.usuario.toLowerCase() === usuario.trim().toLowerCase());
    if (!encontrado) return { ok: false, erro: "Usuário ou senha inválidos." };

    const hash = await sha256(senha);
    if (hash !== encontrado.senhaHash) return { ok: false, erro: "Usuário ou senha inválidos." };

    salvarSessao({ userId: encontrado.id, usuario: encontrado.usuario, nome: encontrado.nome, role: encontrado.role });
    return { ok: true };
  }

  export function logout(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  /** Redireciona para a tela de login caso não haja sessão ativa. Use no topo de páginas protegidas. */
  export function exigirLogin(): Sessao | null {
    const sessao = sessaoAtual();
    if (!sessao) {
      window.location.replace("login.html");
      return null;
    }
    return sessao;
  }

  // ---------- Permissões ----------

  export function podeEditarItens(role: Role): boolean {
    return role === "admin" || role === "gerente";
  }

  export function podeExcluirItens(role: Role): boolean {
    return role === "admin";
  }

  export function podeExportar(role: Role): boolean {
    return role === "admin" || role === "gerente";
  }

  export function podeGerenciarUsuarios(role: Role): boolean {
    return role === "admin";
  }
}
