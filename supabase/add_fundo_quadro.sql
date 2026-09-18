-- Trilhas & Tesouros — Mesa Virtual: opção de fundo do quadro (escuro,
-- claro ou cinza), em vez de sempre escuro.
-- Rode isto no SQL Editor do projeto Supabase já existente (que já rodou
-- schema_mesa.sql antes). Quem instalar o schema do zero não precisa
-- disso, já está incluído em schema_mesa.sql.

alter table public.salas add column if not exists fundo text not null default 'escuro';
