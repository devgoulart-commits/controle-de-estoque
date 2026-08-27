-- ============================================================
-- CONTROLE DE ESTOQUE - OLGA ALUMÍNIO
-- PostgreSQL / Supabase
-- Versão: 1.0
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================

create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

do $$
begin

    if not exists (
        select 1 from pg_type where typname = 'tipo_movimentacao'
    ) then
        create type tipo_movimentacao as enum (
            'ENTRADA',
            'SAIDA',
            'AJUSTE',
            'TRANSFERENCIA_ENTRADA',
            'TRANSFERENCIA_SAIDA',
            'DEVOLUCAO'
        );
    end if;

    if not exists (
        select 1 from pg_type where typname = 'status_compra'
    ) then
        create type status_compra as enum (
            'PENDENTE',
            'APROVADA',
            'RECEBIDA',
            'CANCELADA'
        );
    end if;

    if not exists (
        select 1 from pg_type where typname = 'perfil_usuario'
    ) then
        create type perfil_usuario as enum (
            'ADMIN',
            'GERENTE',
            'ESTOQUISTA',
            'COMPRAS',
            'CONSULTA'
        );
    end if;

end $$;


-- ============================================================
-- EMPRESA
-- ============================================================

create table if not exists empresas (
    id uuid primary key default gen_random_uuid(),

    razao_social varchar(200) not null,
    nome_fantasia varchar(200),
    cnpj varchar(18),

    telefone varchar(30),
    email varchar(150),

    endereco text,
    cidade varchar(100),
    estado varchar(2),
    cep varchar(10),

    ativo boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint empresas_cnpj_unique unique (cnpj)
);


-- ============================================================
-- USUÁRIOS
-- ============================================================

create table if not exists usuarios (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    auth_user_id uuid unique,

    nome varchar(150) not null,
    email varchar(150),

    perfil perfil_usuario not null default 'ESTOQUISTA',

    ativo boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint usuarios_email_unique unique (empresa_id, email)
);


-- ============================================================
-- CATEGORIAS
-- ============================================================

create table if not exists categorias (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    nome varchar(100) not null,
    descricao text,

    ativo boolean not null default true,

    created_at timestamptz not null default now(),

    constraint categorias_nome_unique
        unique (empresa_id, nome)
);


-- ============================================================
-- FORNECEDORES
-- ============================================================

