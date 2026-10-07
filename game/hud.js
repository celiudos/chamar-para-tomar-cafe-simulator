// HUD em DOM puro, reproduzindo o layout do Agent Town:
// topo: logo | pills dos agentes | botoes de ferramentas
// base: pills de status (esq.) + dock de chat (dir.)
import { game } from "../config/index.js";
import { FRAME_HEIGHT, FRAME_WIDTH, PORTRAIT_FRAME_INDEX, SHEET_COLUMNS } from "./constants.js";
import { gameEvents } from "./events.js";

const BGM_SRC = game.audio.bgm;
const DEFAULT_BGM_VOLUME = game.audio.defaultVolume;
const LS_BGM_VOLUME = game.audio.storageKey;

const ICON = "/public/ui/icons";

const TOOLS = [
  { id: "music", label: "Music", icon: "icon-music", active: "icon-music-active" },
  { id: "connection", label: "Connection", icon: "icon-connection", active: "icon-connection-active" },
  { id: "tasks", label: "Tasks", icon: "icon-tasks", active: "icon-tasks-active" },
  { id: "workers", label: "Employees", icon: "icon-workers", active: "icon-workers-active" },
];

const SVG_ATTRS =
  'width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICON_SPARKLES = `<svg ${SVG_ATTRS}><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`;
