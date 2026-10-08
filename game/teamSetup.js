// Modo "Equipe adivinha": formulario da rodada na tela inicial.
// O jogador escolhe a palavra secreta, a categoria e as dicas (validacao em game/teamPrompt.js).
// Enquanto ele digita, o Ollama e verificado e o modelo ja e carregado: sem o modelo a equipe
// nao consegue conversar, entao o botao so libera com o Ollama pronto.
import { game } from "../config/index.js";
import { checkOllama, warmUp } from "./ollama.js";
import { esc, MODEL } from "./hud.js";
import { restartIn } from "./modes.js";
import { TEAM_CATEGORIES, validateRound } from "./teamPrompt.js";

const cfg = game.team;
const CATEGORY_NAMES = { objeto: "Objeto", política: "Opinião política" };

/** Quando cada dica do formulario sai (texto de ajuda). */
function hintWhen(i) {
  if (i === 0) return "sai no começo";
  return `depois de ${i * cfg.revealHintEvery} conversas`;
}

function formHtml() {
  const ph = cfg.placeholders;
  const hints = Array.from({ length: cfg.hintsMax }, (_, i) => {
    const optional = i > 0 ? " (opcional)" : "";
    return `<div class="team-setup__hint">
        <label for="team-hint-${i}">Dica ${i + 1}${optional}<small>${esc(hintWhen(i))}</small></label>
        <input id="team-hint-${i}" class="pixel-input team-setup__input" maxlength="${cfg.hintMaxChars}" autocomplete="off"
          placeholder="ex.: ${esc(ph.hints[i] ?? "")}" aria-describedby="team-hints-help team-hints-error" />
      </div>`;
  }).join("");
  const categories = TEAM_CATEGORIES.map(
    (c, i) => `<label class="team-setup__radio"><input type="radio" name="team-category" value="${esc(c)}" ${i === 0 ? "checked" : ""} /> ${esc(CATEGORY_NAMES[c] ?? c)}</label>`,
  ).join("");

  return `<form class="team-setup" id="team-form" novalidate>
      <p class="team-setup__intro">Você pensa na palavra e dá as dicas. A equipe sai andando pelo escritório e conversa em duplas, chutando palpites, até alguém dizer a palavra: aí todo mundo vai tomar café.</p>

      <div class="team-setup__field">
        <label class="team-setup__label" for="team-word">Palavra secreta</label>
        <div class="team-setup__row">
          <input id="team-word" class="pixel-input team-setup__input" maxlength="${cfg.wordMaxChars}" autocomplete="off" spellcheck="false"
            placeholder="ex.: ${esc(ph.word)}" aria-describedby="team-word-help team-word-error" />
          <button type="button" class="pixel-button" id="team-example">Sortear exemplo</button>
        </div>
        <small class="team-setup__help" id="team-word-help">1 a ${cfg.wordMaxWords} palavras. A equipe acerta se disser a palavra exata, no singular ou no plural.</small>
        <span class="team-setup__error" id="team-word-error" role="alert"></span>
      </div>

      <fieldset class="team-setup__field team-setup__fieldset" aria-describedby="team-category-error">
        <legend class="team-setup__label">Categoria</legend>
        <div class="team-setup__radios">${categories}</div>
        <span class="team-setup__error" id="team-category-error" role="alert"></span>
      </fieldset>

      <div class="team-setup__field">
        <span class="team-setup__label">Dicas</span>
        ${hints}
        <small class="team-setup__help" id="team-hints-help">As dicas não podem conter a palavra. Durante a rodada você ainda pode dar até ${cfg.extraHintsMax} dicas extras. A equipe tem ${cfg.maxConversations} conversas para acertar.</small>
        <span class="team-setup__error" id="team-hints-error" role="alert"></span>
      </div>

      <div class="team-setup__status" id="team-ollama" aria-live="polite"></div>

      <div class="team-setup__actions">
        <button type="button" class="pixel-button" id="team-back">Voltar</button>
        <button type="submit" class="pixel-button pixel-button--primary" id="team-start" disabled>Começar rodada</button>
      </div>
    </form>`;
}

/**
 * Mostra o formulario e resolve com { word, category, hints } quando o jogador comeca a rodada.
 * A tela inicial some sozinha depois do "Comecar rodada".
 */
