// HUD do modo "Equipe adivinha" (DOM puro, mesmo layout do Agent Town do modo classico):
// topo: logo | pills da equipe (andando / conversando / pensando / cafe) | ferramentas
// base: Ollama, modelo, conversa X/N, dicas, palpites, tempo + dock "Conversa"
//
// O dock "Conversa" mostra tudo o que a equipe falou (com o palpite e a reacao do chefe) e deixa o
// jogador dar dicas extras. Ao fim da rodada aparece a tela de resultado (acertou / ninguem acertou).
import { game, characters } from "../config/index.js";
import { gameEvents } from "./events.js";
import { checkOllama, generateJson } from "./ollama.js";
import { personas } from "./personas.js";
import { restartIn } from "./modes.js";
import { TeamRound } from "./teamChat.js";
import { CATEGORY_LABEL, LINE_FORMAT } from "./teamPrompt.js";
import {
  ICON,
  ICON_COFFEE,
  ICON_SPARKLES,
  MODEL,
  OLLAMA_STATUS,
  connectionPanel,
  createBgm,
  debugMode,
  errorMessage,
  esc,
  flyout,
  formatDuration,
  musicPanel,
  portrait,
  spritePath,
} from "./hud.js";

const cfg = game.team;

const TOOLS = [
  { id: "music", label: "Music", icon: "icon-music", active: "icon-music-active" },
  { id: "connection", label: "Ollama", icon: "icon-connection", active: "icon-connection-active" },
  { id: "round", label: "Rodada (palavra, dicas e palpites)", icon: "icon-tasks", active: "icon-tasks-active" },
  { id: "workers", label: "Equipe", icon: "icon-workers", active: "icon-workers-active" },
];

/** Status de cada pessoa no HUD: classe de cor e texto. */
const CREW_STATUS = {
  walking: { cls: "idle", label: "andando" },
  talking: { cls: "running", label: "conversando" },
  thinking: { cls: "running", label: "pensando" },
  winner: { cls: "done", label: "acertou!" },
  coffee: { cls: "done", label: "café!" },
};

/** Etiqueta de cada resultado de palpite. */
const VERDICT_TAG = {
  right: { cls: "right", label: "acertou!" },
  close: { cls: "close", label: "quente" },
  wrong: { cls: "wrong", label: "errado" },
  repeat: { cls: "wrong", label: "repetido" },
  none: { cls: "none", label: "sem palpite" },
};

const byId = new Map(characters.map((c) => [c.id, c]));

/** Modelo -> JSON da fala (formato LINE_FORMAT), com a temperatura do modo equipe. */
function ask(messages, { signal } = {}) {
  return generateJson({ messages, format: LINE_FORMAT, options: { temperature: cfg.temperature }, signal });
}

/**
 * Cria a rodada assim que a cena estiver pronta ("team:stage") e liga o HUD nela.
 * `setup` = { word, category, hints } do formulario (game/teamSetup.js).
 */
export function startTeamMode(setup) {
  let started = false;
  gameEvents.on("team:stage", (stage) => {
    if (started) return;
    started = true;
    const round = new TeamRound({ ...setup, crew: characters, personas, ask, stage });
    // Referencia para depuracao no console do navegador.
    globalThis.__ROUND__ = round;
    initTeamHud(round);
    if (debugMode) {
      round.on("line", (l) => console.log(`[equipe] ${l.name}: ${l.text}`, { palpite: l.guess, resultado: l.verdict, raciocinio: l.reasoning, candidatos: l.candidates }));
    }
    round.run().catch((err) => console.error("[equipe]", err));
  });
}

// ── Pedacos de HTML ───────────────────────────────────────
function crewStatus(round, id, arrived) {
  if (arrived.has(id)) return "coffee";
  if (round.winner?.id === id) return "winner";
  if (round.thinkingId === id) return "thinking";
  if (round.talking.includes(id)) return "talking";
  return "walking";
}

function statusTag(status) {
  const s = CREW_STATUS[status];
  return `<span class="hud-status hud-status--${s.cls}">${esc(s.label)}</span>`;
}

function guessChips(list, cls) {
  return list.length ? list.map((g) => `<span class="team-chip team-chip--${cls}">${esc(g)}</span>`).join("") : '<span class="team-chip team-chip--empty">nenhum</span>';
}

