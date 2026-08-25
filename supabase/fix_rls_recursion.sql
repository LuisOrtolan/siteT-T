-- Corrige "infinite recursion detected in policy for relation
-- sala_participantes" ao criar/entrar numa sala.
--
-- Causa: a política de leitura de sala_participantes fazia uma subconsulta
-- na PRÓPRIA tabela, o que é recursivo por natureza no Postgres. Nenhuma
-- funcionalidade do app depende de ler a linha de OUTRO participante
-- diretamente (a lista de participantes na tela vem do Presence do canal
-- de tempo real, não do banco) — então a correção é restringir a leitura à
-- própria linha do usuário logado.
--
-- Rode isto no SQL Editor do seu projeto Supabase (uma vez só).

drop policy if exists "Participantes da sala se veem entre si" on public.sala_participantes;

create policy "Usuário lê apenas a própria linha de participante"
  on public.sala_participantes for select
  using (auth.uid() = user_id);
