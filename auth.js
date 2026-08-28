"use strict";
// Olga Alumínio — Autenticação e controle de acesso por função (admin / gerente / funcionário)
// Observação: autenticação 100% local (localStorage) para uso em terminal interno do pátio.
// As senhas são guardadas como hash SHA-256, mas isso NÃO substitui um backend real
// caso o sistema passe a ser acessado por vários dispositivos em rede.
var OlgaAuth;
(function (OlgaAuth) {
    const USERS_KEY = "olga-aluminio-usuarios:v1";
    const SESSION_KEY = "olga-aluminio-sessao:v1";
    OlgaAuth.ROLE_LABEL = {
        admin: "Administrador",
        gerente: "Gerente",
        funcionario: "Funcionário",
    };
    async function sha256(texto) {
        const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
        return Array.from(new Uint8Array(buffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }
    async function usuariosSeed() {
        const seed = [
            { id: crypto.randomUUID(), usuario: "admin", nome: "Administrador", senhaHash: await sha256("admin123"), role: "admin" },
            { id: crypto.randomUUID(), usuario: "gerente", nome: "Gerente do Pátio", senhaHash: await sha256("gerente123"), role: "gerente" },
            { id: crypto.randomUUID(), usuario: "funcionario", nome: "Funcionário", senhaHash: await sha256("func123"), role: "funcionario" },
        ];
        localStorage.setItem(USERS_KEY, JSON.stringify(seed));
        return seed;
    }
    async function listarUsuarios() {
        const raw = localStorage.getItem(USERS_KEY);
        if (!raw)
            return usuariosSeed();
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : await usuariosSeed();
        }
        catch {
            return usuariosSeed();
        }
    }
    OlgaAuth.listarUsuarios = listarUsuarios;
    function salvarUsuarios(lista) {
        localStorage.setItem(USERS_KEY, JSON.stringify(lista));
    }
    async function criarUsuario(dados) {
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
    OlgaAuth.criarUsuario = criarUsuario;
    async function atualizarUsuario(id, dados) {
        const lista = await listarUsuarios();
        const usuarioNormalizado = dados.usuario.trim().toLowerCase();
        if (lista.some((u) => u.id !== id && u.usuario.toLowerCase() === usuarioNormalizado)) {
            return { ok: false, erro: "Já existe um usuário com esse login." };
        }
        const idx = lista.findIndex((u) => u.id === id);
        if (idx < 0)
            return { ok: false, erro: "Usuário não encontrado." };
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
    OlgaAuth.atualizarUsuario = atualizarUsuario;
    async function excluirUsuario(id) {
        const lista = await listarUsuarios();
        const admins = lista.filter((u) => u.role === "admin");
        const alvo = lista.find((u) => u.id === id);
        if (!alvo)
            return { ok: false, erro: "Usuário não encontrado." };
        if (alvo.role === "admin" && admins.length <= 1) {
            return { ok: false, erro: "Não é possível remover o único administrador." };
        }
        salvarUsuarios(lista.filter((u) => u.id !== id));
        return { ok: true };
    }
    OlgaAuth.excluirUsuario = excluirUsuario;
    // ---------- Sessão ----------
    function salvarSessao(sessao) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessao));
    }
    function sessaoAtual() {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch {
            return null;
        }
    }
    OlgaAuth.sessaoAtual = sessaoAtual;
    async function login(usuario, senha) {
        const lista = await listarUsuarios();
        const encontrado = lista.find((u) => u.usuario.toLowerCase() === usuario.trim().toLowerCase());
        if (!encontrado)
            return { ok: false, erro: "Usuário ou senha inválidos." };
        const hash = await sha256(senha);
        if (hash !== encontrado.senhaHash)
            return { ok: false, erro: "Usuário ou senha inválidos." };
        salvarSessao({ userId: encontrado.id, usuario: encontrado.usuario, nome: encontrado.nome, role: encontrado.role });
        return { ok: true };
    }
    OlgaAuth.login = login;
    function logout() {
        localStorage.removeItem(SESSION_KEY);
    }
    OlgaAuth.logout = logout;
    /** Redireciona para a tela de login caso não haja sessão ativa. Use no topo de páginas protegidas. */
    function exigirLogin() {
        const sessao = sessaoAtual();
        if (!sessao) {
            window.location.replace("login.html");
            return null;
        }
        return sessao;
    }
    OlgaAuth.exigirLogin = exigirLogin;
    // ---------- Permissões ----------
    function podeEditarItens(role) {
        return role === "admin" || role === "gerente";
    }
    OlgaAuth.podeEditarItens = podeEditarItens;
    function podeExcluirItens(role) {
        return role === "admin";
    }
    OlgaAuth.podeExcluirItens = podeExcluirItens;
    function podeExportar(role) {
        return role === "admin" || role === "gerente";
    }
    OlgaAuth.podeExportar = podeExportar;
    function podeGerenciarUsuarios(role) {
        return role === "admin";
    }
    OlgaAuth.podeGerenciarUsuarios = podeGerenciarUsuarios;
})(OlgaAuth || (OlgaAuth = {}));