function roundPanel(round, confirmStop) {
  const pending = round.pendingHints.map((h, i) => {
    const at = (round.formHints - round.pendingHints.length + i) * cfg.revealHintEvery;
    return `<li class="team-hints__item team-hints__item--pending"><span>${esc(h)}</span><small>sai na conversa ${at + 1}</small></li>`;
  });
  const said = round.hints.map((h) => `<li class="team-hints__item"><span>${esc(h)}</span><small>dita</small></li>`);
  const stop = round.running
    ? `<button type="button" class="pixel-button ${confirmStop ? "pixel-button--danger" : ""}" id="round-stop">${confirmStop ? "Confirmar: encerrar" : "Encerrar rodada"}</button>`
    : "";
  return flyout({
    title: "Rodada",
    subtitle: `Conversa ${Math.max(1, round.conversations.length)}/${cfg.maxConversations} · ${round.guessCount} palpites`,
    body: `<div class="hud-panel__stack">
        <div class="hud-persona__field"><b>Palavra secreta</b>${esc(round.word)}</div>
        <div class="hud-persona__field"><b>Categoria</b>${esc(CATEGORY_LABEL[round.category] ?? round.category)}</div>
        <div class="hud-persona__field"><b>Dicas</b><ol class="team-hints">${[...said, ...pending].join("")}</ol></div>
        <div class="hud-persona__field"><b>Palpites errados</b><div class="team-chips">${guessChips(round.wrong, "wrong")}</div></div>
        <div class="hud-persona__field"><b>Quase lá ("tá quente")</b><div class="team-chips">${guessChips(round.close, "close")}</div></div>
        ${stop}
      </div>`,
  });
}

function workersPanel(round, arrived) {
  const items = characters
    .map((c) => {
      const lines = round.log.filter((l) => l.type === "line" && l.speakerId === c.id);
      const last = lines.at(-1);
      const convs = round.conversations.filter((cv) => cv.ids.includes(c.id)).length;
      const hint = personas.get(c.id)?.hint;
      return `<div class="hud-workers__item">
          <div class="hud-workers__top">${statusTag(crewStatus(round, c.id, arrived))}<span>${esc(c.name)}</span></div>
          <div class="hud-workers__task">${esc(c.role)} &middot; ${convs} ${convs === 1 ? "conversa" : "conversas"} &middot; ${lines.length} ${lines.length === 1 ? "fala" : "falas"}</div>
          ${last?.guess ? `<div class="hud-workers__hint">Último palpite: ${esc(last.guess)}</div>` : ""}
          ${hint ? `<div class="hud-workers__hint">${esc(hint)}</div>` : ""}
        </div>`;
    })
    .join("");
  return flyout({ title: "Equipe", subtitle: `${characters.length} tentando adivinhar`, body: `<div class="hud-workers hud-workers--tall">${items}</div>` });
}

function logHtml(round) {
  const items = [];
  let conv = 0;
  for (const e of round.log) {
    if (e.type === "line" && e.conversation !== conv) {
      conv = e.conversation;
      const ids = round.conversations[conv - 1]?.ids ?? [];
      items.push(`<div class="team-log__sep">Conversa ${conv} · ${ids.map((id) => esc(byId.get(id)?.name ?? id)).join(" e ")}</div>`);
    }
    if (e.type === "boss") {
      items.push(`<div class="hud-chat__system team-log__boss team-log__boss--${esc(e.kind)}"><span class="hud-chat__role">CHEFE (VOCÊ)</span> ${esc(e.text)}</div>`);
      continue;
    }
    const tag = VERDICT_TAG[e.verdict];
    const guess = e.guess ? `<span class="team-tag team-tag--${tag.cls}">${esc(e.guess)} · ${esc(tag.label)}</span>` : `<span class="team-tag team-tag--none">${esc(tag.label)}</span>`;
    const debug = debugMode && (e.reasoning || e.candidates.length) ? `<div class="team-log__debug">${esc(e.reasoning)}${e.candidates.length ? ` [${esc(e.candidates.join(", "))}]` : ""}</div>` : "";
    items.push(`<div class="hud-chat__bubble hud-chat__bubble--agent"><div class="hud-chat__header"><span class="hud-chat__role">${esc(e.name.toUpperCase())}</span>${guess}</div>${esc(e.text)}${debug}</div>`);
  }
  if (round.thinkingId) {
    const name = byId.get(round.thinkingId)?.name ?? "";
    items.push(`<div class="hud-chat__bubble hud-chat__bubble--agent"><div class="hud-chat__header"><span class="hud-chat__role">${esc(name.toUpperCase())}</span></div><span class="hud-chat__typing"><i></i><i></i><i></i></span></div>`);
  }
  if (!items.length) {
    items.push('<div class="hud-chat__system">A equipe está se juntando para a primeira conversa...</div>');
  }
  if (round.error) items.push(`<div class="hud-chat__system hud-chat__system--error">${esc(errorMessage(round.error))} Tentando de novo...</div>`);
  return items.join("");
}

