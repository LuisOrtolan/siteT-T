-- Trilhas & Tesouros — Mesa Virtual: ferramenta de selecionar/mover
-- desenhos já feitos no quadro.
-- Rode isto no SQL Editor do projeto Supabase já existente (que já rodou
-- schema_mesa.sql antes). Quem instalar o schema do zero não precisa
-- disso, já está incluído em schema_mesa.sql.

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
