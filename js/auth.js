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

  // Envia o email de "esqueci minha senha". O link leva pra
  // redefinir-senha.html, que estabelece uma sessão de recuperação e deixa
  // a pessoa escolher uma senha nova.
  function resetPasswordForEmail(email) {
    var c = getClient();
    if (!c) return Promise.reject(new Error('Supabase não configurado.'));
    return c.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/redefinir-senha.html' });
  }

  // Dispara quando a pessoa chega em redefinir-senha.html vindo de um link
  // de recuperação válido (Supabase já estabelece a sessão a partir do
  // token na URL antes de emitir esse evento).
  function onPasswordRecovery(cb) {
    var c = getClient();
    if (!c) return;
    c.auth.onAuthStateChange(function (event, session) {
      if (event === 'PASSWORD_RECOVERY') cb(session);
    });
  }

  function updatePassword(newPassword) {
    var c = getClient();
    if (!c) return Promise.reject(new Error('Supabase não configurado.'));
    return c.auth.updateUser({ password: newPassword });
  }

  function loginSignupFields(idPrefix, mode) {
    var html = '<input type="email" id="' + idPrefix + '-email" placeholder="seu@email.com" required />';
    if (mode !== 'recover') {
      html += '<input type="password" id="' + idPrefix + '-senha" placeholder="senha" required minlength="6" />';
    }
    return html;
  }

  function submitLoginSignup(idPrefix, mode) {
    var email = document.getElementById(idPrefix + '-email').value.trim();
    var senha = document.getElementById(idPrefix + '-senha').value;
    if (!email || !senha) return Promise.resolve({ error: { message: 'Preencha email e senha.' } });
    var action = mode === 'login' ? signInWithPassword(email, senha) : signUpWithPassword(email, senha);
    return action;
  }

  function submitRecover(idPrefix) {
    var email = document.getElementById(idPrefix + '-email').value.trim();
    if (!email) return Promise.resolve({ error: { message: 'Preencha o email.' } });
    return resetPasswordForEmail(email);
  }

  // ---- Widget compacto (cabeçalho do site) ----
  function mountWidget(containerSelector) {
    var el = document.querySelector(containerSelector);
    if (!el) return;
    var c = getClient();
    if (!c) { el.innerHTML = ''; return; }
    var mode = 'login';

    function widgetLinks(mode) {
      if (mode === 'signup') return 'Já tem conta? <a href="#" data-mode="login">Entrar</a>';
      if (mode === 'recover') return '<a href="#" data-mode="login">Voltar</a>';
      return 'Sem conta? <a href="#" data-mode="signup">Criar conta</a> · <a href="#" data-mode="recover">Esqueci minha senha</a>';
    }

    function renderLoggedOut() {
      var submitLabel = mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar' : 'Enviar link';
      el.innerHTML =
        '<form class="tt-auth-form" id="tt-auth-form">' +
        loginSignupFields('tt-auth', mode) +
        '<button type="submit" class="btn btn-secondary tt-auth-btn">' + submitLabel + '</button>' +
        '</form>' +
        '<p class="tt-auth-msg" id="tt-auth-msg">' + widgetLinks(mode) + '</p>';

      el.querySelector('#tt-auth-form').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var msg = el.querySelector('#tt-auth-msg');
        if (mode === 'recover') {
          msg.textContent = 'Enviando...';
          submitRecover('tt-auth').then(function (res) {
            if (res.error) { msg.textContent = res.error.message; return; }
            msg.textContent = 'Link enviado! Confira seu email.';
          });
          return;
        }
        msg.textContent = mode === 'login' ? 'Entrando...' : 'Criando conta...';
        submitLoginSignup('tt-auth', mode).then(function (res) {
          if (res.error) { msg.textContent = res.error.message; return; }
          if (mode === 'signup' && res.data && !res.data.session) {
            msg.textContent = 'Conta criada! Confira seu email pra confirmar antes de entrar.';
          }
        });
      });
      el.querySelector('#tt-auth-msg').addEventListener('click', function (ev) {
        var novoModo = ev.target.getAttribute('data-mode');
        if (!novoModo) return;
        ev.preventDefault();
        mode = novoModo;
        renderLoggedOut();
      });
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
    function gateTitle(mode) {
      if (mode === 'signup') return 'CRIAR CONTA';
      if (mode === 'recover') return 'REDEFINIR SENHA';
      return 'ENTRAR';
    }

    function gateSubmitLabel(mode) {
      if (mode === 'signup') return 'Criar conta';
      if (mode === 'recover') return 'Enviar link';
      return 'Entrar';
    }

    function gateLinks(mode) {
      if (mode === 'signup') return 'Já tem conta? <a href="#" data-mode="login" style="color:#c7a25a">Entrar</a>';
      if (mode === 'recover') return '<a href="#" data-mode="login" style="color:#c7a25a">Voltar para login</a>';
      return 'Não tem conta? <a href="#" data-mode="signup" style="color:#c7a25a">Criar uma</a> · <a href="#" data-mode="recover" style="color:#c7a25a">Esqueci minha senha</a>';
    }

    function render() {
      el.style.cssText = 'position:fixed;inset:0;z-index:150;background:#0f1014;display:flex;align-items:center;justify-content:center;padding:16px';
      el.innerHTML =
        '<div style="max-width:340px;width:100%;background:#181a20;border:1px solid #2a2d35;border-radius:12px;padding:22px;font-family:Georgia,serif;color:#f5f5f7;box-sizing:border-box">' +
        '<h2 style="color:#c7a25a;font-size:16px;font-weight:normal;text-align:center;margin:0 0 14px;letter-spacing:.05em">' + gateTitle(mode) + '</h2>' +
        '<div id="tt-gate-fields" style="display:flex;flex-direction:column;gap:8px"></div>' +
        '<button id="tt-gate-submit" style="width:100%;background:#c7a25a15;border:1px solid #c7a25a40;color:#c7a25a;border-radius:6px;padding:9px;font-size:13px;cursor:pointer;font-family:inherit;margin-top:10px">' + gateSubmitLabel(mode) + '</button>' +
        '<p id="tt-gate-msg" style="font-size:11px;color:#d06060;text-align:center;min-height:14px;margin:8px 0 0"></p>' +
        '<p id="tt-gate-links" style="font-size:11px;color:#6b7080;text-align:center;margin:4px 0 0">' + gateLinks(mode) + '</p></div>';

      var fields = el.querySelector('#tt-gate-fields');
      fields.innerHTML = loginSignupFields('tt-gate', mode);
      fields.querySelectorAll('input').forEach(function (inp) {
        inp.style.cssText = 'width:100%;background:#0f1014;border:1px solid #2a2d35;border-radius:6px;padding:9px 10px;color:#f5f5f7;font-size:13px;box-sizing:border-box;font-family:inherit';
        inp.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') submit(); });
      });
      el.querySelector('#tt-gate-links').addEventListener('click', function (ev) {
        var novoModo = ev.target.getAttribute('data-mode');
        if (!novoModo) return;
        ev.preventDefault();
        mode = novoModo;
        render();
      });
      el.querySelector('#tt-gate-submit').addEventListener('click', submit);
    }

    function setMsg(text, color) {
      var msg = el.querySelector('#tt-gate-msg');
      if (msg) { msg.textContent = text || ''; msg.style.color = color || '#d06060'; }
    }

    function submit() {
      if (mode === 'recover') {
        setMsg('Enviando...', '#8a8fa0');
        submitRecover('tt-gate').then(function (res) {
          if (res.error) { setMsg(res.error.message); return; }
          setMsg('Link enviado! Confira seu email.', '#8a8fa0');
        });
        return;
      }
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
    resetPasswordForEmail: resetPasswordForEmail, onPasswordRecovery: onPasswordRecovery, updatePassword: updatePassword,
    mountWidget: mountWidget, mountUserBadge: mountUserBadge, mountAuthGate: mountAuthGate
  };
})();
