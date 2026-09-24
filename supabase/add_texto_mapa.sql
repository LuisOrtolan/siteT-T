-- Trilhas & Tesouros — Mesa Virtual: ferramenta de texto no quadro (escrever
-- um rótulo/anotação direto no mapa, como qualquer outra forma).
--
-- Rode isto no SQL Editor do seu projeto Supabase já existente (que já
-- rodou schema_mesa.sql antes). Quem instalar o schema do zero não precisa
-- disso, já está incluído em schema_mesa.sql.

alter table public.sala_desenhos add column if not exists texto text;
