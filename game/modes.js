// Modos de jogo (config/game.js -> modes) e tela de escolha do modo.
// `?modo=classico` ou `?modo=equipe` na URL pula a escolha (usado tambem pelo "Jogar de novo").
import { game, characters } from "../config/index.js";
import { esc, portrait, spritePath } from "./hud.js";

/** Modo pedido na URL (`?modo=...`), ou null. Aceita o `id` ou o `url` do modo. */
export function modeFromUrl() {
  const wanted = new URLSearchParams(location.search).get("modo");
  if (!wanted) return null;
  return game.modes.find((m) => m.url === wanted || m.id === wanted)?.id ?? null;
}

/** Recarrega o jogo no modo `id` (ou na tela de escolha, sem `id`), mantendo o `?debug`. */
export function restartIn(id) {
  const params = new URLSearchParams(location.search);
  const mode = game.modes.find((m) => m.id === id);
  if (mode) params.set("modo", mode.url);
  else params.delete("modo");
  const query = params.toString().replace(/=(&|$)/g, "$1");
  location.href = `${location.pathname}${query ? `?${query}` : ""}`;
}

/** Ilustracao de cada modo: retratos da equipe. */
function cast(id) {
  const crew = id === "team" ? characters.slice(0, 4) : characters.slice(0, 1);
  return crew.map((c) => `<span class="mode-card__face">${portrait(spritePath(c), 0.9)}</span>`).join("");
}

/** Mostra a escolha do modo no card da tela inicial. Resolve com o `id` escolhido. */
export function chooseMode() {
  const fromUrl = modeFromUrl();
  if (fromUrl) return Promise.resolve(fromUrl);

  const box = document.getElementById("loading-modes");
  const subtitle = document.getElementById("loading-subtitle");
  subtitle.textContent = "Escolha o modo de jogo";
  box.innerHTML = game.modes
    .map(
      (m, i) => `<button type="button" class="mode-card" data-mode="${esc(m.id)}" aria-describedby="mode-desc-${i}">
        <span class="mode-card__cast" aria-hidden="true">${cast(m.id)}</span>
        <span class="mode-card__label">${esc(m.label)}</span>
        <span class="mode-card__desc" id="mode-desc-${i}">${esc(m.description)}</span>
      </button>`,
    )
    .join("");
  box.hidden = false;
  box.querySelector(".mode-card")?.focus();

  return new Promise((resolve) => {
    box.addEventListener("click", (e) => {
      const id = e.target.closest("[data-mode]")?.dataset.mode;
      if (!id) return;
      box.hidden = true;
      box.innerHTML = "";
      resolve(id);
    });
  });
}
