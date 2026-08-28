// Olga Alumínio — Controle de Estoque
// Lógica principal: persistência local, CRUD, filtros, ordenação e exportação CSV.

interface Item {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  minimo: number;
  preco: number;
  local: string;
}

type SortKey = "codigo" | "nome" | "categoria" | "quantidade" | "minimo" | "preco";
type SortDir = "asc" | "desc";

const STORAGE_KEY = "olga-aluminio-estoque:v1";

const SEED: Item[] = [
  { id: crypto.randomUUID(), codigo: "AL-1001", nome: "Perfil U 6m anodizado fosco", categoria: "Perfis", quantidade: 340, unidade: "barra", minimo: 100, preco: 48.9, local: "Galpão 1, fileira A" },
  { id: crypto.randomUUID(), codigo: "AL-1002", nome: "Perfil L 3m natural", categoria: "Perfis", quantidade: 42, unidade: "barra", minimo: 60, preco: 22.5, local: "Galpão 1, fileira B" },
  { id: crypto.randomUUID(), codigo: "CH-2010", nome: "Chapa lisa 2x1m — 2mm", categoria: "Chapas", quantidade: 18, unidade: "chapa", minimo: 20, preco: 189.0, local: "Galpão 2, prateleira C4" },
  { id: crypto.randomUUID(), codigo: "AC-3050", nome: "Puxador reto 320mm", categoria: "Acessórios", quantidade: 610, unidade: "un", minimo: 150, preco: 6.4, local: "Galpão 2, gaveteiro F" },
  { id: crypto.randomUUID(), codigo: "AC-3061", nome: "Roldana dupla para porta de correr", categoria: "Acessórios", quantidade: 75, unidade: "un", minimo: 80, preco: 14.2, local: "Galpão 2, gaveteiro F" },
  { id: crypto.randomUUID(), codigo: "PC-4400", nome: "Perfil pintado preto fosco 6m", categoria: "Perfis", quantidade: 128, unidade: "barra", minimo: 50, preco: 61.3, local: "Galpão 1, fileira D" },
];

// ---------- Sessão / permissões ----------

const sessao = OlgaAuth.exigirLogin();
// exigirLogin() já redireciona para login.html quando não há sessão.
// A partir daqui, "sessao" está sempre presente em tempo de execução.
const role: OlgaAuth.Role = sessao ? sessao.role : "funcionario";

// ---------- Estado ----------

let itens: Item[] = [];
let sortKey: SortKey = "nome";
let sortDir: SortDir = "asc";

// ---------- Persistência ----------

function carregar(): Item[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    salvar(SEED);
    return SEED;
  }
  try {
    const parsed = JSON.parse(raw) as Item[];
    return Array.isArray(parsed) ? parsed : SEED;
  } catch {
    return SEED;
  }
}

function salvar(dados: Item[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dados));
}

// ---------- Elementos ----------

const tbody = document.getElementById("tbody") as HTMLTableSectionElement;
const emptyState = document.getElementById("emptyState") as HTMLParagraphElement;
const buscaInput = document.getElementById("busca") as HTMLInputElement;
const filtroCategoria = document.getElementById("filtroCategoria") as HTMLSelectElement;
const filtroStatus = document.getElementById("filtroStatus") as HTMLSelectElement;
const listaCategorias = document.getElementById("listaCategorias") as HTMLDataListElement;

const overlay = document.getElementById("overlay") as HTMLDivElement;
const drawer = document.getElementById("drawer") as HTMLDivElement;
const drawerTitle = document.getElementById("drawerTitle") as HTMLHeadingElement;
const form = document.getElementById("form") as HTMLFormElement;
const btnNew = document.getElementById("btnNew") as HTMLButtonElement;
const btnClose = document.getElementById("btnClose") as HTMLButtonElement;
const btnCancel = document.getElementById("btnCancel") as HTMLButtonElement;
const btnDelete = document.getElementById("btnDelete") as HTMLButtonElement;
const btnExport = document.getElementById("btnExport") as HTMLButtonElement;
const toast = document.getElementById("toast") as HTMLDivElement;

