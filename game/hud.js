// HUD em DOM puro, reproduzindo o layout do Agent Town:
// topo: logo | pills dos agentes | botoes de ferramentas
// base: pills de status (esq.) + dock de chat (dir.)
//
// O chat conversa com o personagem escolhido no jogo (chegar perto, E -> "Conversar") usando o
// modelo local do Ollama (game/conversation.js). Quem aceitar o cafe levanta e vai ate a
// cafeteira (OfficeScene); quando chega ("coffee:arrived"), o HUD mostra a tela de vitoria.
import { game, characters } from "../config/index.js";
import { FRAME_HEIGHT, FRAME_WIDTH, PORTRAIT_FRAME_INDEX, SHEET_COLUMNS } from "./constants.js";
import { gameEvents } from "./events.js";
import { conversationFor } from "./conversation.js";
import { checkOllama, warmUp } from "./ollama.js";
import { personas } from "./personas.js";

const BGM_SRC = game.audio.bgm;
const DEFAULT_BGM_VOLUME = game.audio.defaultVolume;
const LS_BGM_VOLUME = game.audio.storageKey;

/** `?debug` na URL: mostra o cenario sorteado (dificuldade, situacao, motivo, pistas) na loading e no HUD. */
export const debugMode = new URLSearchParams(location.search).has("debug");

const ICON = "/public/ui/icons";
const MODEL = game.ollama.model;
const MAX_QUESTION = game.chat.maxQuestionChars;
/** Depois do "sim", o chat fecha sozinho para o jogador ver o personagem indo ao cafe. */
const CLOSE_CHAT_AFTER_ACCEPT_MS = 1800;

const TOOLS = [
  { id: "music", label: "Music", icon: "icon-music", active: "icon-music-active" },
  { id: "connection", label: "Ollama", icon: "icon-connection", active: "icon-connection-active" },
  { id: "tasks", label: "Tasks", icon: "icon-tasks", active: "icon-tasks-active" },
  { id: "workers", label: "Employees", icon: "icon-workers", active: "icon-workers-active" },
];

/** Status da conexao com o Ollama: cor do ponto e texto da pill. */
const OLLAMA_STATUS = {
  checking: { dot: "gray", label: "Ollama..." },
  loading: { dot: "yellow", label: "Loading model" },
  online: { dot: "green", label: "Online" },
  missing: { dot: "yellow", label: "No model" },
  offline: { dot: "red", label: "Offline" },
};

/** Status de cada personagem no HUD: classe de cor e texto. */
const CHARACTER_STATUS = {
  idle: { cls: "idle", label: "working" },
  thinking: { cls: "running", label: "thinking" },
  accepted: { cls: "done", label: "coffee!" },
  coffee: { cls: "done", label: "coffee!" },
};

const SVG_ATTRS =
  'width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICON_SPARKLES = `<svg ${SVG_ATTRS}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`;
const ICON_COFFEE = `<svg ${SVG_ATTRS}><path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/></svg>`;

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const spritePath = (c) => `/public/characters/Premade_Character_48x48_${c.sprite}.png`;

// Retrato: recorta o 1o frame "idle-down" da sheet do personagem.
export function portrait(spritePath, scale = 1.1) {
  const fx = (PORTRAIT_FRAME_INDEX % SHEET_COLUMNS) * FRAME_WIDTH;
  const fy = Math.floor(PORTRAIT_FRAME_INDEX / SHEET_COLUMNS) * FRAME_HEIGHT;
  const w = FRAME_WIDTH * scale;
  const h = FRAME_HEIGHT * scale;
  // A sheet tem 2688px de largura (56 colunas x 48px).
  const sheetW = SHEET_COLUMNS * FRAME_WIDTH * scale;
  return `<div class="portrait" role="img" style="width:${w}px;height:${h}px;margin-top:-${h * 0.42}px;background-image:url('${esc(spritePath)}');background-size:${sheetW}px auto;background-position:-${fx * scale}px -${fy * scale}px"></div>`;
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}