function chatPanelHtml(round) {
  const current = round.conversations.at(-1);
  const who = current ? current.ids.map((id) => byId.get(id)?.name ?? id).join(" e ") : "";
  return flyout({
    title: "Conversa da equipe",
    subtitle: current ? `Conversa ${current.index}/${cfg.maxConversations} · ${who}` : "Ninguém começou a conversar ainda",
    bodyClass: "hud-flyout__body--chat",
    body: `
      <div class="hud-chat-layout">
        <div class="hud-chat" id="team-log" aria-live="polite"></div>
        <div class="team-hint-error" id="team-hint-error" role="alert"></div>
        <form class="hud-chat-input-row" id="team-hint-form">
          <div class="hud-chat-input-col">
            <label class="visually-hidden" for="team-hint-input">Dar mais uma dica</label>
            <textarea id="team-hint-input" class="pixel-input pixel-chat-input" rows="1" maxlength="${cfg.hintMaxChars}"></textarea>
            <span class="hud-chat__counter" id="team-hint-counter"></span>
          </div>
          <button type="submit" id="team-hint-send" class="pixel-icon-btn pixel-icon-btn--primary pixel-chat-icon-btn" title="Dar a dica" aria-label="Dar a dica">&#10148;</button>
        </form>
      </div>`,
  });
}

function endHtml(round) {
  const s = round.summary();
  const stats = `${s.conversations} ${s.conversations === 1 ? "conversa" : "conversas"} &middot; ${s.guesses} ${s.guesses === 1 ? "palpite" : "palpites"} &middot; ${s.hints} ${s.hints === 1 ? "dica" : "dicas"} &middot; ${formatDuration(s.durationMs)}`;
  const word = `&ldquo;${esc(s.word)}&rdquo;`;
  let avatar = "";
  let title = "";
  let text = "";
  if (s.status === "won") {
    avatar = portrait(spritePath(s.winner), 1.6);
    title = "A equipe acertou!";
    text = `${esc(s.winner.name)} disse ${word} na conversa ${s.conversations}. Café liberado para todo mundo!`;
  } else if (s.status === "lost") {
    title = "Ninguém acertou";
    text = `A palavra era ${word}. Em ${s.conversations} conversas a equipe não chegou lá: tente dicas mais claras na próxima.`;
  } else {
    title = "Rodada encerrada";
    text = `A palavra era ${word}.`;
  }
  return `
    <div class="hud-victory__card" role="dialog" aria-modal="true" aria-labelledby="team-end-title">
      ${avatar ? `<div class="hud-victory__avatar">${avatar}</div>` : ""}
      <div class="hud-victory__title" id="team-end-title">${title}</div>
      <p class="hud-victory__text">${text}</p>
      <p class="hud-victory__stats">${stats}</p>
      <div class="hud-victory__actions">
        <button type="button" class="pixel-button" data-end="close">Ver o escritório</button>
        <button type="button" class="pixel-button" data-end="modes">Trocar de modo</button>
        <button type="button" class="pixel-button pixel-button--primary" data-end="again">Nova rodada</button>
      </div>
    </div>`;
}

