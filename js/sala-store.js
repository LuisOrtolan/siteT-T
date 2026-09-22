// js/sala-store.js
// CRUD + tempo real das salas da Mesa Virtual. Espelha o padrão de
// js/ficha-store.js: toda operação que precisa de usuário passa por
// window.TT_AUTH.getSession()/getClient().
window.TT_SALA = (function () {
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem O/0/I/1 (confusos)

  function newRoomCode() {
    let s = '';
    for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    return s;
  }

  function newDrawId() {
    return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function newTokenId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function withSession(fn) {
    if (!window.TT_AUTH) return Promise.resolve({ ok: false, reason: 'no-auth' });
    return window.TT_AUTH.getSession().then(function (session) {
      if (!session) return { ok: false, reason: 'logged-out' };
      const client = window.TT_AUTH.getClient();
      return fn(client, session);
    });
  }

  // --- Ciclo de vida da sala ---

  function createRoom(nome, nomeExibicao) {
    return withSession(function (client, session) {
      const id = newRoomCode();
      const uid = session.user.id;
      return client.from('salas').insert({ id: id, nome: nome || 'Mesa sem nome', gm_id: uid })
        .then(function (res) {
          if (res.error) { console.error('Erro ao criar sala:', res.error); return { ok: false, reason: 'error', error: res.error }; }
          // A política da sala_anotacoes exige que o participante já exista,
          // então essa inserção precisa terminar ANTES da de anotações — não
          // pode rodar em paralelo (Promise.all corre risco de ordem).
          return client.from('sala_participantes')
            .insert({ sala_id: id, user_id: uid, nome_exibicao: nomeExibicao || 'Mestre', is_gm: true })
            .then(function (pres) {
              if (pres.error) { console.error('Erro ao registrar participante:', pres.error); return { ok: false, reason: 'error', error: pres.error }; }
              return client.from('sala_anotacoes').insert({ sala_id: id })
                .then(function (nres) {
                  if (nres.error) { console.error('Erro ao criar anotações da sala:', nres.error); return { ok: false, reason: 'error', error: nres.error }; }
                  return { ok: true, sala: { id: id, nome: nome, gm_id: uid } };
                });
            });
        });
    });
  }

  function joinRoom(salaId, nomeExibicao) {
    return withSession(function (client, session) {
      const uid = session.user.id;
      return client.from('salas').select('*').eq('id', salaId).maybeSingle().then(function (res) {
        if (res.error) { console.error('Erro ao buscar sala:', res.error); return { ok: false, reason: 'error', error: res.error }; }
        if (!res.data) return { ok: false, reason: 'not-found' };
        const sala = res.data;
        return client.from('sala_participantes')
          .upsert({ sala_id: salaId, user_id: uid, nome_exibicao: nomeExibicao || 'Aventureiro' }, { onConflict: 'sala_id,user_id' })
          .select().maybeSingle()
          .then(function (pres) {
            if (pres.error) { console.error('Erro ao entrar na sala:', pres.error); return { ok: false, reason: 'error', error: pres.error }; }
            return { ok: true, sala: sala, participante: pres.data };
          });
      });
    });
  }

  function getRoom(salaId) {
    return withSession(function (client) {
      return client.from('salas').select('*').eq('id', salaId).maybeSingle().then(function (res) {
        return res.data || null;
      });
    });
  }

  // Salas em que o usuário já é participante (mestre ou jogador), pra
  // mostrar uma lista de "retomar" na tela inicial em vez de precisar do
  // código de novo toda vez.
  function listMyRooms() {
    return withSession(function (client, session) {
      return client.from('sala_participantes')
        .select('sala_id, nome_exibicao, joined_at, salas(id, nome, gm_id, created_at)')
        .eq('user_id', session.user.id)
        .order('joined_at', { ascending: false })
        .then(function (res) {
          if (res.error) { console.error('Erro ao listar minhas salas:', res.error); return []; }
          return (res.data || [])
            .filter(function (r) { return r.salas; })
            .map(function (r) {
              return { id: r.salas.id, nome: r.salas.nome, gm_id: r.salas.gm_id, meuNome: r.nome_exibicao, souGM: r.salas.gm_id === session.user.id };
            });
        });
    }).then(function (r) { return Array.isArray(r) ? r : []; });
  }

  function updateGrid(salaId, opts) {
    return withSession(function (client) {
      const patch = {};
      if (typeof opts.ativa === 'boolean') patch.grade_ativa = opts.ativa;
      if (typeof opts.tamanho === 'number') patch.grade_tamanho = opts.tamanho;
      if (typeof opts.fundo === 'string') patch.fundo = opts.fundo;
      return client.from('salas').update(patch).eq('id', salaId).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  // Só o mestre consegue (RLS de salas exige gm_id = auth.uid()). Apaga a
  // sala e, em cascata (FKs), participantes/desenhos/rolagens/anotações.
  function deleteRoom(salaId) {
    return withSession(function (client) {
      return client.from('salas').delete().eq('id', salaId).then(function (res) {
        if (res.error) { console.error('Erro ao apagar sala:', res.error); return { ok: false, reason: 'error', error: res.error }; }
        return { ok: true };
      });
    });
  }

  // --- Desenho ---

  function listDrawings(salaId) {
    return withSession(function (client) {
      return client.from('sala_desenhos').select('*').eq('sala_id', salaId).order('created_at').then(function (res) {
        return res.data || [];
      });
    }).then(function (r) { return Array.isArray(r) ? r : []; });
  }

  function addDrawing(salaId, d) {
    return withSession(function (client, session) {
      const row = {
        id: d.id || newDrawId(), sala_id: salaId, autor_id: session.user.id,
        tipo: d.tipo, pontos: d.pontos, cor: d.cor || '#c7a25a', espessura: d.espessura || 3
      };
      return client.from('sala_desenhos').insert(row).then(function (res) {
        if (res.error) return { ok: false, reason: 'error', error: res.error };
        return { ok: true, desenho: row };
      });
    });
  }

  function updateDrawing(salaId, id, pontos) {
    return withSession(function (client) {
      return client.from('sala_desenhos').update({ pontos: pontos }).eq('sala_id', salaId).eq('id', id).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  function removeDrawing(salaId, id) {
    return withSession(function (client) {
      return client.from('sala_desenhos').delete().eq('sala_id', salaId).eq('id', id).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  // Versões em lote (uma ida ao banco em vez de uma por forma), usadas pelo
  // gesto da borracha: um arrasto pode cortar dezenas de formas e gerar
  // dezenas de pedaços, e mandar cada um separado entope tanto o banco
  // quanto o canal de tempo real.
  function removeDrawings(salaId, ids) {
    if (!ids || !ids.length) return Promise.resolve({ ok: true });
    return withSession(function (client) {
      return client.from('sala_desenhos').delete().eq('sala_id', salaId).in('id', ids).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  function addDrawings(salaId, lista) {
    if (!lista || !lista.length) return Promise.resolve({ ok: true, desenhos: [] });
    return withSession(function (client, session) {
      const rows = lista.map(function (d) {
        return {
          id: d.id || newDrawId(), sala_id: salaId, autor_id: session.user.id,
          tipo: d.tipo, pontos: d.pontos, cor: d.cor || '#c7a25a', espessura: d.espessura || 3
        };
      });
      return client.from('sala_desenhos').insert(rows).then(function (res) {
        if (res.error) return { ok: false, reason: 'error', error: res.error };
        return { ok: true, desenhos: rows };
      });
    });
  }

  function clearDrawings(salaId) {
    return withSession(function (client) {
      return client.from('sala_desenhos').delete().eq('sala_id', salaId).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  // --- Anotações ---
  // 4 abas visíveis por todo mundo, uma coluna cada em sala_anotacoes. A
  // aba do mestre (GM) mora numa tabela separada (sala_anotacoes_gm) com
  // política de RLS que só deixa o próprio mestre ler/escrever — ver
  // getNotesGM/saveNotesGM logo abaixo.

  function getNotes(salaId) {
    return withSession(function (client) {
      return client.from('sala_anotacoes').select('*').eq('sala_id', salaId).maybeSingle().then(function (res) {
        const row = res.data || {};
        return { geral: row.geral || '', equipamentos: row.equipamentos || '', tesouro: row.tesouro || '', historia: row.historia || '' };
      });
    }).then(function (r) { return r || { geral: '', equipamentos: '', tesouro: '', historia: '' }; });
  }

  function saveNotes(salaId, aba, conteudo) {
    return withSession(function (client, session) {
      const row = { sala_id: salaId, atualizado_por: session.user.id, updated_at: new Date().toISOString() };
      row[aba] = conteudo;
      return client.from('sala_anotacoes').upsert(row, { onConflict: 'sala_id' })
        .then(function (res) { return { ok: !res.error }; });
    });
  }

  // Só retorna algo (e só deixa salvar) pra quem é mestre da sala — RLS de
  // sala_anotacoes_gm filtra por sala_participantes.is_gm. Pra quem não é
  // mestre, a select simplesmente não devolve linha nenhuma (não é erro).
  function getNotesGM(salaId) {
    return withSession(function (client) {
      return client.from('sala_anotacoes_gm').select('*').eq('sala_id', salaId).maybeSingle().then(function (res) {
        return (res.data && res.data.conteudo) || '';
      });
    }).then(function (r) { return r || ''; });
  }

  function saveNotesGM(salaId, conteudo) {
    return withSession(function (client, session) {
      return client.from('sala_anotacoes_gm')
        .upsert({ sala_id: salaId, conteudo: conteudo, atualizado_por: session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'sala_id' })
        .then(function (res) { return { ok: !res.error }; });
    });
  }

  // --- Tokens (imagem de personagem/monstro) ---

  function uploadTokenImage(salaId, file) {
    return withSession(function (client) {
      const ext = ((file.name || '').split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = salaId + '/' + newTokenId() + '.' + ext;
      return client.storage.from('tokens').upload(path, file).then(function (res) {
        if (res.error) { console.error('Erro ao enviar imagem do token:', res.error); return { ok: false, reason: 'error', error: res.error }; }
        const pub = client.storage.from('tokens').getPublicUrl(path);
        return { ok: true, url: pub.data.publicUrl };
      });
    });
  }

  function listTokens(salaId) {
    return withSession(function (client) {
      return client.from('sala_tokens').select('*').eq('sala_id', salaId).order('created_at').then(function (res) {
        return res.data || [];
      });
    }).then(function (r) { return Array.isArray(r) ? r : []; });
  }

  function addToken(salaId, t) {
    return withSession(function (client, session) {
      const row = {
        id: t.id || newTokenId(), sala_id: salaId, autor_id: session.user.id,
        nome: t.nome || '', imagem_url: t.imagem_url, x: t.x, y: t.y, tamanho: t.tamanho || 56
      };
      return client.from('sala_tokens').insert(row).then(function (res) {
        if (res.error) return { ok: false, reason: 'error', error: res.error };
        return { ok: true, token: row };
      });
    });
  }

  function updateToken(salaId, id, patch) {
    return withSession(function (client) {
      return client.from('sala_tokens').update(patch).eq('sala_id', salaId).eq('id', id).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  function removeToken(salaId, id) {
    return withSession(function (client) {
      return client.from('sala_tokens').delete().eq('sala_id', salaId).eq('id', id).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  // --- Biblioteca pessoal de tokens (não é por sala — por usuário) ---

  function listMyTokens() {
    return withSession(function (client, session) {
      return client.from('meus_tokens').select('*').eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(function (res) { return res.data || []; });
    }).then(function (r) { return Array.isArray(r) ? r : []; });
  }

  function saveMyToken(nome, imagemUrl) {
    return withSession(function (client, session) {
      const row = { id: newTokenId(), user_id: session.user.id, nome: nome || '', imagem_url: imagemUrl };
      return client.from('meus_tokens').insert(row).then(function (res) {
        if (res.error) return { ok: false, reason: 'error', error: res.error };
        return { ok: true, token: row };
      });
    });
  }

  function deleteMyToken(id) {
    return withSession(function (client) {
      return client.from('meus_tokens').delete().eq('id', id).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  // --- Iniciativa ---

  function getInitiative(salaId) {
    return withSession(function (client) {
      return client.from('sala_iniciativa').select('*').eq('sala_id', salaId).maybeSingle().then(function (res) {
        const row = res.data;
        return { combatentes: (row && row.combatentes) || [], turnoId: row ? row.turno_id : null, rodada: (row && row.rodada) || 1 };
      });
    }).then(function (r) { return r || { combatentes: [], turnoId: null, rodada: 1 }; });
  }

  function saveInitiative(salaId, estado) {
    return withSession(function (client, session) {
      return client.from('sala_iniciativa')
        .upsert({
          sala_id: salaId, combatentes: estado.combatentes, turno_id: estado.turnoId, rodada: estado.rodada,
          atualizado_por: session.user.id, updated_at: new Date().toISOString()
        }, { onConflict: 'sala_id' })
        .then(function (res) { return { ok: !res.error }; });
    });
  }

  // --- Rolagens ---

  function logRoll(salaId, nomeExibicao, resultado) {
    return withSession(function (client, session) {
      const row = {
        sala_id: salaId, user_id: session.user.id, nome_exibicao: nomeExibicao,
        formula: resultado.formula, resultado: resultado, total: resultado.total
      };
      return client.from('sala_rolagens').insert(row).select().maybeSingle().then(function (res) {
        if (res.error) return { ok: false, reason: 'error', error: res.error };
        return { ok: true, rolagem: res.data };
      });
    });
  }

  function listRecentRolls(salaId, limit) {
    return withSession(function (client) {
      return client.from('sala_rolagens').select('*').eq('sala_id', salaId)
        .order('created_at', { ascending: false }).limit(limit || 30)
        .then(function (res) { return (res.data || []).reverse(); });
    }).then(function (r) { return Array.isArray(r) ? r : []; });
  }

  // --- Tempo real: canal de Broadcast + Presence por sala ---

  function connect(salaId, nomeExibicao, handlers) {
    const client = window.TT_AUTH && window.TT_AUTH.getClient();
    if (!client) return null;
    handlers = handlers || {};
    const channel = client.channel('sala:' + salaId, { config: { broadcast: { self: false } } });
    let jaConectouUmaVez = false;

    channel.on('broadcast', { event: 'draw-add' }, function (msg) { if (handlers.onDrawAdd) handlers.onDrawAdd(msg.payload); });
    channel.on('broadcast', { event: 'draw-remove' }, function (msg) { if (handlers.onDrawRemove) handlers.onDrawRemove(msg.payload); });
    channel.on('broadcast', { event: 'draw-update' }, function (msg) { if (handlers.onDrawUpdate) handlers.onDrawUpdate(msg.payload); });
    channel.on('broadcast', { event: 'draw-clear' }, function () { if (handlers.onDrawClear) handlers.onDrawClear(); });
    channel.on('broadcast', { event: 'draw-erase' }, function (msg) { if (handlers.onDrawErase) handlers.onDrawErase(msg.payload); });
    channel.on('broadcast', { event: 'roll' }, function (msg) { if (handlers.onRoll) handlers.onRoll(msg.payload); });
    channel.on('broadcast', { event: 'notes-update' }, function (msg) { if (handlers.onNotesUpdate) handlers.onNotesUpdate(msg.payload); });
    channel.on('broadcast', { event: 'initiative-update' }, function (msg) { if (handlers.onInitiativeUpdate) handlers.onInitiativeUpdate(msg.payload); });
    channel.on('broadcast', { event: 'token-add' }, function (msg) { if (handlers.onTokenAdd) handlers.onTokenAdd(msg.payload); });
    channel.on('broadcast', { event: 'token-update' }, function (msg) { if (handlers.onTokenUpdate) handlers.onTokenUpdate(msg.payload); });
    channel.on('broadcast', { event: 'token-remove' }, function (msg) { if (handlers.onTokenRemove) handlers.onTokenRemove(msg.payload); });
    channel.on('presence', { event: 'sync' }, function () {
      if (handlers.onPresenceSync) handlers.onPresenceSync(channel.presenceState());
    });

    channel.subscribe(function (status) {
      if (status === 'SUBSCRIBED') {
        window.TT_AUTH.getSession().then(function (session) {
          channel.track({ user_id: session && session.user && session.user.id, nome_exibicao: nomeExibicao });
        });
        // Broadcast é efêmero — qualquer evento enviado enquanto este
        // cliente estava com o socket caído (wifi oscilando, celular
        // travando a aba em segundo plano, notebook suspenso etc.) se
        // perde pra sempre, e nunca chega aqui. O cliente do Supabase
        // detecta a queda e reconecta/reinscreve o canal sozinho quando
        // a rede volta, disparando 'SUBSCRIBED' de novo — não é só a
        // entrada inicial. Por isso avisa quem chamou toda vez que o
        // canal fica pronto (não só na primeira), pra rebuscar o estado
        // do banco e fechar qualquer buraco de eventos perdidos.
        if (handlers.onReady) handlers.onReady(jaConectouUmaVez);
        jaConectouUmaVez = true;
      }
    });

    return channel;
  }

  function broadcastDrawAdd(channel, desenho) { if (channel) channel.send({ type: 'broadcast', event: 'draw-add', payload: desenho }); }
  function broadcastDrawRemove(channel, id) { if (channel) channel.send({ type: 'broadcast', event: 'draw-remove', payload: id }); }
  function broadcastDrawUpdate(channel, payload) { if (channel) channel.send({ type: 'broadcast', event: 'draw-update', payload: payload }); }
  function broadcastDrawClear(channel) { if (channel) channel.send({ type: 'broadcast', event: 'draw-clear', payload: {} }); }
  function broadcastDrawErase(channel, payload) { if (channel) channel.send({ type: 'broadcast', event: 'draw-erase', payload: payload }); }
  function broadcastRoll(channel, rolagem) { if (channel) channel.send({ type: 'broadcast', event: 'roll', payload: rolagem }); }
  function broadcastNotes(channel, aba, conteudo) { if (channel) channel.send({ type: 'broadcast', event: 'notes-update', payload: { aba: aba, conteudo: conteudo } }); }
  function broadcastInitiative(channel, estado) { if (channel) channel.send({ type: 'broadcast', event: 'initiative-update', payload: estado }); }
  function broadcastTokenAdd(channel, token) { if (channel) channel.send({ type: 'broadcast', event: 'token-add', payload: token }); }
  function broadcastTokenUpdate(channel, payload) { if (channel) channel.send({ type: 'broadcast', event: 'token-update', payload: payload }); }
  function broadcastTokenRemove(channel, id) { if (channel) channel.send({ type: 'broadcast', event: 'token-remove', payload: id }); }

  function leave(channel) {
    if (channel) channel.unsubscribe();
  }

  return {
    newRoomCode, newDrawId, newTokenId, createRoom, joinRoom, getRoom, listMyRooms, updateGrid, deleteRoom,
    listDrawings, addDrawing, addDrawings, updateDrawing, removeDrawing, removeDrawings, clearDrawings,
    getNotes, saveNotes, getNotesGM, saveNotesGM,
    getInitiative, saveInitiative,
    uploadTokenImage, listTokens, addToken, updateToken, removeToken,
    listMyTokens, saveMyToken, deleteMyToken,
    logRoll, listRecentRolls,
    connect, leave,
    broadcastDrawAdd, broadcastDrawUpdate, broadcastDrawRemove, broadcastDrawClear, broadcastDrawErase, broadcastRoll, broadcastNotes, broadcastInitiative,
    broadcastTokenAdd, broadcastTokenUpdate, broadcastTokenRemove
  };
})();
