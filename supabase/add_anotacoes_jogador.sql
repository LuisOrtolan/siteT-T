-- Trilhas & Tesouros — Mesa Virtual: nota individual e privada pra cada
-- participante (mestre ou jogador), além das abas já existentes
-- (Geral/Equipamentos/Tesouro/História, visíveis a todos, e a aba do
-- mestre, só dele). Cada pessoa só lê/escreve a própria nota — nem o
-- mestre vê a nota individual de um jogador.
--
-- Rode isto no SQL Editor do seu projeto Supabase já existente (que já
-- rodou schema_mesa.sql antes). Quem instalar o schema do zero não precisa
-- disso, já está incluído em schema_mesa.sql.

create table if not exists public.sala_anotacoes_jogador (
  sala_id text not null references public.salas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conteudo text not null default '',
  updated_at timestamptz not null default now(),
  primary key (sala_id, user_id)
);

alter table public.sala_anotacoes_jogador enable row level security;

create policy "Participante lê só a própria nota individual"
  on public.sala_anotacoes_jogador for select
  using (auth.uid() = user_id);

create policy "Participante cria só a própria nota individual"
  on public.sala_anotacoes_jogador for insert
  with check (auth.uid() = user_id);

create policy "Participante edita só a própria nota individual"
  on public.sala_anotacoes_jogador for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