const ICON_USERS = `<svg ${SVG_ATTRS}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Retrato: recorta o 1o frame "idle-down" da sheet do personagem.
function portrait(spritePath, scale = 1.1) {
  const fx = (PORTRAIT_FRAME_INDEX % SHEET_COLUMNS) * FRAME_WIDTH;
  const fy = Math.floor(PORTRAIT_FRAME_INDEX / SHEET_COLUMNS) * FRAME_HEIGHT;
  const w = FRAME_WIDTH * scale;
  const h = FRAME_HEIGHT * scale;
  // A sheet tem 2688px de largura (56 colunas x 48px).
  const sheetW = SHEET_COLUMNS * FRAME_WIDTH * scale;
  return `<div class="portrait" role="img" style="width:${w}px;height:${h}px;margin-top:-${h * 0.42}px;background-image:url('${esc(spritePath)}');background-size:${sheetW}px auto;background-position:-${fx * scale}px -${fy * scale}px"></div>`;
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

function seatStatusLabel(seat) {
  if (!seat.assigned) return "vacant";
  if (seat.status === "empty") return "idle";
  return seat.status;
}

function workersPanel(seats) {
  const assigned = seats.filter((s) => s.assigned).length;
  const working = seats.filter((s) => s.assigned && s.status === "running").length;
  const items = seats
    .map(
      (seat) => `
      <div class="hud-workers__item">
        <div class="hud-workers__top">
          <span class="hud-status hud-status--${seat.assigned ? "idle" : "empty"}">${esc(seatStatusLabel(seat))}</span>
          <span>${esc(seat.assigned ? seat.label : "Vacant Seat")}</span>
        </div>
        <div class="hud-workers__task">${
          seat.assigned
            ? `${esc(seat.roleTitle ?? "Worker")} &middot; ${seat.gender === "female" ? "F" : "M"} &middot; at desk`
            : "Assign a crew member to this seat"
        }</div>
      </div>`,
    )
    .join("");
  return flyout({
    title: "Employees",
    subtitle: `${assigned} assigned / ${working} working`,
    headerAction: '<button type="button" class="pixel-button" disabled>Manage Seats</button>',
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

function connectionPanel() {
  return flyout({
    title: "Connection",
    subtitle: "Somente interface: nenhum servidor de agentes conectado.",
    body: `
      <div class="hud-panel__stack">
        <label class="hud-panel__label" for="conn-url">Gateway URL</label>
        <input id="conn-url" class="pixel-input hud-panel__input" value="ws://127.0.0.1:18789/" disabled />
        <button type="button" class="pixel-button pixel-button--primary" disabled>Connect</button>
      </div>`,
  });
}

function tasksPanel() {
  return flyout({
    title: "Tasks",
    subtitle: "0 tasks",
    body: '<div class="hud-empty">No tasks yet</div>',
  });
}

function chatPanelHtml(messages) {
  const list = messages.length
    ? messages
        .map(
          (m) => `
        <div class="hud-chat__bubble hud-chat__bubble--user">
          <div class="hud-chat__header"><span class="hud-chat__role">YOU</span></div>
          ${esc(m)}
        </div>`,
        )
        .join("")
    : '<div class="hud-chat__system">Say hi! (chat local, sem agentes conectados)</div>';
  return flyout({
    title: "Chat",
    subtitle: game.name,
    bodyClass: "hud-flyout__body--chat",
    body: `
      <div class="hud-chat-layout">
        <div class="hud-chat" id="chat-list">${list}</div>
        <div class="hud-chat-input-row">
          <textarea id="chat-input" class="pixel-input pixel-chat-input" rows="1" placeholder="Type a message..."></textarea>
          <button type="button" id="chat-send" class="pixel-icon-btn pixel-icon-btn--primary pixel-chat-icon-btn" title="Send">&#10148;</button>
        </div>
      </div>`,
  });
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

  const bgm = createBgm();
  const state = { seats: [], openPanel: null, chat: [], activeSeat: null };

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
          .map(
            (s) => `<button type="button" class="topbar-agent-pill ${state.activeSeat === s.seatId ? "topbar-agent-pill--active" : ""}" data-seat="${esc(s.seatId)}" title="${esc(s.label)} - ${esc(s.status)}">
          <span class="topbar-agent-pill__avatar">${portrait(s.spritePath)}</span>
          <span class="topbar-agent-pill__name">${esc(s.label)}</span></button>`,
          )
          .join("")
      : '<span class="topbar-agent-pill__empty">No agents assigned</span>';
  }

  function renderBottom() {
    const total = state.seats.length;
    const assigned = state.seats.filter((s) => s.assigned).length;
    const busy = state.seats.filter((s) => s.assigned && s.status === "running").length;
    bottom.innerHTML = `
      <span class="hud-pill hud-pill--connection"><span class="pixel-dot pixel-dot--green"></span><span>Online</span></span>
      <span class="hud-pill hud-pill--model">${ICON_SPARKLES}<span>Coffee: ready</span></span>
      <span class="hud-pill hud-pill--metric">${ICON_USERS}<span>${assigned}/${total} seat</span></span>
      <span class="hud-pill hud-pill--metric"><span>${busy}/${assigned} busy</span></span>
      <span class="hud-meter-inline">
        <span class="hud-meter-inline__label">CTX</span>
        <span class="hud-meter-inline__bar"><span class="hud-meter__fill" style="display:block;width:100%"></span></span>
        <span class="hud-meter-inline__value">--</span>
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
          ? connectionPanel()
          : id === "tasks"
            ? tasksPanel()
            : workersPanel(state.seats);
    flyoutEl.hidden = false;

    const slider = $("bgm-slider");
    if (slider) {
      slider.addEventListener("input", () => {
        bgm.setVolume(Number(slider.value));
        $("bgm-pct").textContent = String(Math.round(bgm.volume * 100));
        renderTools();
      });
    }
  }

  function renderChat() {
    const open = state.openPanel === "chat";
    chatToggle.classList.toggle("hud-chat-dock__btn--active", open);
    chatIcon.src = `${ICON}/${open ? "icon-chat-active" : "icon-chat"}.png`;
    chatPanel.hidden = !open;
    if (!open) {
      chatPanel.innerHTML = "";
      return;
    }
    chatPanel.innerHTML = chatPanelHtml(state.chat);
    const input = $("chat-input");
    const list = $("chat-list");
    list.scrollTop = list.scrollHeight;

    const send = () => {
      const text = input.value.trim();
      if (!text) return;
      state.chat.push(text);
      renderChat();
      $("chat-input").focus();
    };
    $("chat-send").addEventListener("click", send);
    input.addEventListener("keydown", (e) => {
      // O Phaser captura teclas globais; evita mover o chefe enquanto digita.
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
  }

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

  renderAll();
}
