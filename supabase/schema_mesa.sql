-- Trilhas & Tesouros — schema da Mesa Virtual (Fase 2): salas em tempo real
-- com quadro de desenho colaborativo, anotações compartilhadas e dados.
-- Rode isto no SQL Editor do seu projeto Supabase, depois de já ter rodado
-- supabase/schema.sql (Fase 1). Não depende de Storage — não há upload de
-- imagem no v1, o quadro é só grade + desenho.

create table if not exists public.salas (
  id text primary key,                          -- código curto e compartilhável da sala
  nome text not null default 'Mesa sem nome',
  gm_id uuid not null references auth.users(id) on delete cascade,
  grade_tamanho int not null default 50,         -- px por célula da grade
  grade_ativa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.salas enable row level security;

create policy "Qualquer usuário autenticado lê salas por código"
  on public.salas for select
  using (auth.uid() is not null);

create policy "Apenas o mestre cria a sala"
  on public.salas for insert
  with check (auth.uid() = gm_id);

create policy "Apenas o mestre atualiza a sala"
  on public.salas for update
  using (auth.uid() = gm_id)
  with check (auth.uid() = gm_id);

create policy "Apenas o mestre apaga a sala"
  on public.salas for delete
  using (auth.uid() = gm_id);


create table if not exists public.sala_participantes (
  sala_id text not null references public.salas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome_exibicao text not null,
  is_gm boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (sala_id, user_id)
);

create index if not exists sala_participantes_sala_id_idx on public.sala_participantes (sala_id);

alter table public.sala_participantes enable row level security;

-- Restrita à própria linha (não a todas as da sala): uma política de select
-- que subconsulta a MESMA tabela é recursiva no Postgres e quebra com
-- "infinite recursion detected in policy". A lista de participantes na tela
-- vem do Presence do canal de tempo real, não de uma leitura desta tabela,
-- então isso não limita nenhuma funcionalidade atual.
create policy "Usuário lê apenas a própria linha de participante"
  on public.sala_participantes for select
  using (auth.uid() = user_id);

create policy "Usuário entra na sala por conta própria"
  on public.sala_participantes for insert
  with check (auth.uid() = user_id);

create policy "Usuário edita seu próprio nome na sala"
  on public.sala_participantes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuário sai da sala por conta própria"
  on public.sala_participantes for delete
  using (auth.uid() = user_id);


create table if not exists public.sala_desenhos (
  id text primary key,
  sala_id text not null references public.salas(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  tipo text not null,                            -- 'traco' | 'linha' | 'retangulo' | 'circulo'
  pontos jsonb not null,                          -- array de {x,y} fracionários (0..1)
  cor text not null default '#c7a25a',
  espessura int not null default 3,
  created_at timestamptz not null default now()
);

create index if not exists sala_desenhos_sala_id_idx on public.sala_desenhos (sala_id);

alter table public.sala_desenhos enable row level security;

create policy "Participantes veem os desenhos da sala"
  on public.sala_desenhos for select
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_desenhos.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes desenham na sala"
  on public.sala_desenhos for insert
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_desenhos.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes apagam desenhos da sala"
  on public.sala_desenhos for delete
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_desenhos.sala_id and p.user_id = auth.uid())
  );


create table if not exists public.sala_rolagens (
  id bigint generated always as identity primary key,
  sala_id text not null references public.salas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome_exibicao text not null,                   -- copiado no momento da rolada
  formula text not null,
  resultado jsonb not null,                      -- {dice, mod, total}
  total int not null,
  created_at timestamptz not null default now()
);

create index if not exists sala_rolagens_sala_id_idx on public.sala_rolagens (sala_id, created_at desc);

alter table public.sala_rolagens enable row level security;

create policy "Participantes leem rolagens da sala"
  on public.sala_rolagens for select
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_rolagens.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes registram suas rolagens"
  on public.sala_rolagens for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.sala_participantes p
                where p.sala_id = sala_rolagens.sala_id and p.user_id = auth.uid())
  );


create table if not exists public.sala_anotacoes (
  sala_id text primary key references public.salas(id) on delete cascade,
  conteudo text not null default '',
  atualizado_por uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.sala_anotacoes enable row level security;

create policy "Participantes leem as anotações da sala"
  on public.sala_anotacoes for select
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes criam as anotações da sala"
  on public.sala_anotacoes for insert
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes editam as anotações da sala"
  on public.sala_anotacoes for update
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes.sala_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes.sala_id and p.user_id = auth.uid())
  );


-- Habilita o realtime (Postgres Changes) nessas tabelas. O app usa canais de
-- Broadcast como transporte principal, mas manter isso ligado é barato e dá
-- uma via de fallback.
alter publication supabase_realtime add table public.sala_desenhos;
alter publication supabase_realtime add table public.sala_rolagens;
alter publication supabase_realtime add table public.sala_anotacoes;
