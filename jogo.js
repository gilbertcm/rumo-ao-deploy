/* ============ Rumo ao Deploy — lógica do jogo ============
   Para mudar casas, efeitos, cores ou velocidade, edite casas.js. */
(() => {
  "use strict";
  const C = window.CONFIG;
  const FINAL = C.totalCasas - 1;
  const mqRetrato = matchMedia("(max-width: 900px), (max-aspect-ratio: 1/1)");
  let COLS = C.colunas;
  let LINHAS = Math.ceil(C.totalCasas / COLS);

  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const dado6 = () => 1 + Math.floor(Math.random() * 6);
  const esc = (t) => String(t).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  // ---------- casas especiais (validadas) ----------
  const categoriaPadrao = {
    avancar: "bom", jogarNovamente: "bom", irPara: "sorte",
    voltar: "ruim", pularRodada: "ruim",
    casaDoUltimo: "sorte", trocarComLider: "sorte", outrosVoltam: "sorte", condicional: "sorte",
  };
  const especiais = new Map();
  (C.casasEspeciais || []).forEach((c) => {
    if (c && c.efeito && c.casa > 0 && c.casa < FINAL) {
      especiais.set(c.casa, { ...c, categoria: c.categoria || categoriaPadrao[c.efeito.tipo] || "sorte" });
    }
  });

  // ---------- estado ----------
  let qtdEscolhida = 2;
  let nomesDigitados = C.jogadores.map((j) => j.nome);
  let somLigado = C.somAtivado !== false;
  const E = { jogadores: [], atual: 0, rodada: 1, ocupado: false, fim: true, inicio: 0, jogadas: 0 };

  // =====================================================================
  //  SOM (Web Audio, sem arquivos externos)
  // =====================================================================
  let audio;
  function tom(freq, dur = 0.12, tipo = "square", vol = 0.05, atraso = 0) {
    if (!somLigado) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime + atraso;
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = tipo; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
    } catch (e) { /* sem áudio, sem problema */ }
  }
  const som = {
    passo: () => tom(520, 0.05, "triangle", 0.04),
    dado: () => tom(200 + Math.random() * 300, 0.04, "square", 0.025),
    bom: () => [523, 659, 784].forEach((f, i) => tom(f, 0.14, "triangle", 0.06, i * 0.09)),
    ruim: () => [330, 262, 196].forEach((f, i) => tom(f, 0.18, "sawtooth", 0.035, i * 0.11)),
    sorte: () => [440, 587, 440, 659].forEach((f, i) => tom(f, 0.1, "sine", 0.06, i * 0.07)),
    vitoria: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tom(f, 0.2, "triangle", 0.07, i * 0.13)),
  };

  // =====================================================================
  //  TELAS
  // =====================================================================
  function mostrarTela(id) {
    document.querySelectorAll(".tela").forEach((t) => t.classList.toggle("ativa", t.id === id));
    if (id === "tela-jogo") requestAnimationFrame(ajustarTabuleiro);
  }

  // ---------- tela inicial ----------
  function montarInicio() {
    $("#titulo-jogo").textContent = C.titulo;
    $("#subtitulo-jogo").textContent = C.subtitulo;
    $("#titulo-topo").textContent = C.titulo;
    document.title = C.titulo;
    document.querySelectorAll(".qtd button").forEach((b) => {
      b.addEventListener("click", () => { qtdEscolhida = +b.dataset.qtd; renderNomes(); });
    });
    renderNomes();
  }
  function renderNomes() {
    document.querySelectorAll(".qtd button").forEach((b) => b.setAttribute("aria-checked", String(+b.dataset.qtd === qtdEscolhida)));
    const box = $("#campos-nomes");
    box.innerHTML = "";
    for (let i = 0; i < qtdEscolhida; i++) {
      const j = C.jogadores[i];
      const d = document.createElement("label");
      d.className = "campo-nome";
      d.innerHTML = `<span class="ficha" style="--c:${j.cor}">${esc(j.simbolo)}</span>
        <input type="text" maxlength="16" aria-label="Nome do jogador ${i + 1}" placeholder="Jogador ${i + 1}" value="${esc(nomesDigitados[i] || "")}">`;
      d.querySelector("input").addEventListener("input", (e) => (nomesDigitados[i] = e.target.value));
      d.querySelector("input").addEventListener("focus", (e) => e.target.select());
      box.appendChild(d);
    }
  }

  // =====================================================================
  //  TABULEIRO
  // =====================================================================
  const tab = $("#tabuleiro");
  const celulas = [];

  function coord(i) {
    const linha = Math.floor(i / COLS);
    const col = linha % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
    return { row: LINHAS - linha, col: col + 1 }; // começa embaixo à esquerda, sobe em zigue-zague
  }

  // em tela vertical (totem em pé / celular) usa menos colunas
  function organizarGrade() {
    const cols = mqRetrato.matches ? (C.colunasRetrato || C.colunas) : C.colunas;
    if (cols === COLS && celulas[0]?.style.gridRow) return;
    COLS = cols; LINHAS = Math.ceil(C.totalCasas / COLS);
    tab.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    tab.style.gridTemplateRows = `repeat(${LINHAS}, 1fr)`;
    celulas.forEach((c, i) => { const { row, col } = coord(i); c.style.gridRow = row; c.style.gridColumn = col; });
  }

  function montarTabuleiro() {
    for (let i = 0; i < C.totalCasas; i++) {
      const c = document.createElement("div");
      c.className = "casa";
      let ico = "", rot = "";
      if (i === 0) { c.classList.add("inicio"); ico = C.casaInicio.icone; rot = C.casaInicio.rotulo; }
      else if (i === FINAL) { c.classList.add("final"); ico = C.casaFinal.icone; rot = C.casaFinal.rotulo; }
      else if (especiais.has(i)) { const e = especiais.get(i); c.classList.add(e.categoria); ico = e.icone || "★"; rot = e.rotulo || ""; }
      c.innerHTML = `<span class="num">${i}</span>${ico ? `<span class="ico">${esc(ico)}</span>` : ""}${rot ? `<span class="rot">${esc(rot)}</span>` : ""}`;
      c.title = especiais.has(i) ? `${i}: ${especiais.get(i).titulo}` : `Casa ${i}`;
      tab.insertBefore(c, $("#caminho"));
      celulas.push(c);
    }
    organizarGrade();
    new ResizeObserver(ajustarTabuleiro).observe($("#tabuleiro-wrap"));
  }

  function ajustarTabuleiro() {
    const wrap = $("#tabuleiro-wrap");
    if (!wrap.offsetParent) return;
    organizarGrade();
    const cs = getComputedStyle(wrap);
    const w = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const gap = parseFloat(getComputedStyle(tab).rowGap) || 8;
    const cel = Math.max(30, Math.floor(Math.min((w - gap * (COLS - 1)) / COLS, (h - gap * (LINHAS - 1)) / LINHAS)));
    tab.style.width = cel * COLS + gap * (COLS - 1) + "px";
    tab.style.height = cel * LINHAS + gap * (LINHAS - 1) + "px";
    document.documentElement.style.setProperty("--cell", cel + "px");
    desenharCaminho();
    posicionarPecas(true);
  }

  function centro(i) {
    const c = celulas[i];
    return { x: c.offsetLeft + c.offsetWidth / 2, y: c.offsetTop + c.offsetHeight / 2, t: c.offsetWidth };
  }

  function desenharCaminho() {
    const svg = $("#caminho");
    const pts = celulas.map((_, i) => { const p = centro(i); return `${p.x},${p.y}`; }).join(" ");
    svg.innerHTML = `<polyline points="${pts}"/>`;
  }

  // ---------- peças ----------
  const OFFSETS = {
    1: [[0, 0]],
    2: [[-0.2, 0], [0.2, 0]],
    3: [[-0.2, -0.17], [0.2, -0.17], [0, 0.2]],
    4: [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]],
  };

  function criarPecas() {
    const camada = $("#pecas");
    camada.innerHTML = "";
    E.jogadores.forEach((j) => {
      const p = document.createElement("div");
      p.className = "peca";
      p.style.setProperty("--c", j.cor);
      p.innerHTML = `<div class="corpo">${esc(j.simbolo)}</div>`;
      camada.appendChild(p);
      j.el = p;
    });
  }

  function posicionarPecas(instantaneo = false) {
    if (!celulas.length || !E.jogadores.length) return;
    const grupos = {};
    E.jogadores.forEach((j) => (grupos[j.pos] = grupos[j.pos] || []).push(j));
    E.jogadores.forEach((j) => {
      const g = grupos[j.pos];
      const k = g.indexOf(j);
      const [dx, dy] = OFFSETS[g.length][k];
      const c = centro(j.pos);
      const tam = c.t * 0.44;
      if (instantaneo) j.el.classList.add("sem-transicao");
      j.el.style.transform = `translate(${c.x + dx * c.t - tam / 2}px, ${c.y + dy * c.t - tam / 2}px)`;
      if (instantaneo) { void j.el.offsetWidth; j.el.classList.remove("sem-transicao"); }
      j.el.classList.toggle("atual", j === jogadorAtual() && !E.fim);
    });
  }

  // =====================================================================
  //  PAINEL
  // =====================================================================
  const jogadorAtual = () => E.jogadores[E.atual];

  function atualizarPainel() {
    const j = jogadorAtual();
    if (j) {
      $("#turno").style.setProperty("--c", j.cor);
      $("#turno-nome").textContent = j.nome;
    }
    $("#num-rodada").textContent = E.rodada;
    const ul = $("#lista-jogadores");
    ul.innerHTML = "";
    E.jogadores.forEach((p) => {
      const li = document.createElement("li");
      li.style.setProperty("--c", p.cor);
      if (p === j) li.classList.add("atual");
      li.innerHTML = `<span class="ficha" style="--c:${p.cor}">${esc(p.simbolo)}</span>
        <span class="nome">${esc(p.nome)}</span>
        ${p.pular > 0 ? `<span class="estado">while(${p.pular})</span>` : ""}
        <span class="pos">casa ${p.pos}</span>`;
      ul.appendChild(li);
    });
    $("#btn-dado").disabled = E.ocupado || E.fim;
    celulas.forEach((c) => c.classList.remove("destaque"));
    posicionarPecas();
  }

  function log(txt, cls = "", jogador = null) {
    const li = document.createElement("li");
    if (cls) li.className = cls;
    li.innerHTML = jogador ? `<b style="color:${jogador.cor}">${esc(jogador.nome)}</b> ${esc(txt)}` : esc(txt);
    const ul = $("#log");
    ul.prepend(li);
    while (ul.children.length > 40) ul.lastChild.remove();
  }

  let avisoTimer;
  function aviso(txt, cor = "var(--acento2)", ms = 2200) {
    const a = $("#aviso");
    a.textContent = txt;
    a.style.borderColor = cor;
    a.classList.add("visivel");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => a.classList.remove("visivel"), ms);
  }

  // ---------- dado ----------
  const FACES = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  function mostrarFace(n) {
    $("#dado").querySelectorAll("i").forEach((p, i) => p.classList.toggle("on", FACES[n].includes(i)));
    $("#dado").setAttribute("aria-label", `Dado: ${n}`);
  }
  async function rolarDado() {
    const d = $("#dado");
    d.classList.add("rolando");
    for (let k = 0; k < 9; k++) { mostrarFace(dado6()); som.dado(); await sleep(65); }
    const v = dado6();
    mostrarFace(v);
    d.classList.remove("rolando");
    return v;
  }

  // =====================================================================
  //  MODAL (mensagens das casas, regras, confirmações)
  // =====================================================================
  let modalAberto = null;
  function abrirModal({ icone = "", titulo = "", html = "", categoria = "", largo = false, botoes = [{ texto: "OK, continuar", valor: true, primario: true }], autoFechar = 0 }) {
    return new Promise((resolve) => {
      const fundo = $("#modal");
      const m = fundo.querySelector(".modal");
      m.className = "modal " + categoria + (largo ? " largo" : "");
      $("#modal-icone").textContent = icone;
      $("#modal-icone").style.display = icone ? "" : "none";
      $("#modal-titulo").textContent = titulo;
      $("#modal-corpo").innerHTML = html;
      const bx = $("#modal-botoes");
      bx.innerHTML = "";
      const timer = $("#modal-timer");
      timer.style.transition = "none"; timer.style.width = "0";
      let t;
      const fechar = (v) => {
        clearTimeout(t);
        fundo.hidden = true;
        modalAberto = null;
        resolve(v);
      };
      botoes.forEach((b, i) => {
        const el = document.createElement("button");
        el.type = "button";
        el.className = "btn grande" + (b.primario ? " primario" : "");
        el.textContent = b.texto;
        el.addEventListener("click", () => fechar(b.valor));
        bx.appendChild(el);
      });
      fundo.hidden = false;
      modalAberto = { fechar, padrao: botoes.find((b) => b.primario)?.valor ?? botoes[0].valor, cancelar: botoes[botoes.length - 1].valor };
      bx.querySelector(".primario, button")?.focus({ preventScroll: true });
      m.scrollTop = 0;
      if (autoFechar > 0) {
        requestAnimationFrame(() => { timer.style.transition = `width ${autoFechar}s linear`; timer.style.width = "100%"; });
        t = setTimeout(() => fechar(modalAberto?.padrao), autoFechar * 1000);
      }
    });
  }

  function htmlRegras() {
    const linhas = [...especiais.values()].sort((a, b) => a.casa - b.casa).map((e) =>
      `<tr><td class="n">${e.casa}</td><td>${esc(e.icone || "")} <span class="tag ${e.categoria}">${esc(e.rotulo || "")}</span></td>
       <td><b>${esc(e.titulo || "")}</b><br>${esc(e.texto || "")}<br><i>➜ ${esc(descreverEfeito(e.efeito))}</i></td></tr>`).join("");
    return `<ul class="regras-lista">
      <li>De 2 a 4 jogadores. Cada um, na sua vez, joga o dado (1 a 6) e anda exatamente essa quantidade de casas.</li>
      <li>Ao parar numa casa especial, o efeito dela acontece na hora. Efeitos não encadeiam.</li>
      <li>${C.chegadaExata ? "Para fazer o DEPLOY é preciso tirar o número exato; se passar, a peça volta o que sobrou." : "Chegou ou passou da última casa: DEPLOY feito, vitória!"}</li>
      </ul>
      <table class="tabela-casas"><thead><tr><th>Casa</th><th>Tipo</th><th>O que acontece</th></tr></thead><tbody>${linhas}</tbody></table>`;
  }
  const abrirRegras = () => abrirModal({ icone: "📖", titulo: "Regras e casas especiais", html: htmlRegras(), largo: true, botoes: [{ texto: "Fechar", valor: true, primario: true }] });

  // =====================================================================
  //  EFEITOS
  // =====================================================================
  function descreverEfeito(ef) {
    switch (ef.tipo) {
      case "avancar": return `Avance ${ef.casas} casa${ef.casas > 1 ? "s" : ""}.`;
      case "voltar": return `Volte ${ef.casas} casa${ef.casas > 1 ? "s" : ""}.`;
      case "pularRodada": return `Fique ${ef.rodadas || 1} rodada${(ef.rodadas || 1) > 1 ? "s" : ""} sem jogar.`;
      case "jogarNovamente": return "Jogue o dado de novo!";
      case "irPara": return `Vá para a casa ${ef.casa}.`;
      case "casaDoUltimo": return "Vá para a casa do último colocado.";
      case "trocarComLider": return "Troque de lugar com o líder.";
      case "outrosVoltam": return `Todos os outros voltam ${ef.casas} casa${ef.casas > 1 ? "s" : ""}.`;
      case "condicional": return `Par: ${descreverEfeito(ef.par)} Ímpar: ${descreverEfeito(ef.impar)}`;
      default: return "Nada acontece.";
    }
  }

  // move um ou mais jogadores passo a passo (passos com sinal)
  async function moverPassos(j, passos) {
    let p = j.pos, dir = Math.sign(passos);
    const caminho = [];
    for (let k = 0; k < Math.abs(passos); k++) {
      if (dir > 0 && p === FINAL) {
        if (!C.chegadaExata) break;
        dir = -1;
      }
      if (dir < 0 && p === 0) break;
      p += dir;
      caminho.push(p);
    }
    for (const pos of caminho) {
      j.pos = pos;
      j.el.classList.remove("pulando"); void j.el.offsetWidth; j.el.classList.add("pulando");
      posicionarPecas();
      som.passo();
      await sleep(C.velocidadePasso);
    }
    j.el.classList.remove("pulando");
  }
  async function moverPara(j, destino) {
    destino = Math.max(0, Math.min(FINAL, destino));
    if (destino !== j.pos) await moverPassos(j, destino - j.pos);
  }

  // executa o efeito; retorna true se o jogador joga de novo
  async function executar(j, ef) {
    const outros = E.jogadores.filter((o) => o !== j);
    switch (ef.tipo) {
      case "avancar": await moverPassos(j, ef.casas); return false;
      case "voltar": await moverPassos(j, -ef.casas); return false;
      case "irPara": await moverPara(j, ef.casa); return false;
      case "pularRodada": j.pular += ef.rodadas || 1; log(`está preso no while por ${ef.rodadas || 1} rodada(s).`, "ruim", j); return false;
      case "jogarNovamente": return true;
      case "casaDoUltimo": {
        const alvo = Math.min(...outros.map((o) => o.pos));
        if (alvo < j.pos) await moverPara(j, alvo);
        return false;
      }
      case "trocarComLider": {
        const lider = outros.reduce((a, b) => (b.pos > a.pos ? b : a));
        if (lider.pos > j.pos) {
          [j.pos, lider.pos] = [lider.pos, j.pos];
          posicionarPecas();
          som.sorte();
          log(`trocou de lugar com ${lider.nome}.`, "sorte", j);
          await sleep(500);
        }
        return false;
      }
      case "outrosVoltam": {
        for (let k = 0; k < ef.casas; k++) {
          outros.forEach((o) => { if (o.pos > 0) o.pos--; });
          posicionarPecas(); som.passo();
          await sleep(C.velocidadePasso);
        }
        return false;
      }
      default: return false;
    }
  }

  async function aplicarEspecial(j, e) {
    const cel = celulas[j.pos];
    cel.classList.add("destaque");
    let ef = e.efeito;
    let extra = "";
    let resumo = descreverEfeito(ef);
    const outros = E.jogadores.filter((o) => o !== j);

    if (ef.tipo === "condicional") {
      const v = await rolarDado();
      const par = v % 2 === 0;
      ef = par ? ef.par : ef.impar;
      resumo = `Saiu ${v} (${par ? "par → if" : "ímpar → else"}): ${descreverEfeito(ef)}`;
    }
    // avisos de casos sem efeito
    if (ef.tipo === "casaDoUltimo" && Math.min(...outros.map((o) => o.pos)) >= j.pos) {
      extra = "<br><small>Mas você já é o último da lista — nada muda!</small>";
    }
    if (ef.tipo === "trocarComLider" && Math.max(...outros.map((o) => o.pos)) <= j.pos) {
      extra = "<br><small>Mas você já é o líder — o pull veio vazio!</small>";
    }

    const cat = e.categoria;
    (som[cat] || som.sorte)();
    log(`caiu em ${e.rotulo || e.titulo} (casa ${j.pos}): ${resumo}`, cat, j);
    await abrirModal({
      icone: e.icone, titulo: e.titulo, categoria: cat,
      html: `<div class="quem"><span style="color:${j.cor};font-weight:800">${esc(j.nome)}</span> caiu na casa ${j.pos}</div>
             ${esc(e.texto || "")}<br><span class="efeito">➜ ${esc(resumo)}</span>${extra}`,
      autoFechar: C.fecharMensagemApos || 0,
    });
    cel.classList.remove("destaque");
    return executar(j, ef);
  }

  // =====================================================================
  //  FLUXO DA PARTIDA
  // =====================================================================
  function iniciarPartida(jogadores) {
    E.jogadores = jogadores.map((j, i) => ({ ...j, id: i, pos: 0, pular: 0 }));
    E.atual = 0; E.rodada = 1; E.ocupado = false; E.fim = false; E.inicio = Date.now(); E.jogadas = 0;
    $("#log").innerHTML = "";
    mostrarFace(1);
    mostrarTela("tela-jogo");
    criarPecas();
    ajustarTabuleiro();
    log("Partida iniciada. Boa sorte, devs!");
    log("é o primeiro a jogar.", "", jogadorAtual());
    atualizarPainel();
    $("#btn-dado").focus();
  }

  async function jogarDado() {
    if (E.ocupado || E.fim || modalAberto) return;
    E.ocupado = true;
    atualizarPainel();
    const j = jogadorAtual();
    const v = await rolarDado();
    E.jogadas++;
    log(`tirou ${v}.`, "", j);
    await moverPassos(j, v);

    let deNovo = false;
    if (j.pos !== FINAL && especiais.has(j.pos)) {
      deNovo = await aplicarEspecial(j, especiais.get(j.pos));
    }
    if (j.pos === FINAL) return vitoria(j);

    if (deNovo) {
      log("joga de novo!", "bom", j);
      aviso(`${j.nome} joga de novo!`, j.cor);
    } else {
      proximoTurno();
    }
    E.ocupado = false;
    atualizarPainel();
    $("#btn-dado").focus();
  }

  function proximoTurno() {
    const n = E.jogadores.length;
    for (let guarda = 0; guarda < 100; guarda++) {
      E.atual = (E.atual + 1) % n;
      if (E.atual === 0) E.rodada++;
      const p = jogadorAtual();
      if (p.pular > 0) {
        p.pular--;
        log("está preso no while e perdeu a vez.", "ruim", p);
        aviso(`🔁 ${p.nome} está preso no while — perdeu a vez!`, "var(--ruim)", 2600);
        continue;
      }
      break;
    }
    aviso(`Vez de ${jogadorAtual().nome}`, jogadorAtual().cor, 1500);
  }

  function vitoria(j) {
    E.fim = true;
    E.ocupado = false;
    log("fez o DEPLOY e venceu!", "bom", j);
    som.vitoria();
    posicionarPecas();
    setTimeout(() => {
      $("#vencedor-nome").textContent = j.nome;
      $("#vencedor-nome").style.color = j.cor;
      const seg = Math.round((Date.now() - E.inicio) / 1000);
      $("#fim-stats").textContent = `${E.rodada} rodada(s) · ${E.jogadas} jogadas · ${Math.floor(seg / 60)}min ${String(seg % 60).padStart(2, "0")}s`;
      const ol = $("#ranking");
      ol.innerHTML = "";
      [...E.jogadores].sort((a, b) => (a === j ? -1 : b === j ? 1 : b.pos - a.pos)).forEach((p, i) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="lugar">${i + 1}º</span><span class="ficha" style="--c:${p.cor}">${esc(p.simbolo)}</span>
          <span class="nome">${esc(p.nome)}</span><span class="pos">${p.pos === FINAL ? "DEPLOY 🚀" : "casa " + p.pos}</span>`;
        ol.appendChild(li);
      });
      mostrarTela("tela-fim");
      confete();
      $("#btn-revanche").focus();
    }, 700);
  }

  function lerJogadoresDaTelaInicial() {
    return C.jogadores.slice(0, qtdEscolhida).map((j, i) => ({
      ...j, nome: (nomesDigitados[i] || "").trim() || `Jogador ${i + 1}`,
    }));
  }

  // ---------- confete ----------
  let confeteId;
  function confete() {
    const cv = $("#confete"), ctx = cv.getContext("2d");
    cv.width = innerWidth; cv.height = innerHeight;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cores = ["#FFD23F", "#3EC1F3", "#FF5CA8", "#FF8A3D", "#5fe39a", "#b388ff"];
    const ps = Array.from({ length: 180 }, () => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height, v: 2 + Math.random() * 4,
      r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2, s: 6 + Math.random() * 10, c: cores[(Math.random() * cores.length) | 0],
      txt: Math.random() < 0.15 ? ["{ }", "</>", "01", ";"][(Math.random() * 4) | 0] : null,
    }));
    cancelAnimationFrame(confeteId);
    const t0 = performance.now();
    (function loop(t) {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => {
        p.y += p.v; p.r += p.vr; p.x += Math.sin(p.r) * 1.2;
        if (p.y > cv.height && t - t0 < 6000) p.y = -20;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c;
        if (p.txt) { ctx.font = `bold ${p.s * 2}px monospace`; ctx.fillText(p.txt, 0, 0); }
        else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      });
      if (t - t0 < 11000) confeteId = requestAnimationFrame(loop);
      else ctx.clearRect(0, 0, cv.width, cv.height);
    })(t0);
  }

  // =====================================================================
  //  EVENTOS
  // =====================================================================
  function ligarEventos() {
    $("#btn-comecar").addEventListener("click", () => iniciarPartida(lerJogadoresDaTelaInicial()));
    $("#btn-ver-casas").addEventListener("click", abrirRegras);
    $("#btn-regras").addEventListener("click", abrirRegras);
    $("#btn-dado").addEventListener("click", jogarDado);
    $("#btn-revanche").addEventListener("click", () => iniciarPartida(E.jogadores.map(({ nome, cor, simbolo }) => ({ nome, cor, simbolo }))));
    $("#btn-nova").addEventListener("click", () => { cancelAnimationFrame(confeteId); mostrarTela("tela-inicio"); });

    const btnSom = $("#btn-som");
    const atualizaSom = () => { btnSom.textContent = somLigado ? "🔊 Som" : "🔇 Mudo"; btnSom.setAttribute("aria-pressed", String(somLigado)); };
    btnSom.addEventListener("click", () => { somLigado = !somLigado; atualizaSom(); });
    atualizaSom();

    $("#btn-tela-cheia").addEventListener("click", () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
      else document.exitFullscreen?.();
    });

    $("#btn-reiniciar").addEventListener("click", async () => {
      if (modalAberto) return;
      const ok = await abrirModal({
        icone: "⟲", titulo: "Reiniciar partida?", html: "O progresso atual será perdido.", categoria: "ruim",
        botoes: [{ texto: "Sim, voltar ao início", valor: true, primario: true }, { texto: "Cancelar", valor: false }],
      });
      if (ok) { E.fim = true; E.ocupado = false; mostrarTela("tela-inicio"); }
    });

    document.addEventListener("keydown", (e) => {
      if (modalAberto) {
        if (e.key === "Escape") { e.preventDefault(); modalAberto.fechar(modalAberto.cancelar); }
        else if ((e.key === " " || e.key === "Enter") && document.activeElement?.tagName !== "BUTTON") {
          e.preventDefault(); modalAberto.fechar(modalAberto.padrao);
        }
        return;
      }
      const naTela = (id) => $("#" + id).classList.contains("ativa");
      if (naTela("tela-jogo") && (e.key === " " || e.key === "Enter")) {
        if (e.target.tagName === "BUTTON" && e.target.id !== "btn-dado") return; // deixa o botão focado agir
        e.preventDefault();
        jogarDado();
      } else if (naTela("tela-inicio") && e.key === "Enter" && e.target.tagName === "INPUT") {
        iniciarPartida(lerJogadoresDaTelaInicial());
      }
    });
    addEventListener("resize", () => { const cv = $("#confete"); cv.width = innerWidth; cv.height = innerHeight; });
  }

  // ---------- início ----------
  montarInicio();
  montarTabuleiro();
  ligarEventos();
  mostrarFace(6);
})();
