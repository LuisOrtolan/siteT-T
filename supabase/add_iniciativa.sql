-- Trilhas & Tesouros — Mesa Virtual: rastreador de iniciativa.
-- Rode isto no SQL Editor do projeto Supabase já existente (que já rodou
-- schema_mesa.sql antes). Quem instalar o schema do zero não precisa disso,
-- já está incluído em schema_mesa.sql.

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

alter publication supabase_realtime add table public.sala_iniciativa;
