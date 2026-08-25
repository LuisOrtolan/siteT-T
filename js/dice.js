// js/dice.js
// Matemática de dados standalone (sem dependência de auth/DOM), usada pela
// Mesa Virtual. Diferente do RNG seedado do Funil (js/funil.js, privado à
// sua IIFE) — aqui é Math.random() puro, cada rolagem é genuinamente aleatória.
window.TT_DICE = (function () {
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function rollDie(faces) {
    return randInt(1, faces);
  }

  function rollNdM(n, faces) {
    const dice = [];
    for (let i = 0; i < n; i++) dice.push(rollDie(faces));
    return { dice, sum: dice.reduce((a, b) => a + b, 0) };
  }

  function rollD66() {
    const dezena = rollDie(6);
    const unidade = rollDie(6);
    return { dezena, unidade, valor: dezena * 10 + unidade };
  }

  const PRESETS = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

  function rollPreset(nome) {
    if (nome === 'd66') {
      const r = rollD66();
      return { formula: 'd66', dice: [r.dezena, r.unidade], mod: 0, total: r.valor };
    }
    if (nome === '3d6') {
      const r = rollNdM(3, 6);
      return { formula: '3d6', dice: r.dice, mod: 0, total: r.sum };
    }
    const faces = PRESETS[nome];
    if (!faces) return { formula: nome, error: 'Dado desconhecido: ' + nome };
    const r = rollNdM(1, faces);
    return { formula: nome, dice: r.dice, mod: 0, total: r.sum };
  }

  // Aceita termos separados por + ou -, cada um "NdM" (ex: "2d6") ou um
  // número fixo (ex: "3"). Espaços são ignorados. Ex: "2d6+1d4-2", "1d20+3".
  function parseFormula(texto) {
    const clean = (texto || '').replace(/\s+/g, '').toLowerCase();
    if (!clean) return null;
    const re = /([+-]?)(\d*d\d+|\d+)/g;
    let m, matched = '';
    const termos = [];
    while ((m = re.exec(clean))) {
      matched += m[0];
      const sinal = m[1] === '-' ? -1 : 1;
      const parte = m[2];
      if (parte.indexOf('d') !== -1) {
        const [nStr, facesStr] = parte.split('d');
        const n = nStr === '' ? 1 : parseInt(nStr, 10);
        const faces = parseInt(facesStr, 10);
        if (!n || !faces || n > 100 || faces > 1000) return null;
        termos.push({ sinal, n, faces });
      } else {
        termos.push({ sinal, mod: parseInt(parte, 10) });
      }
    }
    if (!termos.length || matched !== clean) return null;
    return termos;
  }

  function rollFormula(texto) {
    const termos = parseFormula(texto);
    if (!termos) return { formula: texto, error: 'Não entendi essa fórmula. Use algo como "2d6+3".' };
    const dice = [];
    let mod = 0, total = 0;
    termos.forEach(t => {
      if (t.faces) {
        const r = rollNdM(t.n, t.faces);
        r.dice.forEach(v => dice.push(t.sinal * v));
        total += t.sinal * r.sum;
      } else {
        mod += t.sinal * t.mod;
        total += t.sinal * t.mod;
      }
    });
    return { formula: texto, dice, mod, total };
  }

  return { randInt, rollDie, rollNdM, rollD66, rollPreset, parseFormula, rollFormula, PRESETS };
})();