const fId = document.getElementById("itemId") as HTMLInputElement;
const fCodigo = document.getElementById("fCodigo") as HTMLInputElement;
const fNome = document.getElementById("fNome") as HTMLInputElement;
const fCategoria = document.getElementById("fCategoria") as HTMLInputElement;
const fQuantidade = document.getElementById("fQuantidade") as HTMLInputElement;
const fUnidade = document.getElementById("fUnidade") as HTMLInputElement;
const fMinimo = document.getElementById("fMinimo") as HTMLInputElement;
const fPreco = document.getElementById("fPreco") as HTMLInputElement;
const fLocal = document.getElementById("fLocal") as HTMLInputElement;

const kpiTotalItens = document.getElementById("kpiTotalItens") as HTMLElement;
const kpiTotalUnidades = document.getElementById("kpiTotalUnidades") as HTMLElement;
const kpiValorTotal = document.getElementById("kpiValorTotal") as HTMLElement;
const kpiBaixoEstoque = document.getElementById("kpiBaixoEstoque") as HTMLElement;

const userNome = document.getElementById("userNome") as HTMLElement;
const userRoleEl = document.getElementById("userRole") as HTMLElement;
const btnSair = document.getElementById("btnSair") as HTMLButtonElement;
const btnUsuarios = document.getElementById("btnUsuarios") as HTMLButtonElement;

const overlayUsuarios = document.getElementById("overlayUsuarios") as HTMLDivElement;
const drawerUsuarios = document.getElementById("drawerUsuarios") as HTMLDivElement;
const btnCloseUsuarios = document.getElementById("btnCloseUsuarios") as HTMLButtonElement;
const userList = document.getElementById("userList") as HTMLDivElement;
const formUsuario = document.getElementById("formUsuario") as HTMLFormElement;
const userFormTitle = document.getElementById("userFormTitle") as HTMLHeadingElement;
const userFormError = document.getElementById("userFormError") as HTMLParagraphElement;
const btnCancelUsuario = document.getElementById("btnCancelUsuario") as HTMLButtonElement;
const uId = document.getElementById("uId") as HTMLInputElement;
const uNome = document.getElementById("uNome") as HTMLInputElement;
const uUsuario = document.getElementById("uUsuario") as HTMLInputElement;
const uSenha = document.getElementById("uSenha") as HTMLInputElement;
const uSenhaHint = document.getElementById("uSenhaHint") as HTMLElement;
const uRole = document.getElementById("uRole") as HTMLSelectElement;

// ---------- Formatação ----------

const fmtMoeda = (v: number): string =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtNum = (v: number): string => v.toLocaleString("pt-BR");

function estaBaixo(item: Item): boolean {
  return item.quantidade <= item.minimo;
}

// ---------- Renderização ----------

function categoriasUnicas(): string[] {
  return Array.from(new Set(itens.map((i) => i.categoria))).sort((a, b) =>
    a.localeCompare(b, "pt-BR")
  );
}

function atualizarCategorias(): void {
  const atual = filtroCategoria.value;
  const cats = categoriasUnicas();

  filtroCategoria.innerHTML = '<option value="todas">Todas as categorias</option>';
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    filtroCategoria.appendChild(opt);
  });
  if (cats.includes(atual)) filtroCategoria.value = atual;

  listaCategorias.innerHTML = "";
  cats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    listaCategorias.appendChild(opt);
  });
}

