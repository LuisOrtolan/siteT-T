-- Trilhas & Tesouros — Mesa Virtual: biblioteca pessoal de tokens (reusar
-- uma imagem já enviada sem precisar subir o arquivo de novo).
-- Rode isto no SQL Editor do projeto Supabase já existente (que já rodou
-- schema_mesa.sql antes, incluindo o bucket "tokens"). Quem instalar o
-- schema do zero não precisa disso, já está incluído em schema_mesa.sql.

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
