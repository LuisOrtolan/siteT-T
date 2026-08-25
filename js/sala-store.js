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
              return client.from('sala_anotacoes').insert({ sala_id: id, conteudo: '' })
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

  function updateGrid(salaId, opts) {
    return withSession(function (client) {
      const patch = {};
      if (typeof opts.ativa === 'boolean') patch.grade_ativa = opts.ativa;
      if (typeof opts.tamanho === 'number') patch.grade_tamanho = opts.tamanho;
      return client.from('salas').update(patch).eq('id', salaId).then(function (res) {
        return { ok: !res.error };
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
        id: newDrawId(), sala_id: salaId, autor_id: session.user.id,
        tipo: d.tipo, pontos: d.pontos, cor: d.cor || '#c7a25a', espessura: d.espessura || 3
      };
      return client.from('sala_desenhos').insert(row).then(function (res) {
        if (res.error) return { ok: false, reason: 'error', error: res.error };
        return { ok: true, desenho: row };
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

  function clearDrawings(salaId) {
    return withSession(function (client) {
      return client.from('sala_desenhos').delete().eq('sala_id', salaId).then(function (res) {
        return { ok: !res.error };
      });
    });
  }

  // --- Anotações ---

  function getNotes(salaId) {
    return withSession(function (client) {
      return client.from('sala_anotacoes').select('*').eq('sala_id', salaId).maybeSingle().then(function (res) {
        return (res.data && res.data.conteudo) || '';
      });
    });
  }

  function saveNotes(salaId, conteudo) {
    return withSession(function (client, session) {
      return client.from('sala_anotacoes')
        .upsert({ sala_id: salaId, conteudo: conteudo, atualizado_por: session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'sala_id' })
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

    channel.on('broadcast', { event: 'draw-add' }, function (msg) { if (handlers.onDrawAdd) handlers.onDrawAdd(msg.payload); });
    channel.on('broadcast', { event: 'draw-remove' }, function (msg) { if (handlers.onDrawRemove) handlers.onDrawRemove(msg.payload); });
    channel.on('broadcast', { event: 'draw-clear' }, function () { if (handlers.onDrawClear) handlers.onDrawClear(); });
    channel.on('broadcast', { event: 'roll' }, function (msg) { if (handlers.onRoll) handlers.onRoll(msg.payload); });
    channel.on('broadcast', { event: 'notes-update' }, function (msg) { if (handlers.onNotesUpdate) handlers.onNotesUpdate(msg.payload); });
    channel.on('presence', { event: 'sync' }, function () {
      if (handlers.onPresenceSync) handlers.onPresenceSync(channel.presenceState());
    });

    channel.subscribe(function (status) {
      if (status === 'SUBSCRIBED') {
        window.TT_AUTH.getSession().then(function (session) {
          channel.track({ user_id: session && session.user && session.user.id, nome_exibicao: nomeExibicao });
        });
      }
    });

    return channel;
  }

  function broadcastDrawAdd(channel, desenho) { if (channel) channel.send({ type: 'broadcast', event: 'draw-add', payload: desenho }); }
  function broadcastDrawRemove(channel, id) { if (channel) channel.send({ type: 'broadcast', event: 'draw-remove', payload: id }); }
  function broadcastDrawClear(channel) { if (channel) channel.send({ type: 'broadcast', event: 'draw-clear', payload: {} }); }
  function broadcastRoll(channel, rolagem) { if (channel) channel.send({ type: 'broadcast', event: 'roll', payload: rolagem }); }
  function broadcastNotes(channel, conteudo) { if (channel) channel.send({ type: 'broadcast', event: 'notes-update', payload: conteudo }); }

  function leave(channel) {
    if (channel) channel.unsubscribe();
  }

  return {
    newRoomCode, createRoom, joinRoom, getRoom, updateGrid,
    listDrawings, addDrawing, removeDrawing, clearDrawings,
    getNotes, saveNotes,
    logRoll, listRecentRolls,
    connect, leave,
    broadcastDrawAdd, broadcastDrawRemove, broadcastDrawClear, broadcastRoll, broadcastNotes
  };
})();
