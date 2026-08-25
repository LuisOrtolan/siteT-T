// js/auth.js
// Login por email+senha via Supabase Auth (magic link foi trocado por senha
// pra não bater no limite de emails do Supabase). Três formas de usar isso
// numa página:
//   - mountWidget: form compacto de login/cadastro pro cabeçalho do site
//     (funciona mesmo sem exigir login pra usar a página).
//   - mountAuthGate: portão em tela cheia — a página só aparece depois de
//     logar (usado pelas Ferramentas: Ficha e Mesa Virtual).
//   - mountUserBadge: só "email · Sair", pras páginas que já têm o portão
//     acima e não precisam de mais um formulário de login.
window.TT_AUTH = (function () {
  var client = null;

  function getClient() {
    if (client) return client;
    if (!window.supabase || !window.TT_SUPABASE_URL || window.TT_SUPABASE_URL.indexOf('COLE_AQUI') === 0) {
      return null;
    }
    client = window.supabase.createClient(window.TT_SUPABASE_URL, window.TT_SUPABASE_ANON_KEY);
    return client;
  }

  function getSession() {
    var c = getClient();
    if (!c) return Promise.resolve(null);
    return c.auth.getSession().then(function (r) { return r.data.session; });
  }

  function signUpWithPassword(email, password) {
    var c = getClient();
    if (!c) return Promise.reject(new Error('Supabase não configurado.'));
    return c.auth.signUp({ email: email, password: password });
  }

  function signInWithPassword(email, password) {
    var c = getClient();
    if (!c) return Promise.reject(new Error('Supabase não configurado.'));
    return c.auth.signInWithPassword({ email: email, password: password });
  }

  function signOut() {
    var c = getClient();
    if (!c) return Promise.resolve();
    return c.auth.signOut();
  }

  function onChange(cb) {
    var c = getClient();
    if (!c) return;
    c.auth.onAuthStateChange(function (_event, session) { cb(session); });
  }

  function loginSignupFields(idPrefix, mode) {
    return '<input type="email" id="' + idPrefix + '-email" placeholder="seu@email.com" required />' +
      '<input type="password" id="' + idPrefix + '-senha" placeholder="senha" required minlength="6" />';
  }

  function submitLoginSignup(idPrefix, mode) {
    var email = document.getElementById(idPrefix + '-email').value.trim();
    var senha = document.getElementById(idPrefix + '-senha').value;
    if (!email || !senha) return Promise.resolve({ error: { message: 'Preencha email e senha.' } });
    var action = mode === 'login' ? signInWithPassword(email, senha) : signUpWithPassword(email, senha);
    return action;
  }

  // ---- Widget compacto (cabeçalho do site) ----
  function mountWidget(containerSelector) {
    var el = document.querySelector(containerSelector);
    if (!el) return;
    var c = getClient();
    if (!c) { el.innerHTML = ''; return; }
    var mode = 'login';

    function renderLoggedOut() {
      el.innerHTML =
        '<form class="tt-auth-form" id="tt-auth-form">' +
        loginSignupFields('tt-auth', mode) +
        '<button type="submit" class="btn btn-secondary tt-auth-btn">' + (mode === 'login' ? 'Entrar' : 'Criar') + '</button>' +
        '</form>' +
        '<p class="tt-auth-msg" id="tt-auth-msg">' +
        (mode === 'login' ? 'Sem conta? <a href="#" id="tt-auth-switch">Criar conta</a>' : 'Já tem conta? <a href="#" id="tt-auth-switch">Entrar</a>') +
        '</p>';

      el.querySelector('#tt-auth-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var msg = el.querySelector('#tt-auth-msg');
        msg.textContent = mode === 'login' ? 'Entrando...' : 'Criando conta...';
        submitLoginSignup('tt-auth', mode).then(function (res) {
          if (res.error) { msg.textContent = res.error.message; return; }
          if (mode === 'signup' && res.data && !res.data.session) {
            msg.textContent = 'Conta criada! Confira seu email pra confirmar antes de entrar.';
          }
        });
      });
      var switchLink = el.querySelector('#tt-auth-switch');
      if (switchLink) switchLink.addEventListener('click', function (ev) { ev.preventDefault(); mode = mode === 'login' ? 'signup' : 'login'; renderLoggedOut(); });
    }

    function renderLoggedIn(session) {
      var email = (session.user && session.user.email) || '';
      el.innerHTML =
        '<span class="tt-auth-email">' + email + '</span>' +
        '<button class="btn btn-secondary tt-auth-btn" id="tt-auth-logout">Sair</button>';
      el.querySelector('#tt-auth-logout').addEventListener('click', function () { signOut(); });
    }

    getSession().then(function (session) { if (session) renderLoggedIn(session); else renderLoggedOut(); });
    onChange(function (session) { if (session) renderLoggedIn(session); else renderLoggedOut(); });
  }

  // ---- Badge só de status (email · Sair) ----
  // Pra páginas que já usam mountAuthGate — não precisa de outro formulário
  // de login, só de um jeito de ver quem está logado e sair.
  function mountUserBadge(containerSelector) {
    var el = document.querySelector(containerSelector);
    if (!el) return;
    function render(session) {
      if (!session) { el.innerHTML = ''; return; }
      var email = (session.user && session.user.email) || '';
      el.innerHTML = '<span class="tt-auth-email">' + email + '</span><button class="btn btn-secondary tt-auth-btn" id="tt-badge-logout">Sair</button>';
      var btn = el.querySelector('#tt-badge-logout');
      if (btn) btn.addEventListener('click', function () { signOut(); });
    }
    getSession().then(render);
    onChange(render);
  }

  // ---- Portão em tela cheia (Ferramentas) ----
  // Cobre a página inteira com login/cadastro até existir sessão; só então
  // chama onAuth(session), uma vez por login.
  function mountAuthGate(containerSelector, onAuth) {
    var el = document.querySelector(containerSelector);
    if (!el) return;
    var c = getClient();
    if (!c) {
      el.style.cssText = 'position:fixed;inset:0;z-index:150;background:#0f1014;display:flex;align-items:center;justify-content:center;padding:16px';
      el.innerHTML = '<p style="color:#d06060;font-family:Georgia,serif">Login não configurado neste site.</p>';
      return;
    }
    var mode = 'login';

    // Reconstrói o portão inteiro (usado só no primeiro render e ao trocar
    // entre "entrar"/"criar conta" — nunca durante o envio, porque isso
    // limparia os campos antes de submit() conseguir ler o que a pessoa
    // digitou).
    function render() {
      el.style.cssText = 'position:fixed;inset:0;z-index:150;background:#0f1014;display:flex;align-items:center;justify-content:center;padding:16px';
      el.innerHTML =
        '<div style="max-width:340px;width:100%;background:#181a20;border:1px solid #2a2d35;border-radius:12px;padding:22px;font-family:Georgia,serif;color:#f5f5f7;box-sizing:border-box">' +
        '<h2 style="color:#c7a25a;font-size:16px;font-weight:normal;text-align:center;margin:0 0 14px;letter-spacing:.05em">' + (mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA') + '</h2>' +
        '<div id="tt-gate-fields" style="display:flex;flex-direction:column;gap:8px"></div>' +
        '<button id="tt-gate-submit" style="width:100%;background:#c7a25a15;border:1px solid #c7a25a40;color:#c7a25a;border-radius:6px;padding:9px;font-size:13px;cursor:pointer;font-family:inherit;margin-top:10px">' + (mode === 'login' ? 'Entrar' : 'Criar conta') + '</button>' +
        '<p id="tt-gate-msg" style="font-size:11px;color:#d06060;text-align:center;min-height:14px;margin:8px 0 0"></p>' +
        '<p style="font-size:11px;color:#6b7080;text-align:center;margin:4px 0 0">' +
        (mode === 'login' ? 'Não tem conta? <a href="#" id="tt-gate-switch" style="color:#c7a25a">Criar uma</a>' : 'Já tem conta? <a href="#" id="tt-gate-switch" style="color:#c7a25a">Entrar</a>') +
        '</p></div>';

      var fields = el.querySelector('#tt-gate-fields');
      fields.innerHTML = loginSignupFields('tt-gate', mode);
      fields.querySelectorAll('input').forEach(function (inp) {
        inp.style.cssText = 'width:100%;background:#0f1014;border:1px solid #2a2d35;border-radius:6px;padding:9px 10px;color:#f5f5f7;font-size:13px;box-sizing:border-box;font-family:inherit';
        inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
      });
      el.querySelector('#tt-gate-switch').addEventListener('click', function (ev) { ev.preventDefault(); mode = mode === 'login' ? 'signup' : 'login'; render(); });
      el.querySelector('#tt-gate-submit').addEventListener('click', submit);
    }

    function setMsg(text, color) {
      var msg = el.querySelector('#tt-gate-msg');
      if (msg) { msg.textContent = text || ''; msg.style.color = color || '#d06060'; }
    }

    function submit() {
      setMsg(mode === 'login' ? 'Entrando...' : 'Criando conta...', '#8a8fa0');
      submitLoginSignup('tt-gate', mode).then(function (res) {
        if (res.error) { setMsg(res.error.message); return; }
        if (mode === 'signup' && res.data && !res.data.session) {
          setMsg('Conta criada! Confira seu email pra confirmar antes de entrar.', '#8a8fa0');
          return;
        }
        // sucesso com sessão -> onChange abaixo esconde o portão e chama onAuth
      });
    }

    getSession().then(function (session) {
      if (session) { el.style.display = 'none'; if (onAuth) onAuth(session); }
      else render();
    });
    onChange(function (session) {
      if (session) { el.style.display = 'none'; if (onAuth) onAuth(session); }
      else render();
    });
  }

  return {
    getClient: getClient, getSession: getSession,
    signInWithPassword: signInWithPassword, signUpWithPassword: signUpWithPassword,
    signOut: signOut, onChange: onChange,
    mountWidget: mountWidget, mountUserBadge: mountUserBadge, mountAuthGate: mountAuthGate
  };
})();