create table if not exists fornecedores (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    razao_social varchar(200) not null,
    nome_fantasia varchar(200),

    cnpj varchar(18),

    telefone varchar(30),
    celular varchar(30),
    email varchar(150),

    contato varchar(150),

    endereco text,
    numero varchar(20),
    bairro varchar(100),
    cidade varchar(100),
    estado varchar(2),
    cep varchar(10),

    observacao text,

    ativo boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- ============================================================
-- DEPÓSITOS / LOCAIS DE ESTOQUE
-- ============================================================

create table if not exists depositos (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    nome varchar(100) not null,
    codigo varchar(50),

    endereco text,

    ativo boolean not null default true,

    created_at timestamptz not null default now(),

    constraint depositos_codigo_unique
        unique (empresa_id, codigo)
);


-- ============================================================
-- PRODUTOS
-- ============================================================

create table if not exists produtos (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    categoria_id uuid
        references categorias(id)
        on delete set null,

    fornecedor_id uuid
        references fornecedores(id)
        on delete set null,

    deposito_id uuid
        references depositos(id)
        on delete set null,

    codigo varchar(100) not null,

    codigo_barras varchar(100),

    nome varchar(200) not null,

    descricao text,

    unidade varchar(20) not null default 'UN',

    quantidade numeric(14,3) not null default 0,

    estoque_minimo numeric(14,3) not null default 0,

    estoque_maximo numeric(14,3),

    ponto_reposicao numeric(14,3),

    preco_custo numeric(14,2) not null default 0,

    preco_venda numeric(14,2) not null default 0,

    localizacao varchar(150),

    lote varchar(100),

    validade date,

    imagem_url text,

    ativo boolean not null default true,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now(),

    constraint produtos_codigo_unique
        unique (empresa_id, codigo),

    constraint produtos_quantidade_check
        check (quantidade >= 0),

    constraint produtos_estoque_minimo_check
        check (estoque_minimo >= 0),

    constraint produtos_estoque_maximo_check
        check (
            estoque_maximo is null
            or estoque_maximo >= estoque_minimo
        ),

    constraint produtos_preco_custo_check
        check (preco_custo >= 0),

    constraint produtos_preco_venda_check
        check (preco_venda >= 0)
);


-- ============================================================
-- LOTES
-- ============================================================

create table if not exists lotes (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    produto_id uuid not null
        references produtos(id)
        on delete cascade,

    numero_lote varchar(100) not null,

    data_fabricacao date,
    data_validade date,

    quantidade numeric(14,3) not null default 0,

    custo_unitario numeric(14,2) not null default 0,

    ativo boolean not null default true,

    created_at timestamptz not null default now(),

    constraint lotes_quantidade_check
        check (quantidade >= 0)
);


-- ============================================================
-- MOVIMENTAÇÕES
-- ============================================================

create table if not exists movimentacoes (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    produto_id uuid not null
        references produtos(id)
        on delete restrict,

    usuario_id uuid
        references usuarios(id)
        on delete set null,

    deposito_id uuid
        references depositos(id)
        on delete set null,

    tipo tipo_movimentacao not null,

    quantidade numeric(14,3) not null,

    saldo_anterior numeric(14,3) not null,

    saldo_posterior numeric(14,3) not null,

    valor_unitario numeric(14,2) default 0,

    valor_total numeric(14,2)
        generated always as (
            quantidade * valor_unitario
        ) stored,

    motivo varchar(200),

    documento varchar(100),

    observacao text,

    created_at timestamptz not null default now(),

    constraint movimentacoes_quantidade_check
        check (quantidade > 0),

    constraint movimentacoes_saldo_check
        check (saldo_posterior >= 0)
);


-- ============================================================
-- FORNECEDORES / PRODUTOS
-- ============================================================

create table if not exists fornecedor_produtos (
    id uuid primary key default gen_random_uuid(),

    fornecedor_id uuid not null
        references fornecedores(id)
        on delete cascade,

    produto_id uuid not null
        references produtos(id)
        on delete cascade,

    codigo_fornecedor varchar(100),

    preco_custo numeric(14,2) default 0,

    prazo_entrega_dias integer default 0,

    principal boolean not null default false,

    created_at timestamptz not null default now(),

    constraint fornecedor_produto_unique
        unique (fornecedor_id, produto_id)
);


-- ============================================================
-- COMPRAS
-- ============================================================

create table if not exists compras (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    fornecedor_id uuid
        references fornecedores(id)
        on delete set null,

    usuario_id uuid
        references usuarios(id)
        on delete set null,

    numero_pedido varchar(100),

    numero_nota varchar(100),

    data_pedido date not null default current_date,

    data_recebimento date,

    status status_compra not null default 'PENDENTE',

    subtotal numeric(14,2) not null default 0,

    desconto numeric(14,2) not null default 0,

    frete numeric(14,2) not null default 0,

    valor_total numeric(14,2) not null default 0,

    observacao text,

    created_at timestamptz not null default now(),

    updated_at timestamptz not null default now()
);


-- ============================================================
-- ITENS DAS COMPRAS
-- ============================================================

create table if not exists itens_compra (
    id uuid primary key default gen_random_uuid(),

    compra_id uuid not null
        references compras(id)
        on delete cascade,

    produto_id uuid not null
        references produtos(id)
        on delete restrict,

    quantidade numeric(14,3) not null,

    quantidade_recebida numeric(14,3) not null default 0,

    preco_unitario numeric(14,2) not null default 0,

    desconto numeric(14,2) not null default 0,

    subtotal numeric(14,2)
        generated always as (
            (quantidade * preco_unitario) - desconto
        ) stored,

    constraint itens_compra_quantidade_check
        check (quantidade > 0),

    constraint itens_compra_recebida_check
        check (
            quantidade_recebida >= 0
            and quantidade_recebida <= quantidade
        )
);


-- ============================================================
-- TRANSFERÊNCIAS
-- ============================================================

create table if not exists transferencias (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    produto_id uuid not null
        references produtos(id)
        on delete restrict,

    deposito_origem_id uuid not null
        references depositos(id)
        on delete restrict,

    deposito_destino_id uuid not null
        references depositos(id)
        on delete restrict,

    usuario_id uuid
        references usuarios(id)
        on delete set null,

    quantidade numeric(14,3) not null,

    observacao text,

    created_at timestamptz not null default now(),

    constraint transferencias_quantidade_check
        check (quantidade > 0),

    constraint transferencias_depositos_check
        check (
            deposito_origem_id <> deposito_destino_id
        )
);


-- ============================================================
-- INVENTÁRIO
-- ============================================================

create table if not exists inventarios (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid not null
        references empresas(id)
        on delete cascade,

    deposito_id uuid
        references depositos(id)
        on delete set null,

    usuario_id uuid
        references usuarios(id)
        on delete set null,

    descricao varchar(200),

    data_inventario date not null default current_date,

    status varchar(30) not null default 'ABERTO',

    observacao text,

    created_at timestamptz not null default now()
);


-- ============================================================
-- ITENS DO INVENTÁRIO
-- ============================================================

create table if not exists itens_inventario (
    id uuid primary key default gen_random_uuid(),

    inventario_id uuid not null
        references inventarios(id)
        on delete cascade,

    produto_id uuid not null
        references produtos(id)
        on delete restrict,

    quantidade_sistema numeric(14,3) not null default 0,

    quantidade_contada numeric(14,3) not null default 0,

    diferenca numeric(14,3)
        generated always as (
            quantidade_contada - quantidade_sistema
        ) stored,

    observacao text
);


-- ============================================================
-- AUDITORIA
-- ============================================================

create table if not exists auditoria (
    id uuid primary key default gen_random_uuid(),

    empresa_id uuid
        references empresas(id)
        on delete cascade,

    usuario_id uuid
        references usuarios(id)
        on delete set null,

    tabela varchar(100) not null,

    registro_id uuid,

    operacao varchar(20) not null,

    dados_anteriores jsonb,

    dados_novos jsonb,

    created_at timestamptz not null default now()
);


-- ============================================================
-- ÍNDICES
-- ============================================================

create index if not exists idx_produtos_empresa
    on produtos(empresa_id);

create index if not exists idx_produtos_categoria
    on produtos(categoria_id);

create index if not exists idx_produtos_codigo
    on produtos(codigo);

create index if not exists idx_produtos_barras
    on produtos(codigo_barras);

create index if not exists idx_produtos_estoque
    on produtos(quantidade);

create index if not exists idx_produtos_minimo
    on produtos(estoque_minimo);

create index if not exists idx_movimentacoes_produto
    on movimentacoes(produto_id);

create index if not exists idx_movimentacoes_empresa
    on movimentacoes(empresa_id);

create index if not exists idx_movimentacoes_data
    on movimentacoes(created_at);

create index if not exists idx_movimentacoes_tipo
    on movimentacoes(tipo);

create index if not exists idx_lotes_produto
    on lotes(produto_id);

create index if not exists idx_lotes_validade
    on lotes(data_validade);

create index if not exists idx_compras_fornecedor
    on compras(fornecedor_id);

create index if not exists idx_compras_status
    on compras(status);

create index if not exists idx_itens_compra_produto
    on itens_compra(produto_id);


-- ============================================================
-- FUNÇÃO: UPDATED_AT
-- ============================================================

create or replace function atualizar_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- ============================================================
-- TRIGGERS UPDATED_AT
-- ============================================================

drop trigger if exists trigger_empresas_updated_at
on empresas;

create trigger trigger_empresas_updated_at
before update on empresas
for each row
execute function atualizar_updated_at();


drop trigger if exists trigger_usuarios_updated_at
on usuarios;

create trigger trigger_usuarios_updated_at
before update on usuarios
for each row
execute function atualizar_updated_at();


drop trigger if exists trigger_produtos_updated_at
on produtos;

create trigger trigger_produtos_updated_at
before update on produtos
for each row
execute function atualizar_updated_at();


drop trigger if exists trigger_compras_updated_at
on compras;

create trigger trigger_compras_updated_at
before update on compras
for each row
execute function atualizar_updated_at();


-- ============================================================
-- FUNÇÃO: REGISTRAR MOVIMENTAÇÃO
-- ============================================================

create or replace function registrar_movimentacao(
    p_empresa_id uuid,
    p_produto_id uuid,
    p_usuario_id uuid,
    p_deposito_id uuid,
    p_tipo tipo_movimentacao,
    p_quantidade numeric,
    p_valor_unitario numeric default 0,
    p_motivo varchar default null,
    p_documento varchar default null,
    p_observacao text default null
)
returns uuid
language plpgsql
security definer
as $$
declare

    v_produto produtos%rowtype;

    v_saldo_anterior numeric(14,3);

    v_saldo_posterior numeric(14,3);

    v_movimentacao_id uuid;

begin

    if p_quantidade <= 0 then
        raise exception 'A quantidade deve ser maior que zero.';
    end if;


    select *
    into v_produto
    from produtos
    where id = p_produto_id
    and empresa_id = p_empresa_id
    for update;


    if not found then
        raise exception 'Produto não encontrado.';
    end if;


    v_saldo_anterior := v_produto.quantidade;


    if p_tipo in (
        'ENTRADA',
        'DEVOLUCAO',
        'TRANSFERENCIA_ENTRADA'
    ) then

        v_saldo_posterior :=
            v_saldo_anterior + p_quantidade;

    elsif p_tipo in (
        'SAIDA',
        'TRANSFERENCIA_SAIDA'
    ) then

        v_saldo_posterior :=
            v_saldo_anterior - p_quantidade;

    elsif p_tipo = 'AJUSTE' then

        v_saldo_posterior :=
            p_quantidade;

    end if;


    if v_saldo_posterior < 0 then
        raise exception
            'Estoque insuficiente. Saldo atual: %, solicitado: %.',
            v_saldo_anterior,
            p_quantidade;
    end if;


    update produtos

    set quantidade = v_saldo_posterior

    where id = p_produto_id;


    insert into movimentacoes (
        empresa_id,
        produto_id,
        usuario_id,
        deposito_id,
        tipo,
        quantidade,
        saldo_anterior,
        saldo_posterior,
        valor_unitario,
        motivo,
        documento,
        observacao
    )

    values (
        p_empresa_id,
        p_produto_id,
        p_usuario_id,
        p_deposito_id,
        p_tipo,
        p_quantidade,
        v_saldo_anterior,
        v_saldo_posterior,
        coalesce(p_valor_unitario, 0),
        p_motivo,
        p_documento,
        p_observacao
    )

    returning id into v_movimentacao_id;


    return v_movimentacao_id;

end;
$$;


-- ============================================================
-- VIEW: SITUAÇÃO DO ESTOQUE
-- ============================================================

create or replace view vw_estoque
with (security_invoker = true)
as

select

    p.id,

    p.empresa_id,

    p.codigo,

    p.codigo_barras,

    p.nome,

    c.nome as categoria,

    p.unidade,

    p.quantidade,

    p.estoque_minimo,

    p.estoque_maximo,

    p.preco_custo,

    p.preco_venda,

    p.localizacao,

    p.lote,

    p.validade,

    case

        when p.quantidade <= 0
            then 'ZERADO'

        when p.quantidade <= p.estoque_minimo
            then 'CRITICO'

        when p.estoque_maximo is not null
             and p.quantidade >= p.estoque_maximo
            then 'CHEIO'

        else 'NORMAL'

    end as situacao,

    p.quantidade * p.preco_custo
        as valor_estoque

from produtos p

left join categorias c
    on c.id = p.categoria_id

where p.ativo = true;


-- ============================================================
-- VIEW: PRODUTOS ABAIXO DO ESTOQUE MÍNIMO
-- ============================================================

create or replace view vw_estoque_baixo
with (security_invoker = true)
as

select

    *

from vw_estoque

where quantidade <= estoque_minimo;


-- ============================================================
-- VIEW: PRODUTOS SEM ESTOQUE
-- ============================================================

create or replace view vw_produtos_sem_estoque
with (security_invoker = true)
as

select

    *

from vw_estoque

where quantidade <= 0;


-- ============================================================
-- VIEW: VALOR TOTAL DO ESTOQUE
-- ============================================================

create or replace view vw_valor_estoque
with (security_invoker = true)
as

select

    empresa_id,

    count(*) as total_produtos,

    coalesce(sum(quantidade), 0)
        as total_quantidade,

    coalesce(sum(quantidade * preco_custo), 0)
        as valor_total_estoque

from produtos

where ativo = true

group by empresa_id;


-- ============================================================
-- VIEW: PRODUTOS MAIS MOVIMENTADOS
-- ============================================================

create or replace view vw_produtos_movimentados
with (security_invoker = true)
as

select

    p.id,

    p.empresa_id,

    p.codigo,

    p.nome,

    count(m.id) as quantidade_movimentacoes,

    coalesce(
        sum(
            case
                when m.tipo in ('SAIDA', 'TRANSFERENCIA_SAIDA')
                then m.quantidade
                else 0
            end
        ),
        0
    ) as total_saidas,

    coalesce(
        sum(
            case
                when m.tipo in ('ENTRADA', 'DEVOLUCAO', 'TRANSFERENCIA_ENTRADA')
                then m.quantidade
                else 0
            end
        ),
        0
    ) as total_entradas

from produtos p

left join movimentacoes m
    on m.produto_id = p.id

group by

    p.id,
    p.empresa_id,
    p.codigo,
    p.nome;


-- ============================================================
-- EMPRESA INICIAL
-- ============================================================

insert into empresas (
    razao_social,
    nome_fantasia,
    cnpj
)

select

    'Olga Alumínio',
    'Olga Alumínio',
    null

where not exists (

    select 1

    from empresas

    where nome_fantasia = 'Olga Alumínio'

);


-- ============================================================
-- CATEGORIAS INICIAIS
-- ============================================================

insert into categorias (
    empresa_id,
    nome
)

select

    e.id,
    c.nome

from empresas e

cross join (
    values
        ('Perfis de Alumínio'),
        ('Chapas'),
        ('Ferragens'),
        ('Acessórios'),
        ('Ferramentas'),
        ('Materiais'),
        ('Outros')
) as c(nome)

where e.nome_fantasia = 'Olga Alumínio'

and not exists (

    select 1

    from categorias cat

    where cat.empresa_id = e.id

    and cat.nome = c.nome

);


-- ============================================================
-- DEPÓSITO INICIAL
-- ============================================================

insert into depositos (
    empresa_id,
    nome,
    codigo
)

select

    e.id,
    'Estoque Principal',
    'EST-01'

from empresas e

where e.nome_fantasia = 'Olga Alumínio'

and not exists (

    select 1

    from depositos d

    where d.empresa_id = e.id

    and d.codigo = 'EST-01'

);


-- ============================================================
-- RLS
-- ============================================================

alter table empresas enable row level security;
alter table usuarios enable row level security;
alter table categorias enable row level security;
alter table fornecedores enable row level security;
alter table depositos enable row level security;
alter table produtos enable row level security;
alter table lotes enable row level security;
alter table movimentacoes enable row level security;
alter table fornecedor_produtos enable row level security;
alter table compras enable row level security;
alter table itens_compra enable row level security;
alter table transferencias enable row level security;
alter table inventarios enable row level security;
alter table itens_inventario enable row level security;
alter table auditoria enable row level security;


-- ============================================================
-- POLÍTICAS
--
-- Para desenvolvimento inicial:
-- usuários autenticados podem trabalhar com os dados.
--
-- Em produção, recomendamos restringir por empresa_id
-- usando auth.uid() e usuarios.auth_user_id.
-- ============================================================

create policy "usuarios autenticados - empresas"
on empresas
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - usuarios"
on usuarios
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - categorias"
on categorias
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - fornecedores"
on fornecedores
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - depositos"
on depositos
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - produtos"
on produtos
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - lotes"
on lotes
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - movimentacoes"
on movimentacoes
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - fornecedor produtos"
on fornecedor_produtos
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - compras"
on compras
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - itens compras"
on itens_compra
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - transferencias"
on transferencias
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - inventarios"
on inventarios
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - itens inventario"
on itens_inventario
for all
to authenticated
using (true)
with check (true);


create policy "usuarios autenticados - auditoria"
on auditoria
for all
to authenticated
using (true)
with check (true);


-- ============================================================
-- GRANTS
-- ============================================================

revoke all on all tables in schema public
from anon;

grant select, insert, update, delete
on all tables in schema public
to authenticated;


-- ============================================================
-- FIM
-- ============================================================