/** Mensagem amigavel para erros da chamada ao Ollama. */
function errorMessage(err) {
  if (err instanceof TypeError) {
    return `Sem conexão com o Ollama em ${game.ollama.baseUrl}. Abra o Ollama (ou rode "ollama serve") e tente de novo.`;
  }
  if (/not found/i.test(err.message)) return `Modelo ${MODEL} não encontrado. Rode "ollama pull ${MODEL}".`;
  return `Erro do Ollama: ${err.message}`;
}

// ── BGM ───────────────────────────────────────────────────
function createBgm() {
  const clamp = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_BGM_VOLUME);
  const stored = localStorage.getItem(LS_BGM_VOLUME);
  let volume = clamp(stored === null ? DEFAULT_BGM_VOLUME : Number(stored));

  const audio = new Audio(BGM_SRC);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = volume;

  const tryPlay = () => {
    if (volume > 0 && audio.paused) audio.play().catch(() => {});
  };
  tryPlay();
  // Navegadores bloqueiam autoplay: toca no primeiro gesto do usuario.
  const unlock = () => {
    tryPlay();
    if (!audio.paused) {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("keydown", unlock);

  return {
    get volume() {
      return volume;
    },
    setVolume(percent) {
      volume = clamp(percent / 100);
      localStorage.setItem(LS_BGM_VOLUME, String(volume));
      audio.volume = volume;
      if (volume > 0) tryPlay();
      else audio.pause();
    },
  };
}

// ── Flyouts ───────────────────────────────────────────────
function flyout({ title, subtitle, headerAction = "", body, bodyClass = "" }) {
  return `
    <div class="hud-flyout">
      <div class="hud-flyout__header">
        <div class="hud-flyout__top-row">
          <span class="hud-flyout__title">${esc(title)}</span>
          ${headerAction}
        </div>
        ${subtitle ? `<div class="hud-flyout__subtitle">${esc(subtitle)}</div>` : ""}
      </div>
      <div class="hud-flyout__body ${bodyClass}">${body}</div>
    </div>`;
}

function statusTag(status) {
  const s = CHARACTER_STATUS[status] ?? CHARACTER_STATUS.idle;
  return `<span class="hud-status hud-status--${s.cls}">${esc(s.label)}</span>`;
}

function workersPanel(seats, statusOf) {
  const assigned = seats.filter((s) => s.assigned).length;
  const items = seats
    .map((seat) => {
      if (!seat.assigned) {
        return `
        <div class="hud-workers__item">
          <div class="hud-workers__top"><span class="hud-status hud-status--empty">vacant</span><span>Vacant Seat</span></div>
          <div class="hud-workers__task">Assign a crew member to this seat</div>
        </div>`;
      }
      const persona = personas.get(seat.id);
      const hint = persona?.hint;
      const sc = persona?.scenario;
      const debug =
        debugMode && sc
          ? `<div class="hud-workers__debug">[${esc(game.difficulty[sc.difficulty]?.label ?? sc.difficulty)} · ${esc(sc.source)}]<br>Situação: ${esc(sc.situation)}<br>Motivo: ${esc(sc.reason)}<br>Pistas: ${esc(sc.clues)}</div>`
          : "";
      return `
        <div class="hud-workers__item">
          <div class="hud-workers__top">${statusTag(statusOf(seat.id))}<span>${esc(seat.label)}</span></div>
          <div class="hud-workers__task">${esc(seat.roleTitle ?? "Worker")} &middot; ${seat.gender === "female" ? "F" : "M"}</div>
          ${hint ? `<div class="hud-workers__hint">${esc(hint)}</div>` : ""}
          ${debug}
        </div>`;
    })
    .join("");
  return flyout({
    title: "Employees",
    subtitle: `${assigned} na equipe`,
    body: `<div class="hud-workers">${items || '<div class="hud-empty">No seats found</div>'}</div>`,
  });
}

function musicPanel(bgm) {
  const pct = Math.round(bgm.volume * 100);
  return `
    <div class="hud-music-bar">
      <span class="hud-music-bar__label">&#9834;</span>
      <input class="hud-music-bar__slider" id="bgm-slider" type="range" min="0" max="100" step="1" value="${pct}" aria-label="Music volume" />
      <span class="hud-music-bar__pct" id="bgm-pct">${pct}</span>
    </div>`;
}

function connectionPanel(status, error) {
  const s = OLLAMA_STATUS[status];
  const help =
    status === "offline"
      ? `<div class="hud-panel__help">Abra o Ollama ou rode <code>ollama serve</code>.${error ? `<br><span class="hud-panel__error">${esc(error)}</span>` : ""}</div>`
      : status === "missing"
        ? `<div class="hud-panel__help">Baixe o modelo: <code>ollama pull ${esc(MODEL)}</code></div>`
        : status === "loading"
          ? '<div class="hud-panel__help">Carregando o modelo na memória (só na primeira vez)...</div>'
          : "";
  return flyout({
    title: "Ollama",
    subtitle: "IA local dos personagens",
    body: `
      <div class="hud-panel__stack">
        <div class="hud-panel__row"><span class="pixel-dot pixel-dot--${s.dot}"></span><span>${esc(s.label)}</span></div>
        <label class="hud-panel__label" for="conn-url">URL</label>
        <input id="conn-url" class="pixel-input hud-panel__input" value="${esc(game.ollama.baseUrl)}" readonly />
        <label class="hud-panel__label" for="conn-model">Model</label>
        <input id="conn-model" class="pixel-input hud-panel__input" value="${esc(MODEL)}" readonly />
        ${help}
        <button type="button" class="pixel-button pixel-button--primary" id="conn-retry" ${status === "checking" || status === "loading" ? "disabled" : ""}>Reconnect</button>
      </div>`,
  });
}

function tasksPanel(statusOf) {
  const atCoffee = characters.filter((c) => statusOf(c.id) === "coffee").length;
  const items = characters
    .map((c) => {
      const conv = conversationFor(c);
      const asked = conv.entries.filter((e) => e.role === "user").length;
      const done = statusOf(c.id) === "coffee" || statusOf(c.id) === "accepted";
      return `
        <div class="hud-workers__item">
          <div class="hud-workers__top">
            <span class="hud-status hud-status--${done ? "done" : "empty"}">${done ? "done" : "todo"}</span>
            <span>${asked} msg</span>
          </div>
          <div class="hud-workers__task">Levar ${esc(c.name)} para tomar café</div>
        </div>`;
    })
    .join("");
  return flyout({
    title: "Tasks",
    subtitle: `Leve alguém para o café · ${atCoffee}/${characters.length}`,
    body: `<div class="hud-workers">${items}</div>`,
  });
}

function chatPanelHtml(character) {
  return flyout({
    title: "Chat",
    subtitle: character ? `${character.name} · ${character.role}` : game.name,
    bodyClass: "hud-flyout__body--chat",
    body: `
      <div class="hud-chat-layout">
        <div class="hud-chat" id="chat-list"></div>
        <div class="hud-chat-quick" id="chat-quick" hidden></div>
        <div class="hud-chat-input-row">
          <div class="hud-chat-input-col">
            <textarea id="chat-input" class="pixel-input pixel-chat-input" rows="1" maxlength="${MAX_QUESTION}"></textarea>
            <span class="hud-chat__counter" id="chat-counter">0/${MAX_QUESTION}</span>
          </div>
          <button type="button" id="chat-send" class="pixel-icon-btn pixel-icon-btn--primary pixel-chat-icon-btn" title="Send">&#10148;</button>
        </div>
      </div>`,
  });
}

// Sem quebras de linha dentro da bolha: o texto usa white-space: pre-wrap.
function chatBubble(kind, role, text, extra = "") {
  return `<div class="hud-chat__bubble hud-chat__bubble--${kind}"><div class="hud-chat__header"><span class="hud-chat__role">${esc(role)}</span>${extra}</div>${text}</div>`;
}

function chatMessagesHtml(character, streamingText, notice) {
  if (!character) {
    return '<div class="hud-chat__system">Chegue perto de alguém, aperte E e escolha "Conversar".<br>Objetivo: convencer a pessoa a ir tomar café!</div>';
  }
  const conv = conversationFor(character);
  const name = character.name.toUpperCase();
  const items = [];
  if (!conv.entries.length && streamingText === undefined) {
    items.push(`<div class="hud-chat__system">${esc(character.name)} está trabalhando. Escolha uma opção abaixo ou escreva a sua mensagem.</div>`);
  }
  items.push(...conv.entries.map((e) =>
    e.role === "user"
      ? chatBubble("user", "VOCE", esc(e.text))
      : chatBubble("agent", name, esc(e.text), e.accepted ? '<span class="hud-chat__tag">aceitou</span>' : ""),
  ));
  if (streamingText !== undefined) {
    const body = streamingText
      ? `${esc(streamingText)}<span class="hud-chat__cursor"></span>`
      : '<span class="hud-chat__typing"><i></i><i></i><i></i></span>';
    items.push(chatBubble("agent", name, body));
  }
  if (conv.accepted) items.push(`<div class="hud-chat__system hud-chat__system--win">${esc(character.name)} aceitou o café!</div>`);
  if (notice) items.push(`<div class="hud-chat__system hud-chat__system--error">${esc(notice)}</div>`);
  return items.join("");
}

function victoryHtml(character, winners) {
  const conv = conversationFor(character);
  const asked = conv.entries.filter((e) => e.role === "user").length;
  return `
    <div class="hud-victory__card" role="dialog" aria-modal="true" aria-labelledby="victory-title">
      <div class="hud-victory__avatar">${portrait(spritePath(character), 1.6)}</div>
      <div class="hud-victory__title" id="victory-title">Voce ganhou!</div>
      <p class="hud-victory__text">${esc(character.name)} aceitou o convite e foi tomar café.</p>
      <p class="hud-victory__stats">${asked} ${asked === 1 ? "mensagem" : "mensagens"} &middot; ${formatDuration(Date.now() - winners.startedAt)} &middot; ${winners.count}/${characters.length} no café</p>
      <div class="hud-victory__actions">
        <button type="button" class="pixel-button" data-victory="continue">Continuar</button>
        <button type="button" class="pixel-button pixel-button--primary" data-victory="restart">Jogar de novo</button>
      </div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────
export function initHud() {
  const $ = (id) => document.getElementById(id);
  const pills = $("agent-pills");
  const tools = $("tool-buttons");
  const flyoutEl = $("topright-flyout");
  const chatPanel = $("chat-panel");
  const chatToggle = $("chat-toggle");
  const chatIcon = chatToggle.querySelector("img");
  const bottom = $("bottom-bar");

  const victory = document.createElement("div");
  victory.className = "hud-victory";
  victory.hidden = true;
  document.getElementById("app").appendChild(victory);

  const byId = new Map(characters.map((c) => [c.id, c]));
  const bgm = createBgm();
  const state = {
    seats: [],
    openPanel: null,
    activeSeat: null,
    /** id do personagem com quem o chat esta conversando. */
    chatWith: null,
    /** Respostas chegando em stream (id -> texto parcial). */
    streaming: new Map(),
    /** Aviso (erro) no fim do chat: { id, text } */
    notice: null,
    /** Chave de OLLAMA_STATUS. */
    ollama: "checking",
    ollamaError: "",
    /** Status por personagem (chave de CHARACTER_STATUS). */
    status: new Map(),
    /** Uso de contexto da ultima resposta: { used, total } */
    ctx: null,
    startedAt: Date.now(),
  };
  const statusOf = (id) => state.status.get(id) ?? "idle";

  function setStatus(id, status) {
    state.status.set(id, status);
    renderPills();
    renderBottom();
    if (state.openPanel === "workers" || state.openPanel === "tasks") renderFlyout();
  }

  function setOllama(status, error = "") {
    state.ollama = status;
    state.ollamaError = error;
    renderBottom();
    if (state.openPanel === "connection") renderFlyout();
  }

  /** Verifica o Ollama e ja carrega o modelo, para a 1a resposta sair rapido. */
  async function connectOllama() {
    setOllama("checking");
    const { online, hasModel, error } = await checkOllama();
    if (!online) return setOllama("offline", error);
    if (!hasModel) return setOllama("missing");
    if (!game.ollama.warmUp) return setOllama("online");
    setOllama("loading");
    try {
      await warmUp();
      setOllama("online");
    } catch (err) {
      setOllama("offline", err.message);
    }
  }

  function renderTools() {
    tools.innerHTML = TOOLS.map((t) => {
      const active = state.openPanel === t.id;
      const icon = t.id === "music" && bgm.volume <= 0 ? "icon-music-muted" : active ? t.active : t.icon;
      return `<button type="button" class="topbar-tool-btn ${active ? "topbar-tool-btn--active" : ""}" data-tool="${t.id}" title="${t.label}">
        <img src="${ICON}/${icon}.png" alt="${t.label}" /></button>`;
    }).join("");
  }

  function renderPills() {
    const assigned = state.seats.filter((s) => s.assigned);
    pills.innerHTML = assigned.length
      ? assigned
          .map((s) => {
            const status = statusOf(s.id);
            const done = status === "coffee" || status === "accepted";
            return `<button type="button" class="topbar-agent-pill ${state.activeSeat === s.seatId ? "topbar-agent-pill--active" : ""} ${done ? "topbar-agent-pill--done" : ""}" data-seat="${esc(s.seatId)}" title="${esc(s.label)} - ${esc(CHARACTER_STATUS[status].label)}">
          <span class="topbar-agent-pill__avatar">${portrait(s.spritePath)}</span>
          <span class="topbar-agent-pill__name">${esc(s.label)}</span>${done ? `<span class="topbar-agent-pill__coffee">${ICON_COFFEE}</span>` : ""}</button>`;
          })
          .join("")
      : '<span class="topbar-agent-pill__empty">No agents assigned</span>';
  }

  function renderBottom() {
    const total = characters.length;
    const atCoffee = characters.filter((c) => statusOf(c.id) === "coffee").length;
    const busy = characters.filter((c) => statusOf(c.id) === "thinking").length;
    const s = OLLAMA_STATUS[state.ollama];
    const pct = state.ctx ? Math.min(100, Math.round((state.ctx.used / state.ctx.total) * 100)) : 0;
    bottom.innerHTML = `
      <span class="hud-pill hud-pill--connection" title="Ollama"><span class="pixel-dot pixel-dot--${s.dot}"></span><span>${esc(s.label)}</span></span>
      <span class="hud-pill hud-pill--model">${ICON_SPARKLES}<span>${esc(MODEL)}</span></span>
      <span class="hud-pill hud-pill--metric" title="No café">${ICON_COFFEE}<span>${atCoffee}/${total} coffee</span></span>
      <span class="hud-pill hud-pill--metric"><span>${busy}/${total} busy</span></span>
      <span class="hud-meter-inline" title="Contexto usado na última resposta">
        <span class="hud-meter-inline__label">CTX</span>
        <span class="hud-meter-inline__bar"><span class="hud-meter__fill" style="display:block;width:${pct}%"></span></span>
        <span class="hud-meter-inline__value">${state.ctx ? `${pct}%` : "--"}</span>
      </span>`;
  }

  function renderFlyout() {
    const id = state.openPanel;
    if (!id || id === "chat") {
      flyoutEl.hidden = true;
      flyoutEl.innerHTML = "";
      return;
    }
    flyoutEl.innerHTML =
      id === "music"
        ? musicPanel(bgm)
        : id === "connection"
          ? connectionPanel(state.ollama, state.ollamaError)
          : id === "tasks"
            ? tasksPanel(statusOf)
            : workersPanel(state.seats, statusOf);
    flyoutEl.hidden = false;

    const slider = $("bgm-slider");
    if (slider) {
      slider.addEventListener("input", () => {
        bgm.setVolume(Number(slider.value));
        $("bgm-pct").textContent = String(Math.round(bgm.volume * 100));
        renderTools();
      });
    }
    $("conn-retry")?.addEventListener("click", connectOllama);
  }

  // ── Chat ────────────────────────────────────────────────
  /** Estrutura do painel: so muda ao abrir/fechar ou trocar de personagem. */
  function renderChat() {
    const open = state.openPanel === "chat";
    chatToggle.classList.toggle("hud-chat-dock__btn--active", open);
    chatIcon.src = `${ICON}/${open ? "icon-chat-active" : "icon-chat"}.png`;
    chatPanel.hidden = !open;
    if (!open) {
      chatPanel.innerHTML = "";
      return;
    }
    chatPanel.innerHTML = chatPanelHtml(byId.get(state.chatWith));
    const input = $("chat-input");
    $("chat-send").addEventListener("click", () => sendChat());
    $("chat-quick").addEventListener("click", (e) => {
      const reply = game.chat.quickReplies.find((q) => q.id === e.target.closest("[data-quick]")?.dataset.quick);
      if (reply) sendChat(reply.text);
    });
    input.addEventListener("input", renderCounter);
    input.addEventListener("keydown", (e) => {
      // O Phaser escuta o teclado na janela; evita mover o chefe enquanto digita.
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendChat();
      } else if (e.key === "Escape") {
        input.blur();
        state.openPanel = null;
        renderTools();
        renderChat();
      }
    });
    renderChatMessages();
    renderChatInput();
  }

  function renderChatMessages() {
    const list = $("chat-list");
    if (!list) return;
    const character = byId.get(state.chatWith);
    const notice = state.notice?.id === state.chatWith ? state.notice.text : "";
    list.innerHTML = chatMessagesHtml(character, state.streaming.get(state.chatWith), notice);
    list.scrollTop = list.scrollHeight;
  }

  function renderCounter() {
    const input = $("chat-input");
    const counter = $("chat-counter");
    if (!input || !counter) return;
    counter.textContent = `${input.value.length}/${MAX_QUESTION}`;
    counter.classList.toggle("hud-chat__counter--full", input.value.length >= MAX_QUESTION);
  }

  /** Habilita a digitacao so quando ha alguem para responder. */
  function renderChatInput() {
    const input = $("chat-input");
    if (!input) return;
    const character = byId.get(state.chatWith);
    const conv = character && conversationFor(character);
    const blocked = !character || conv.pending || conv.accepted;
    input.disabled = blocked;
    $("chat-send").disabled = blocked;
    // Respostas prontas: so para iniciar a conversa (enquanto o chefe ainda nao falou).
    const quick = $("chat-quick");
    quick.hidden = !character || conv.accepted || conv.bossMessages > 0;
    quick.innerHTML = quick.hidden
      ? ""
      : game.chat.quickReplies.map((q) => `<button type="button" class="hud-chat-quick__btn" data-quick="${esc(q.id)}">${esc(q.label)}</button>`).join("");
    input.placeholder = !character
      ? "Ninguém selecionado"
      : conv.accepted
        ? `${character.name} já foi tomar café`
        : conv.pending
          ? `${character.name} está pensando...`
          : `Fale com ${character.name}... (Enter envia)`;
    renderCounter();
  }

  async function sendChat(override) {
    const character = byId.get(state.chatWith);
    const input = $("chat-input");
    if (!character || !input) return;
    const conv = conversationFor(character);
    // `override`: texto de uma resposta pronta (os cliques passam o evento, que e ignorado).
    const fromQuick = typeof override === "string";
    const question = (fromQuick ? override : input.value).trim().slice(0, MAX_QUESTION);
    if (!question || conv.pending || conv.accepted) return;

    const { id } = character;
    const reply = conv.send(question, (partial) => {
      state.streaming.set(id, partial.text);
      if (state.chatWith === id) renderChatMessages();
    });
    if (!fromQuick) input.value = "";
    state.notice = null;
    state.streaming.set(id, "");
    setStatus(id, "thinking");
    gameEvents.emit("character:thinking", { id, thinking: true });
    renderChatMessages();
    renderChatInput();

    try {
      const { text, accepted, stats } = await reply;
      if (stats) state.ctx = { used: (stats.prompt_eval_count ?? 0) + (stats.eval_count ?? 0), total: game.ollama.options.num_ctx };
      state.streaming.delete(id);
      setStatus(id, accepted ? "accepted" : "idle");
      gameEvents.emit("character:reply", { id, text, accepted });
      if (accepted) {
        setTimeout(() => {
          if (state.openPanel !== "chat" || state.chatWith !== id) return;
          state.openPanel = null;
          renderTools();
          renderChat();
        }, CLOSE_CHAT_AFTER_ACCEPT_MS);
      }
    } catch (err) {
      console.error("[chat]", err);
      state.streaming.delete(id);
      state.notice = { id, text: errorMessage(err) };
      setStatus(id, "idle");
      gameEvents.emit("character:thinking", { id, thinking: false });
      // Devolve a pergunta para o jogador tentar de novo.
      const current = $("chat-input");
      if (!fromQuick && state.chatWith === id && current && !current.value) current.value = question;
      if (err instanceof TypeError) connectOllama();
    }
    if (state.chatWith === id) {
      renderChatMessages();
      renderChatInput();
      $("chat-input")?.focus();
    }
  }

  function openChat(characterId) {
    const character = byId.get(characterId);
    if (!character) return;
    state.chatWith = characterId;
    state.activeSeat = character.seat;
    state.openPanel = "chat";
    renderTools();
    renderPills();
    renderFlyout();
    renderChat();
    // Fora do evento de teclado que abriu o chat, para a tecla nao ser digitada no campo.
    setTimeout(() => $("chat-input")?.focus(), 0);
  }

  // ── Vitoria ─────────────────────────────────────────────
  function showVictory(character) {
    const count = characters.filter((c) => statusOf(c.id) === "coffee").length;
    victory.innerHTML = victoryHtml(character, { count, startedAt: state.startedAt });
    victory.hidden = false;
    victory.querySelector('[data-victory="restart"]').focus();
  }

  victory.addEventListener("click", (e) => {
    const action = e.target.closest("[data-victory]")?.dataset.victory;
    if (action === "restart") window.location.reload();
    else if (action === "continue") victory.hidden = true;
  });
  // Teclas nos botoes da vitoria nao movem o chefe por tras.
  victory.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") victory.hidden = true;
  });

  function renderAll() {
    renderTools();
    renderPills();
    renderBottom();
    renderFlyout();
    renderChat();
  }

  tools.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-tool]");
    if (!btn) return;
    const id = btn.dataset.tool;
    state.openPanel = state.openPanel === id ? null : id;
    renderTools();
    renderFlyout();
    renderChat();
  });

  chatToggle.addEventListener("click", () => {
    state.openPanel = state.openPanel === "chat" ? null : "chat";
    renderTools();
    renderFlyout();
    renderChat();
    if (state.openPanel === "chat") $("chat-input")?.focus();
  });

  pills.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-seat]");
    if (!btn) return;
    state.activeSeat = state.activeSeat === btn.dataset.seat ? null : btn.dataset.seat;
    renderPills();
  });

  gameEvents.on("seats", (seats) => {
    state.seats = seats;
    renderPills();
    renderBottom();
    if (state.openPanel === "workers") renderFlyout();
  });
  gameEvents.on("chat:open", ({ characterId }) => openChat(characterId));
  gameEvents.on("coffee:arrived", ({ id }) => {
    setStatus(id, "coffee");
    showVictory(byId.get(id));
  });

  renderAll();
  connectOllama();
}
