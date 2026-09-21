-- Trilhas & Tesouros — Mesa Virtual: abas nas anotações da sala.
-- Rode isto no SQL Editor do projeto Supabase já existente (que já rodou
-- schema_mesa.sql antes). Quem instalar o schema do zero não precisa disso,
-- já está incluído em schema_mesa.sql.

-- A coluna "conteudo" existente vira a aba "Geral" — nenhuma anotação já
-- escrita se perde, só passa a viver na primeira aba.
alter table public.sala_anotacoes rename column conteudo to geral;
alter table public.sala_anotacoes add column if not exists equipamentos text not null default '';
alter table public.sala_anotacoes add column if not exists tesouro text not null default '';
alter table public.sala_anotacoes add column if not exists historia text not null default '';

-- Aba "GM" — tabela separada (RLS protege linha inteira, não coluna por
-- coluna) com política que só deixa o mestre da sala ler/escrever.
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
