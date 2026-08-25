-- Trilhas & Tesouros — schema do Supabase para login e fichas de personagem.
-- Rode isto no SQL Editor do seu projeto Supabase (Project → SQL Editor → New query).

create table if not exists public.personagens (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  ficha jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists personagens_user_id_idx on public.personagens (user_id);

alter table public.personagens enable row level security;

create policy "Usuários leem apenas suas fichas"
  on public.personagens for select
  using (auth.uid() = user_id);

create policy "Usuários inserem apenas suas fichas"
  on public.personagens for insert
  with check (auth.uid() = user_id);

create policy "Usuários atualizam apenas suas fichas"
  on public.personagens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Usuários apagam apenas suas fichas"
  on public.personagens for delete
  using (auth.uid() = user_id);