export function runTeamSetup() {
  const root = document.getElementById("loading");
  const box = document.getElementById("loading-team");
  const subtitle = document.getElementById("loading-subtitle");
  subtitle.textContent = "Equipe adivinha: escolha a palavra e as dicas";
  box.innerHTML = formHtml();
  box.hidden = false;

  const $ = (id) => document.getElementById(id);
  const form = $("team-form");
  const start = $("team-start");
  const status = $("team-ollama");
  const hintInputs = Array.from({ length: cfg.hintsMax }, (_, i) => $(`team-hint-${i}`));
  let ollamaReady = false;

  // O Phaser escuta o teclado na janela: digitar aqui nao pode mover o chefe la atras.
  for (const type of ["keydown", "keyup"]) form.addEventListener(type, (e) => e.stopPropagation());
  $("team-word").focus();

  function renderStatus(state, detail = "") {
    const text = {
      checking: "Procurando o Ollama...",
      loading: `Carregando o modelo ${MODEL}...`,
      ready: `Ollama pronto (${MODEL}).`,
      missing: `O Ollama está no ar, mas sem o modelo. Rode "ollama pull ${MODEL}".`,
      offline: "Ollama não encontrado. Sem ele a equipe não consegue conversar: abra o Ollama (ou rode \"ollama serve\").",
    }[state];
    const dot = { checking: "gray", loading: "yellow", ready: "green", missing: "yellow", offline: "red" }[state];
    const retry = state === "missing" || state === "offline" ? '<button type="button" class="pixel-button" id="team-retry">Verificar de novo</button>' : "";
    status.innerHTML = `<span class="pixel-dot pixel-dot--${dot}" aria-hidden="true"></span><span>${esc(text)}${detail ? ` <small>${esc(detail)}</small>` : ""}</span>${retry}`;
    $("team-retry")?.addEventListener("click", connect);
    ollamaReady = state === "ready" || state === "loading";
    start.disabled = !ollamaReady;
  }

  async function connect() {
    renderStatus("checking");
    const { online, hasModel, error } = await checkOllama();
    if (!online) return renderStatus("offline", error);
    if (!hasModel) return renderStatus("missing");
    // Ja da para comecar; o 1o pedido so espera o modelo terminar de carregar.
    renderStatus("loading");
    try {
      await warmUp();
      renderStatus("ready");
    } catch (err) {
      renderStatus("offline", err.message);
    }
  }
  connect();

  $("team-example").addEventListener("click", () => {
    const current = $("team-word").value.trim().toLowerCase();
    const options = cfg.examples.filter((ex) => ex.word !== current);
    const ex = options[Math.floor(Math.random() * options.length)] ?? cfg.examples[0];
    $("team-word").value = ex.word;
    form.querySelector(`input[name="team-category"][value="${ex.category}"]`).checked = true;
    hintInputs.forEach((input, i) => (input.value = ex.hints[i] ?? ""));
    clearErrors();
  });
  $("team-back").addEventListener("click", () => restartIn(null));

  function clearErrors() {
    for (const key of ["word", "category", "hints"]) $(`team-${key}-error`).textContent = "";
    for (const input of [$("team-word"), ...hintInputs]) input.removeAttribute("aria-invalid");
  }

  function showErrors(errors) {
    clearErrors();
    for (const [key, message] of Object.entries(errors)) $(`team-${key}-error`).textContent = message;
    if (errors.word) $("team-word").setAttribute("aria-invalid", "true");
    if (errors.hints) {
      const bad = errors.hints.match(/dica (\d+)/i);
      const targets = bad ? [hintInputs[Number(bad[1]) - 1]] : hintInputs.filter((i) => !i.value.trim()).slice(0, 1);
      targets.forEach((i) => i?.setAttribute("aria-invalid", "true"));
    }
    (errors.word ? $("team-word") : form.querySelector('[aria-invalid="true"]'))?.focus();
  }

  return new Promise((resolve) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!ollamaReady) return;
      const result = validateRound({
        word: $("team-word").value,
        category: form.querySelector('input[name="team-category"]:checked')?.value,
        hints: hintInputs.map((i) => i.value),
      });
      if (!result.ok) return showErrors(result.errors);
      root.classList.add("loading--out");
      setTimeout(() => root.remove(), 500);
      resolve(result.value);
    });
  });
}