// ── Init ──────────────────────────────────────────────────
export function initTeamHud(round) {
  const $ = (id) => document.getElementById(id);
  const pills = $("agent-pills");
  const tools = $("tool-buttons");
  const flyoutEl = $("topright-flyout");
  const chatPanel = $("chat-panel");
  const chatToggle = $("chat-toggle");
  const chatIcon = chatToggle.querySelector("img");
  const chatLabel = chatToggle.querySelector(".hud-chat-dock__label");
  const bottom = $("bottom-bar");
  chatLabel.textContent = "Conversa";
  chatToggle.title = "Conversa da equipe";

  const endEl = document.createElement("div");
  endEl.className = "hud-victory";
  endEl.hidden = true;
  $("app").appendChild(endEl);

  const bgm = createBgm();
  // O Phaser escuta o teclado na janela: digitar a dica nao pode mover o chefe.
  for (const type of ["keydown", "keyup"]) chatPanel.addEventListener(type, (e) => e.stopPropagation());
  const state = {
    openPanel: null,
    ollama: "online",
    ollamaError: "",
    /** Falas novas desde a ultima vez que o painel "Conversa" foi aberto. */
    unread: 0,
    confirmStop: false,
    arrived: new Set(),
  };

  function setOllama(status, error = "") {
    state.ollama = status;
    state.ollamaError = error;
    renderBottom();
    if (state.openPanel === "connection") renderFlyout();
  }

  async function reconnect() {
    setOllama("checking");
    const { online, hasModel, error } = await checkOllama();
    setOllama(!online ? "offline" : hasModel ? "online" : "missing", error);
  }

  function renderTools() {
    tools.innerHTML = TOOLS.map((t) => {
      const active = state.openPanel === t.id;
      const icon = t.id === "music" && bgm.volume <= 0 ? "icon-music-muted" : active ? t.active : t.icon;
      return `<button type="button" class="topbar-tool-btn ${active ? "topbar-tool-btn--active" : ""}" data-tool="${t.id}" title="${esc(t.label)}" aria-label="${esc(t.label)}" aria-pressed="${active}">
        <img src="${ICON}/${icon}.png" alt="" /></button>`;
    }).join("");
  }

  function renderPills() {
    pills.innerHTML = characters
      .map((c) => {
        const status = crewStatus(round, c.id, state.arrived);
        const s = CREW_STATUS[status];
        const done = status === "coffee" || status === "winner";
        const busy = status === "talking" || status === "thinking";
        return `<span class="topbar-agent-pill ${busy ? "topbar-agent-pill--active" : ""} ${done ? "topbar-agent-pill--done" : ""}" title="${esc(c.name)} - ${esc(s.label)}">
          <span class="topbar-agent-pill__avatar">${portrait(spritePath(c))}</span>
          <span class="topbar-agent-pill__name">${esc(c.name)}</span>${status === "thinking" ? '<span class="topbar-agent-pill__dots" aria-hidden="true">...</span>' : ""}${done ? `<span class="topbar-agent-pill__coffee">${ICON_COFFEE}</span>` : ""}</span>`;
      })
      .join("");
  }

  function renderBottom() {
    const s = OLLAMA_STATUS[state.ollama];
    const conv = Math.max(round.conversations.length, round.running ? 1 : 0);
    const elapsed = round.startedAt ? (round.endedAt ?? Date.now()) - round.startedAt : 0;
    bottom.innerHTML = `
      <span class="hud-pill hud-pill--connection" title="Ollama"><span class="pixel-dot pixel-dot--${s.dot}"></span><span>${esc(s.label)}</span></span>
      <span class="hud-pill hud-pill--model">${ICON_SPARKLES}<span>${esc(MODEL)}</span></span>
      <span class="hud-pill hud-pill--metric" title="Conversas"><span>Conversa ${conv}/${cfg.maxConversations}</span></span>
      <span class="hud-pill hud-pill--metric" title="Dicas dadas"><span>${round.hints.length} ${round.hints.length === 1 ? "dica" : "dicas"}</span></span>
      <span class="hud-pill hud-pill--metric" title="Palpites da equipe"><span>${round.guessCount} palpites</span></span>
      <span class="hud-pill hud-pill--metric" title="Tempo de rodada"><span>${formatDuration(elapsed)}</span></span>`;
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
          : id === "round"
            ? roundPanel(round, state.confirmStop)
            : workersPanel(round, state.arrived);
    flyoutEl.hidden = false;

    const slider = $("bgm-slider");
    slider?.addEventListener("input", () => {
      bgm.setVolume(Number(slider.value));
      $("bgm-pct").textContent = String(Math.round(bgm.volume * 100));
      renderTools();
    });
    $("conn-retry")?.addEventListener("click", reconnect);
    $("round-stop")?.addEventListener("click", () => {
      if (!state.confirmStop) {
        state.confirmStop = true;
        return renderFlyout();
      }
      state.confirmStop = false;
      round.stop();
    });
  }

  // ── Dock "Conversa" ─────────────────────────────────────
  function renderChatButton() {
    const open = state.openPanel === "chat";
    chatToggle.classList.toggle("hud-chat-dock__btn--active", open);
    chatIcon.src = `${ICON}/${open ? "icon-chat-active" : "icon-chat"}.png`;
    chatLabel.textContent = state.unread && !open ? `Conversa (${state.unread})` : "Conversa";
  }

  function renderChat() {
    const open = state.openPanel === "chat";
    renderChatButton();
    chatPanel.hidden = !open;
    if (!open) {
      chatPanel.innerHTML = "";
      return;
    }
    state.unread = 0;
    renderChatButton();
    chatPanel.innerHTML = chatPanelHtml(round);
    const form = $("team-hint-form");
    const input = $("team-hint-input");
    input.addEventListener("input", renderHintInput);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      } else if (e.key === "Escape") {
        input.blur();
        state.openPanel = null;
        renderTools();
        renderChat();
      }
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const result = round.addHint(input.value);
      $("team-hint-error").textContent = result.ok ? "" : result.error;
      if (result.ok) input.removeAttribute("aria-invalid");
      else input.setAttribute("aria-invalid", "true");
      if (result.ok) input.value = "";
      renderHintInput();
    });
    renderLog();
    renderHintInput();
  }

  function renderLog() {
    const list = $("team-log");
    if (!list) return;
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    list.innerHTML = logHtml(round);
    if (atBottom || !list.dataset.seen) list.scrollTop = list.scrollHeight;
    list.dataset.seen = "1";
  }

  function renderHintInput() {
    const input = $("team-hint-input");
    if (!input) return;
    const left = round.extraHintsLeft;
    const blocked = !round.running || left <= 0;
    input.disabled = blocked;
    $("team-hint-send").disabled = blocked;
    input.placeholder = !round.running
      ? round.status === "ready"
        ? "A rodada já vai começar..."
        : "A rodada terminou"
      : left <= 0
        ? "Você já deu todas as dicas extras"
        : `Dar mais uma dica (${left} ${left === 1 ? "restante" : "restantes"})... Enter envia`;
    $("team-hint-counter").textContent = `${input.value.length}/${cfg.hintMaxChars}`;
  }

  // ── Fim da rodada ───────────────────────────────────────
  function showEnd() {
    endEl.innerHTML = endHtml(round);
    endEl.hidden = false;
    endEl.querySelector('[data-end="again"]').focus();
  }
  endEl.addEventListener("click", (e) => {
    const action = e.target.closest("[data-end]")?.dataset.end;
    if (action === "again") restartIn("team");
    else if (action === "modes") restartIn(null);
    else if (action === "close") endEl.hidden = true;
  });
  endEl.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") endEl.hidden = true;
  });

  // ── Eventos ─────────────────────────────────────────────
  tools.addEventListener("click", (e) => {
    const id = e.target.closest("[data-tool]")?.dataset.tool;
    if (!id) return;
    state.openPanel = state.openPanel === id ? null : id;
    state.confirmStop = false;
    renderTools();
    renderFlyout();
    renderChat();
  });

  chatToggle.addEventListener("click", () => {
    state.openPanel = state.openPanel === "chat" ? null : "chat";
    renderTools();
    renderFlyout();
    renderChat();
    if (state.openPanel === "chat") $("team-hint-input")?.focus();
  });

  round.on("update", ({ type }) => {
    if (type === "line") {
      if (state.openPanel !== "chat") state.unread++;
      renderChatButton();
    }
    if (type === "error") {
      if (round.error) setOllama("offline", round.error.message);
      else setOllama("online");
    }
    renderPills();
    renderBottom();
    renderLog();
    renderHintInput();
    if (state.openPanel === "round" || state.openPanel === "workers") renderFlyout();
    if (state.openPanel === "chat") {
      const subtitle = chatPanel.querySelector(".hud-flyout__subtitle");
      const current = round.conversations.at(-1);
      if (subtitle && current) subtitle.textContent = `Conversa ${current.index}/${cfg.maxConversations} · ${current.ids.map((id) => byId.get(id)?.name ?? id).join(" e ")}`;
    }
  });
  round.on("end", () => {
    clearInterval(clock);
    renderBottom();
    renderHintInput();
    if (state.openPanel === "round") renderFlyout();
    showEnd();
  });
  gameEvents.on("coffee:arrived", ({ id }) => {
    state.arrived.add(id);
    renderPills();
  });

  const clock = setInterval(renderBottom, 1000);
  renderTools();
  renderPills();
  renderBottom();
  renderFlyout();
  renderChat();
}
