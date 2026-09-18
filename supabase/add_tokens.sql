-- Trilhas & Tesouros — Mesa Virtual: tokens de imagem (personagens/monstros)
-- arrastáveis no quadro.
-- Rode isto no SQL Editor do projeto Supabase já existente (que já rodou
-- schema_mesa.sql antes). Quem instalar o schema do zero não precisa disso,
-- já está incluído em schema_mesa.sql.

create table if not exists public.sala_tokens (
  id text primary key,
  sala_id text not null references public.salas(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  nome text not null default '',
  imagem_url text not null,
  x double precision not null default 0.5,
  y double precision not null default 0.5,
  tamanho int not null default 56,
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

alter publication supabase_realtime add table public.sala_tokens;
