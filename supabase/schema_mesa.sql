-- Trilhas & Tesouros — schema da Mesa Virtual (Fase 2): salas em tempo real
-- com quadro de desenho colaborativo, anotações compartilhadas, dados e
-- tokens de imagem. Rode isto no SQL Editor do seu projeto Supabase, depois
-- de já ter rodado supabase/schema.sql (Fase 1). Usa Storage (bucket
-- "tokens") pras imagens de token.

create table if not exists public.salas (
  id text primary key,                          -- código curto e compartilhável da sala
  nome text not null default 'Mesa sem nome',
  gm_id uuid not null references auth.users(id) on delete cascade,
  grade_tamanho int not null default 50,         -- px por célula da grade
  grade_ativa boolean not null default true,
  fundo text not null default 'escuro',          -- 'escuro' | 'claro' | 'cinza'
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
  tipo text not null,                            -- 'traco' | 'linha' | 'retangulo' | 'trapezio' | 'circulo' | 'triangulo' | 'pentagono' | 'hexagono'
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

create policy "Participantes movem desenhos da sala"
  on public.sala_desenhos for update
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_desenhos.sala_id and p.user_id = auth.uid())
  )
  with check (
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


-- 4 abas visíveis e editáveis por todo mundo na sala (uma coluna cada).
create table if not exists public.sala_anotacoes (
  sala_id text primary key references public.salas(id) on delete cascade,
  geral text not null default '',
  equipamentos text not null default '',
  tesouro text not null default '',
  historia text not null default '',
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


-- Aba "GM" das anotações — tabela separada (em vez de mais uma coluna em
-- sala_anotacoes) porque RLS do Postgres protege linha inteira, não coluna
-- por coluna; pra isolar de verdade o conteúdo do mestre, ele precisa estar
-- numa linha que a política já barra pra quem não é mestre.
create table if not exists public.sala_anotacoes_gm (
  sala_id text primary key references public.salas(id) on delete cascade,
  conteudo text not null default '',
  atualizado_por uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.sala_anotacoes_gm enable row level security;

create policy "Mestre lê as próprias anotações"
  on public.sala_anotacoes_gm for select
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes_gm.sala_id and p.user_id = auth.uid() and p.is_gm)
  );

create policy "Mestre cria as próprias anotações"
  on public.sala_anotacoes_gm for insert
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes_gm.sala_id and p.user_id = auth.uid() and p.is_gm)
  );

create policy "Mestre edita as próprias anotações"
  on public.sala_anotacoes_gm for update
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes_gm.sala_id and p.user_id = auth.uid() and p.is_gm)
  )
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_anotacoes_gm.sala_id and p.user_id = auth.uid() and p.is_gm)
  );


create table if not exists public.sala_iniciativa (
  sala_id text primary key references public.salas(id) on delete cascade,
  combatentes jsonb not null default '[]'::jsonb,  -- [{id, nome, valor}]
  turno_id text,                                    -- id (dentro de combatentes) de quem está na vez
  rodada int not null default 1,
  atualizado_por uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.sala_iniciativa enable row level security;

create policy "Participantes leem a iniciativa da sala"
  on public.sala_iniciativa for select
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_iniciativa.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes criam a iniciativa da sala"
  on public.sala_iniciativa for insert
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_iniciativa.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes editam a iniciativa da sala"
  on public.sala_iniciativa for update
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_iniciativa.sala_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_iniciativa.sala_id and p.user_id = auth.uid())
  );


create table if not exists public.sala_tokens (
  id text primary key,
  sala_id text not null references public.salas(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  nome text not null default '',
  imagem_url text not null,
  x double precision not null default 0.5,        -- posição fracionária (0..1) no quadro
  y double precision not null default 0.5,
  tamanho int not null default 56,                -- px de diâmetro no zoom natural (1)
  created_at timestamptz not null default now()
);

create index if not exists sala_tokens_sala_id_idx on public.sala_tokens (sala_id);

alter table public.sala_tokens enable row level security;

create policy "Participantes veem os tokens da sala"
  on public.sala_tokens for select
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_tokens.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes criam tokens na sala"
  on public.sala_tokens for insert
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_tokens.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes movem tokens da sala"
  on public.sala_tokens for update
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_tokens.sala_id and p.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_tokens.sala_id and p.user_id = auth.uid())
  );

create policy "Participantes apagam tokens da sala"
  on public.sala_tokens for delete
  using (
    exists (select 1 from public.sala_participantes p
            where p.sala_id = sala_tokens.sala_id and p.user_id = auth.uid())
  );


-- Biblioteca pessoal de tokens: não é por sala, é por usuário — pra poder
-- reusar uma imagem já enviada (ex: o token de um personagem recorrente)
-- em qualquer mesa futura, sem subir o arquivo de novo.
create table if not exists public.meus_tokens (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null default '',
  imagem_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists meus_tokens_user_id_idx on public.meus_tokens (user_id);

alter table public.meus_tokens enable row level security;

create policy "Usuário vê só os próprios tokens salvos"
  on public.meus_tokens for select
  using (auth.uid() = user_id);

create policy "Usuário salva seus próprios tokens"
  on public.meus_tokens for insert
  with check (auth.uid() = user_id);

create policy "Usuário apaga seus próprios tokens salvos"
  on public.meus_tokens for delete
  using (auth.uid() = user_id);


-- Storage: bucket público pras imagens de token. Público porque a URL da
-- imagem precisa carregar direto num <img src="...">, sem cabeçalho de
-- autenticação — mesmo modelo usado por praticamente todo app que hospeda
-- avatar/imagem de perfil.
insert into storage.buckets (id, name, public)
values ('tokens', 'tokens', true)
on conflict (id) do nothing;

create policy "Qualquer um lê imagens de token (bucket público)"
  on storage.objects for select
  using (bucket_id = 'tokens');

create policy "Usuários logados sobem imagens de token"
  on storage.objects for insert
  with check (bucket_id = 'tokens' and auth.uid() is not null);

create policy "Usuários logados apagam imagens de token"
  on storage.objects for delete
  using (bucket_id = 'tokens' and auth.uid() is not null);


-- Habilita o realtime (Postgres Changes) nessas tabelas. O app usa canais de
-- Broadcast como transporte principal, mas manter isso ligado é barato e dá
-- uma via de fallback.
alter publication supabase_realtime add table public.sala_desenhos;
alter publication supabase_realtime add table public.sala_rolagens;
alter publication supabase_realtime add table public.sala_anotacoes;
alter publication supabase_realtime add table public.sala_iniciativa;
alter publication supabase_realtime add table public.sala_tokens;