function itensFiltrados(): Item[] {
  const termo = buscaInput.value.trim().toLowerCase();
  const cat = filtroCategoria.value;
  const status = filtroStatus.value;

  let lista = itens.filter((i) => {
    const bateBusca =
      !termo ||
      i.codigo.toLowerCase().includes(termo) ||
      i.nome.toLowerCase().includes(termo);
    const bateCategoria = cat === "todas" || !cat || i.categoria === cat;
    const bateStatus =
      status === "todos" ||
      (status === "baixo" && estaBaixo(i)) ||
      (status === "ok" && !estaBaixo(i));
    return bateBusca && bateCategoria && bateStatus;
  });

  lista = lista.sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    let cmp: number;
    if (typeof va === "number" && typeof vb === "number") {
      cmp = va - vb;
    } else {
      cmp = String(va).localeCompare(String(vb), "pt-BR");
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return lista;
}

function renderTabela(): void {
  const lista = itensFiltrados();
  tbody.innerHTML = "";
  emptyState.hidden = lista.length > 0;

  lista.forEach((item) => {
    const tr = document.createElement("tr");
    if (estaBaixo(item)) tr.classList.add("low-stock");

    tr.innerHTML = `
      <td data-label="Código"><span class="cell-codigo">${escapeHtml(item.codigo)}</span></td>
      <td data-label="Produto">
        <span class="cell-nome">${escapeHtml(item.nome)}</span>
        ${item.local ? `<span class="cell-local">${escapeHtml(item.local)}</span>` : ""}
      </td>
      <td data-label="Categoria"><span class="cell-cat">${escapeHtml(item.categoria)}</span></td>
      <td data-label="Qtd." class="num"><span class="qty-badge">${fmtNum(item.quantidade)}</span></td>
      <td data-label="Unid.">${escapeHtml(item.unidade)}</td>
      <td data-label="Mínimo" class="num">${fmtNum(item.minimo)}</td>
      <td data-label="Preço unit." class="num">${fmtMoeda(item.preco)}</td>
      <td data-label="Total" class="num">${fmtMoeda(item.preco * item.quantidade)}</td>
      <td data-label="Ações">
        <div class="row-actions">
          <button class="icon-btn" data-action="editar" data-id="${item.id}" type="button">
            ${OlgaAuth.podeEditarItens(role) ? "Editar" : "Ver"}
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  atualizarKpis();
}

function atualizarKpis(): void {
  const totalItens = itens.length;
  const totalUnidades = itens.reduce((s, i) => s + i.quantidade, 0);
  const valorTotal = itens.reduce((s, i) => s + i.quantidade * i.preco, 0);
  const baixo = itens.filter(estaBaixo).length;

  kpiTotalItens.textContent = fmtNum(totalItens);
  kpiTotalUnidades.textContent = fmtNum(totalUnidades);
  kpiValorTotal.textContent = fmtMoeda(valorTotal);
  kpiBaixoEstoque.textContent = fmtNum(baixo);
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// ---------- Drawer / formulário ----------

function abrirDrawer(item?: Item): void {
  form.reset();
  const podeEditar = OlgaAuth.podeEditarItens(role);

  if (item) {
    drawerTitle.textContent = podeEditar ? "Editar item" : "Detalhes do item";
    fId.value = item.id;
    fCodigo.value = item.codigo;
    fNome.value = item.nome;
    fCategoria.value = item.categoria;
    fQuantidade.value = String(item.quantidade);
    fUnidade.value = item.unidade;
    fMinimo.value = String(item.minimo);
    fPreco.value = String(item.preco);
    fLocal.value = item.local ?? "";
    btnDelete.hidden = !(podeEditar && OlgaAuth.podeExcluirItens(role));
  } else {
    if (!podeEditar) return;
    drawerTitle.textContent = "Novo item";
    fId.value = "";
    btnDelete.hidden = true;
  }

  [fCodigo, fNome, fCategoria, fQuantidade, fUnidade, fMinimo, fPreco, fLocal].forEach((campo) => {
    campo.disabled = !podeEditar;
  });
  const btnSalvar = form.querySelector("button[type='submit']") as HTMLButtonElement;
  btnSalvar.hidden = !podeEditar;

  overlay.hidden = false;
  drawer.classList.add("open");
  drawer.setAttribute("aria-hidden", "false");
  window.setTimeout(() => fCodigo.focus(), 50);
}

function fecharDrawer(): void {
  drawer.classList.remove("open");
  drawer.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
}

function mostrarToast(msg: string): void {
  toast.textContent = msg;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const dados: Item = {
    id: fId.value || crypto.randomUUID(),
    codigo: fCodigo.value.trim(),
    nome: fNome.value.trim(),
    categoria: fCategoria.value.trim(),
    quantidade: Number(fQuantidade.value),
    unidade: fUnidade.value.trim(),
    minimo: Number(fMinimo.value),
    preco: Number(fPreco.value),
    local: fLocal.value.trim(),
  };

  if (!dados.codigo || !dados.nome || !dados.categoria || !dados.unidade) return;

  const existente = itens.findIndex((i) => i.id === dados.id);
  if (existente >= 0) {
    itens[existente] = dados;
    mostrarToast(`Item "${dados.nome}" atualizado.`);
  } else {
    itens.push(dados);
    mostrarToast(`Item "${dados.nome}" cadastrado.`);
  }

  salvar(itens);
  atualizarCategorias();
  renderTabela();
  fecharDrawer();
});

btnNew.addEventListener("click", () => abrirDrawer());
btnClose.addEventListener("click", fecharDrawer);
btnCancel.addEventListener("click", fecharDrawer);
overlay.addEventListener("click", fecharDrawer);

btnDelete.addEventListener("click", () => {
  const id = fId.value;
  if (!id) return;
  const item = itens.find((i) => i.id === id);
  if (!item) return;
  if (!confirm(`Excluir "${item.nome}" do estoque?`)) return;
  itens = itens.filter((i) => i.id !== id);
  salvar(itens);
  atualizarCategorias();
  renderTabela();
  fecharDrawer();
  mostrarToast(`Item "${item.nome}" excluído.`);
});

tbody.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest("[data-action='editar']") as HTMLButtonElement | null;
  if (!btn) return;
  const item = itens.find((i) => i.id === btn.dataset.id);
  if (item) abrirDrawer(item);
});

// ---------- Filtros e ordenação ----------

buscaInput.addEventListener("input", renderTabela);
filtroCategoria.addEventListener("change", renderTabela);
filtroStatus.addEventListener("change", renderTabela);

document.querySelectorAll("th[data-sort]").forEach((th) => {
  th.addEventListener("click", () => {
    const key = (th as HTMLElement).dataset.sort as SortKey;
    if (sortKey === key) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortKey = key;
      sortDir = "asc";
    }
    renderTabela();
  });
});

// ---------- Exportação CSV ----------

function exportarCsv(): void {
  const cabecalho = ["Código", "Nome", "Categoria", "Quantidade", "Unidade", "Mínimo", "Preço unitário", "Valor total", "Local"];
  const linhas = itens.map((i) => [
    i.codigo,
    i.nome,
    i.categoria,
    String(i.quantidade),
    i.unidade,
    String(i.minimo),
    i.preco.toFixed(2).replace(".", ","),
    (i.preco * i.quantidade).toFixed(2).replace(".", ","),
    i.local ?? "",
  ]);

  const csv = [cabecalho, ...linhas]
    .map((linha) => linha.map((campo) => `"${campo.replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const data = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `olga-aluminio-estoque-${data}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

btnExport.addEventListener("click", exportarCsv);

// ---------- Atalhos de teclado ----------

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && drawer.classList.contains("open")) fecharDrawer();
});

// ---------- Sessão / topbar ----------

function aplicarPermissoesNaTela(): void {
  if (!sessao) return;
  userNome.textContent = sessao.nome;
  userRoleEl.textContent = OlgaAuth.ROLE_LABEL[sessao.role];
  userRoleEl.dataset.role = sessao.role;

  btnNew.hidden = !OlgaAuth.podeEditarItens(role);
  btnExport.hidden = !OlgaAuth.podeExportar(role);
  btnUsuarios.hidden = !OlgaAuth.podeGerenciarUsuarios(role);
}

btnSair.addEventListener("click", () => {
  OlgaAuth.logout();
  window.location.replace("login.html");
});

// ---------- Painel de usuários (admin) ----------

function fecharDrawerUsuarios(): void {
  drawerUsuarios.classList.remove("open");
  drawerUsuarios.setAttribute("aria-hidden", "true");
  overlayUsuarios.hidden = true;
}

function limparFormUsuario(): void {
  formUsuario.reset();
  uId.value = "";
  userFormTitle.textContent = "Novo usuário";
  uSenha.required = true;
  uSenhaHint.textContent = "Mínimo 4 caracteres.";
  userFormError.hidden = true;
}

async function renderUsuarios(): Promise<void> {
  const lista = await OlgaAuth.listarUsuarios();
  userList.innerHTML = "";

  lista
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    .forEach((u) => {
      const row = document.createElement("div");
      row.className = "user-row";
      row.innerHTML = `
        <div class="user-row-info">
          <span class="user-row-nome">${escapeHtml(u.nome)}</span>
          <span class="user-row-meta">@${escapeHtml(u.usuario)} · ${OlgaAuth.ROLE_LABEL[u.role]}</span>
        </div>
        <div class="row-actions">
          <button class="icon-btn" data-action="editar-usuario" data-id="${u.id}" type="button">Editar</button>
          <button class="icon-btn" data-action="excluir-usuario" data-id="${u.id}" type="button">Excluir</button>
        </div>
      `;
      userList.appendChild(row);
    });
}

async function abrirDrawerUsuarios(): Promise<void> {
  limparFormUsuario();
  await renderUsuarios();
  overlayUsuarios.hidden = false;
  drawerUsuarios.classList.add("open");
  drawerUsuarios.setAttribute("aria-hidden", "false");
}

btnUsuarios.addEventListener("click", abrirDrawerUsuarios);
btnCloseUsuarios.addEventListener("click", fecharDrawerUsuarios);
overlayUsuarios.addEventListener("click", fecharDrawerUsuarios);
btnCancelUsuario.addEventListener("click", limparFormUsuario);

userList.addEventListener("click", async (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest("button[data-id]") as HTMLButtonElement | null;
  if (!btn) return;
  const id = btn.dataset.id as string;
  const acao = btn.dataset.action;

  if (acao === "editar-usuario") {
    const lista = await OlgaAuth.listarUsuarios();
    const u = lista.find((x) => x.id === id);
    if (!u) return;
    uId.value = u.id;
    uNome.value = u.nome;
    uUsuario.value = u.usuario;
    uSenha.value = "";
    uSenha.required = false;
    uSenhaHint.textContent = "Deixe em branco para manter a senha atual.";
    uRole.value = u.role;
    userFormTitle.textContent = `Editar usuário — ${u.nome}`;
    userFormError.hidden = true;
  }

  if (acao === "excluir-usuario") {
    if (id === sessao?.userId) {
      mostrarToast("Você não pode excluir o próprio usuário logado.");
      return;
    }
    if (!confirm("Excluir este usuário?")) return;
    const resultado = await OlgaAuth.excluirUsuario(id);
    if (!resultado.ok) {
      mostrarToast(resultado.erro || "Não foi possível excluir.");
      return;
    }
    await renderUsuarios();
    mostrarToast("Usuário excluído.");
  }
});

formUsuario.addEventListener("submit", async (e) => {
  e.preventDefault();
  userFormError.hidden = true;

  if (uSenha.required && uSenha.value.length < 4) {
    userFormError.textContent = "A senha deve ter ao menos 4 caracteres.";
    userFormError.hidden = false;
    return;
  }
  if (uSenha.value && uSenha.value.length < 4) {
    userFormError.textContent = "A senha deve ter ao menos 4 caracteres.";
    userFormError.hidden = false;
    return;
  }

  const dados = {
    usuario: uUsuario.value,
    nome: uNome.value,
    role: uRole.value as OlgaAuth.Role,
  };

  const resultado = uId.value
    ? await OlgaAuth.atualizarUsuario(uId.value, { ...dados, senha: uSenha.value || undefined })
    : await OlgaAuth.criarUsuario({ ...dados, senha: uSenha.value });

  if (!resultado.ok) {
    userFormError.textContent = resultado.erro || "Não foi possível salvar.";
    userFormError.hidden = false;
    return;
  }

  mostrarToast(uId.value ? "Usuário atualizado." : "Usuário cadastrado.");
  limparFormUsuario();
  await renderUsuarios();
  aplicarPermissoesNaTela();
});

// ---------- Inicialização ----------

function iniciar(): void {
  aplicarPermissoesNaTela();
  itens = carregar();
  atualizarCategorias();
  renderTabela();
}

iniciar();
