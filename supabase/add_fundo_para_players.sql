-- Trilhas & Tesouros — Mesa Virtual: libera a troca da cor de fundo do
-- quadro (escuro/claro/cinza) pra qualquer participante da sala, não só
-- pro mestre.
--
-- A política de UPDATE em public.salas era "só o mestre" pra linha
-- inteira. Trocar isso por "qualquer participante pode dar UPDATE" sem
-- mais nada abriria brecha pra um jogador mudar nome/gm_id/grade da sala
-- também — então a política passa a liberar a LINHA pra participantes, e
-- um trigger BEFORE UPDATE barra a tentativa se qualquer coluna além de
-- `fundo` mudar (mestre continua sem essa restrição).
--
-- Rode isto no SQL Editor do seu projeto Supabase já existente (que já
-- rodou schema_mesa.sql antes). Quem instalar o schema do zero não precisa
-- disso, já está incluído em schema_mesa.sql.

create or replace function public.restringir_update_sala_nao_mestre()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() = old.gm_id then
    return new; -- mestre pode mudar qualquer coisa da sala
  end if;
  -- Compara linha inteira menos "fundo" — pega qualquer coluna, inclusive
  -- as que forem adicionadas depois, sem precisar listar campo por campo.
  if (to_jsonb(new) - 'fundo') is distinct from (to_jsonb(old) - 'fundo') then
    raise exception 'Só o mestre pode alterar esse campo da sala.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_restringir_update_sala_nao_mestre on public.salas;

create trigger trg_restringir_update_sala_nao_mestre
  before update on public.salas
  for each row
  execute function public.restringir_update_sala_nao_mestre();

drop policy if exists "Apenas o mestre atualiza a sala" on public.salas;

create policy "Mestre ou participantes atualizam a sala (colunas restritas por trigger)"
  on public.salas for update
  using (
    auth.uid() = gm_id
    or exists (
      select 1 from public.sala_participantes sp
      where sp.sala_id = salas.id and sp.user_id = auth.uid()
    )
  )
  with check (true);
