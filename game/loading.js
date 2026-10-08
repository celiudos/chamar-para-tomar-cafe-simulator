// Tela de loading: antes de o jogo comecar, complementa a persona de cada personagem
// (dificuldade, palavra secreta, categoria e pistas) com o Ollama.
// Sem Ollama (ou sem o modelo), usa os cenarios prontos de personas/*.md.
import { game, characters } from "../config/index.js";
import { checkOllama } from "./ollama.js";
import { buildScenarios } from "./scenario.js";
import { debugMode, esc, portrait, spritePath } from "./hud.js";

const STATUS_LABEL = {
  waiting: "aguardando",
  working: "inventando...",
  done: "pronto",
  fallback: "cenário reserva",
};

function listHtml(status) {
  return characters
    .map((c) => {
      const s = status.get(c.id);
      return `<li class="loading__item loading__item--${s}">
        <span class="loading__avatar">${portrait(spritePath(c), 1)}</span>
        <span class="loading__name">${esc(c.name)}<small>${esc(c.role)}</small></span>
        <span class="loading__status">${esc(STATUS_LABEL[s])}</span>
      </li>`;
    })
    .join("");
}

function debugHtml(scenarios) {
  return scenarios
    .map(
      (s) => `<div class="loading__debug-item"><b>${esc(s.name)}</b> · ${esc(game.difficulty[s.difficulty].label)} · ${esc(s.source)}<br>
        <i>Palavra:</i> ${esc(s.word)}<br><i>Categoria:</i> ${esc(s.category)}<br><i>Pistas:</i> ${esc(s.clues)}</div>`,
    )
    .join("");
}

/**
 * Mostra a tela de loading, gera os cenarios e espera o jogador apertar "Comecar".
 * Resolve com a lista de cenarios (um por personagem).
 */
export async function runLoading() {
  const root = document.getElementById("loading");
  const $ = (id) => document.getElementById(id);
  const list = $("loading-list");
  const bar = $("loading-bar");
  const subtitle = $("loading-subtitle");
  const tip = $("loading-tip");
  const start = $("loading-start");
  $("loading-classic").hidden = false;

  const status = new Map(characters.map((c) => [c.id, "waiting"]));
  const render = () => {
    list.innerHTML = listHtml(status);
    const finished = [...status.values()].filter((s) => s === "done" || s === "fallback").length;
    bar.style.width = `${Math.round((finished / characters.length) * 100)}%`;
  };
  render();

  // Frases rodando enquanto espera.
  let tipIndex = 0;
  const rotateTip = () => {
    tip.textContent = game.loading.tips[tipIndex++ % game.loading.tips.length];
  };
  rotateTip();
  const tipTimer = setInterval(rotateTip, 2500);

  subtitle.textContent = "Procurando o Ollama...";
  const { online, hasModel } = await checkOllama();
  const useModel = online && hasModel;
  subtitle.textContent = useModel
    ? "Inventando a palavra secreta, a categoria e as pistas de cada pessoa..."
    : "Ollama indisponível: usando os cenários reservas.";

  const scenarios = await buildScenarios(characters, {
    useModel,
    onProgress: (id, s) => {
      status.set(id, s);
      render();
    },
  });
  clearInterval(tipTimer);

  const fromModel = scenarios.filter((s) => s.source === "ollama").length;
  subtitle.textContent = "Tudo pronto!";
  tip.textContent =
    "Cada pessoa esconde uma palavra secreta (um objeto ou uma opinião política). Peça pistas, descubra a palavra e mencione-a na conversa para levar a pessoa ao café.";
  if (debugMode) {
    console.table(scenarios.map((s) => ({ nome: s.name, nivel: s.difficulty, fonte: s.source, palavra: s.word, categoria: s.category, pistas: s.clues })));
    $("loading-debug").innerHTML = debugHtml(scenarios);
    $("loading-debug").hidden = false;
  }
  root.dataset.ready = "true";
  root.dataset.generated = String(fromModel);

  start.hidden = false;
  start.focus();
  await new Promise((resolve) => {
    const go = () => {
      window.removeEventListener("keydown", onKey);
      resolve();
    };
    const onKey = (e) => {
      if (e.key === "Enter") go();
    };
    start.addEventListener("click", go, { once: true });
    window.addEventListener("keydown", onKey);
  });

  root.classList.add("loading--out");
  setTimeout(() => root.remove(), 500);
  return scenarios;
}
