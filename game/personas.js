// Personas dos personagens: um arquivo Markdown por personagem em /personas.
//
// A parte FIXA da persona (personalidade e jeito de falar; profissao e genero vem de
// config/characters.js) fica no .md. A parte DINAMICA (palavra secreta, categoria e pistas)
// e criada a cada carregamento do jogo em game/scenario.js; os "Cenarios prontos" do .md
// (um por dificuldade) servem de exemplo para o gerador e de reserva sem o Ollama.
//
// Formato (ver personas/README.md):
//   ---
//   dica: resumo publico mostrado no HUD (Employees)
//   ---
//   # Nome
//   ## Personalidade
//   ## Jeito de falar
//   ## Cenários prontos
//   ### Fácil: titulo
//   - Palavra: ...
//   - Categoria: objeto | política
//   - Pistas: ...
import { game } from "../config/index.js";

/** persona por id do personagem, preenchido por loadPersonas(). */
export const personas = new Map();

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/** "Fácil" -> "easy" (pelos rotulos de config/game.js -> difficulty). */
function levelFromLabel(label) {
  return game.difficulty.levels.find((id) => norm(game.difficulty[id].label) === norm(label));
}

/** "política"/"objeto" normalizados; qualquer coisa com "polit" vira "política", o resto "objeto". */
function normCategory(raw) {
  return norm(raw).includes("polit") ? "política" : "objeto";
}

/** Le os blocos "### Nivel: titulo" com os itens "- Palavra/Categoria/Pistas: texto". */
function parseScenarios(text) {
  const scenarios = {};
  for (const block of text.split(/^### /m).slice(1)) {
    const [heading, ...lines] = block.split("\n");
    const [label, ...title] = heading.split(":");
    const level = levelFromLabel(label);
    if (!level) continue;
    const field = (name) => {
      const re = new RegExp(`^-\\s*${name}\\s*:\\s*(.+)$`, "im");
      return re.exec(lines.join("\n"))?.[1].trim() ?? "";
    };
    const scenario = {
      title: title.join(":").trim(),
      word: field("Palavra"),
      category: normCategory(field("Categoria")),
      clues: field("Pistas"),
    };
    if (scenario.word && scenario.clues) scenarios[level] = scenario;
  }
  return scenarios;
}

/** Separa o cabecalho `chave: valor` (entre linhas ---) do corpo Markdown. */
export function parsePersona(markdown) {
  const text = markdown.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const meta = {};
  let body = text;
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (fm) {
    body = text.slice(fm[0].length);
    for (const line of fm[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  // Tudo antes de "## Cenários prontos" e a parte fixa; o resto sao os cenarios.
  const cut = body.search(/^## Cen[aá]rios/im);
  const fixed = cut >= 0 ? body.slice(0, cut) : body;
  return {
    hint: meta.dica ?? "",
    body: fixed.trim(),
    scenarios: cut >= 0 ? parseScenarios(body.slice(cut)) : {},
    /** Cenario da partida atual (palavra, categoria, pistas, dificuldade): preenchido em game/scenario.js. */
    scenario: null,
  };
}

/** Persona minima, usada quando o .md nao carrega. */
function fallbackPersona(c) {
  const p = parsePersona(`# ${c.name}\n\n## Personalidade\n${c.name} é ${c.role} e adora um jogo de adivinhação.`);
  p.scenarios = Object.fromEntries(
    game.difficulty.levels.map((level) => [
      level,
      {
        title: "",
        word: "cafézinho",
        category: "objeto",
        clues: "Comenta que está morrendo de vontade de uma pausa com aquela bebida quentinha.",
      },
    ]),
  );
  return p;
}

/** Carrega a persona de cada personagem (config/characters.js -> persona). */
export async function loadPersonas(characters) {
  await Promise.all(
    characters.map(async (c) => {
      const url = `${game.chat.personasPath}/${c.persona ?? c.id}.md`;
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        personas.set(c.id, parsePersona(await res.text()));
      } catch (err) {
        console.warn(`[personas] Nao foi possivel carregar ${url}: ${err.message}`);
        personas.set(c.id, fallbackPersona(c));
      }
    }),
  );
  return personas;
}
