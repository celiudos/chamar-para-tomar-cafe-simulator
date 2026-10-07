// Cenario da partida: complementa a persona FIXA de cada personagem (personas/*.md) com a parte
// DINAMICA, criada a cada carregamento do jogo (tela de loading):
//   - dificuldade (sorteada, repartida por igual entre a equipe)
//   - palavra secreta que o personagem quer ouvir o chefe mencionar
//   - categoria da palavra ("objeto" ou "política")
//   - pistas contextuais que o personagem deixa escapar na conversa
// E um jogo de adivinhacao (estilo "Imagem e Acao", mas sem mimica): o personagem fala em pistas
// e aceita assim que o chefe menciona a palavra secreta no meio da conversa.
// O Ollama inventa o complemento; se ele estiver fora do ar ou responder algo invalido,
// usa o "cenario pronto" do proprio .md para a mesma dificuldade.
import { game } from "../config/index.js";
import { generateJson } from "./ollama.js";
import { personas } from "./personas.js";

const { difficulty, loading } = game;

/** Categorias validas da palavra secreta. */
export const CATEGORIES = ["objeto", "política"];

export const SCENARIO_FORMAT = {
  type: "object",
  properties: {
    palavra: { type: "string" },
    categoria: { type: "string", enum: CATEGORIES },
    pistas: { type: "string" },
  },
  required: ["palavra", "categoria", "pistas"],
};

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Niveis em rodizio (facil, medio, dificil, facil...) embaralhados: a equipe sempre tem de tudo. */
export function assignDifficulties(count) {
  const { levels } = difficulty;
  return shuffle(Array.from({ length: count }, (_, i) => levels[i % levels.length]));
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1").trim();

/** Normaliza categoria: aceita variacoes ("politica", "opiniao politica"...) e cai em "objeto". */
function normCategory(raw) {
  const c = clean(raw).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (c.includes("polit")) return "política";
  return "objeto";
}

/**
 * Palavra em portugues do Brasil? Rejeita letras fora do alfabeto PT (k/w/y soltas),
 * estrangeirismos comuns de escritorio e marcas. Nao e exaustivo, mas filtra os casos tipicos.
 */
const FOREIGN_WORDS = new Set([
  "post-it", "postit", "mouse", "notebook", "laptop", "desktop", "mousepad", "headset",
  "tablet", "smartphone", "pendrive", "deadline", "feedback", "briefing", "e-mail", "email",
  "software", "hardware", "display", "coffee", "coffee-break", "break", "office", "sticky",
]);
function isPortuguese(word) {
  const w = word.toLowerCase().trim();
  if (FOREIGN_WORDS.has(w)) return false;
  if (w.split(/\s+/).some((t) => FOREIGN_WORDS.has(t))) return false;
  // k, w, y so aparecem em estrangeirismos no portugues; se houver, provavelmente nao e PT-BR.
  if (/[kwy]/i.test(w)) return false;
  // Caracteres fora do portugues (acentos permitidos ja normalizados pelo clean? nao: mantemos).
  if (!/^[a-zà-ú0-9\s-]+$/i.test(w)) return false;
  return true;
}

/** Prompt do gerador. O exemplo (cenario pronto do .md) mostra o formato e o nivel de dificuldade. */
export function buildGeneratorMessages(character, persona, level) {
  const d = difficulty[level];
  const example = persona.scenarios[level];
  const gender = character.gender === "female" ? "feminino" : "masculino";
  const system = [
    "Você cria rodadas para um jogo de adivinhação de escritório bem-humorado, em português do Brasil.",
    'O jogo é parecido com "Imagem e Ação", mas sem mímica: o funcionário quer que o chefe mencione uma PALAVRA SECRETA e vai soltando pistas no diálogo até ele acertar.',
    'A palavra secreta é um "objeto" (uma COISA MATERIAL, concreta, que dá para pegar na mão) OU uma "política" (uma opinião política de esquerda/liberal ou de direita/conservador, dita em 1 a 3 palavras).',
    "Use SEMPRE palavras do português do Brasil. Nada de estrangeirismos, marcas ou termos em inglês (ex.: não use \"post-it\", \"mouse\", \"notebook\"; prefira \"bloco de notas\", \"ratinho do computador\", \"caderno\").",
    'Responda só com JSON: {"palavra": "...", "categoria": "objeto" ou "política", "pistas": "..."}',
  ].join("\n");
  const user = [
    `Funcionário: ${character.name} (${character.role}, gênero ${gender}).`,
    persona.body,
    "",
    `Dificuldade: ${d.label}.`,
    '- "palavra": a palavra secreta que o chefe precisa dizer para acertar. 1 a 3 palavras em português do Brasil, do dia a dia, ligada aos Interesses do funcionário.',
    '  Se for "objeto", tem que ser uma COISA MATERIAL e concreta (dá para tocar), nunca algo abstrato ou digital (não vale "planilha", "ideia", "prazo", "software").',
    '  Se for "política", é uma opinião política curta de esquerda/liberal ou direita/conservador.',
    '- "categoria": "objeto" se a palavra for uma coisa material; "política" se for uma opinião política.',
    `- "pistas": 1 frase curta que o funcionário diz na conversa, levando o chefe à palavra sem NUNCA dizê-la: ${d.cluesGuide}.`,
    "- Nada de termos técnicos rebuscados nem palavras em outro idioma. A palavra tem que ser possível de adivinhar pelas pistas. Invente algo diferente do exemplo.",
    example
      ? `\nExemplo de estilo (invente algo DIFERENTE):\n${JSON.stringify({ palavra: example.word, categoria: example.category, pistas: example.clues })}`
      : "",
  ].join("\n");
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Valida e limpa o JSON do gerador; devolve null se algo estiver faltando ou estranho. */
export function parseGenerated(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  const word = clean(data.palavra);
  const category = normCategory(data.categoria);
  const clues = clean(data.pistas);
  // Palavra de 1 a ~4 palavras; pistas com um minimo de conteudo.
  if (word.length < 2 || word.length > 40 || word.split(/\s+/).length > 4) return null;
  if (clues.length < 8 || clues.length > 300) return null;
  // So aceita palavra em portugues do Brasil (sem estrangeirismos nem marcas).
  if (!isPortuguese(word)) return null;
  return { word, category, clues };
}

/** Pede ao Ollama o complemento de UM personagem (com tentativas e tempo limite). */
async function generateOne(character, persona, level) {
  let lastError;
  for (let attempt = 0; attempt < loading.attempts; attempt++) {
    try {
      const raw = await generateJson({
        messages: buildGeneratorMessages(character, persona, level),
        format: SCENARIO_FORMAT,
        options: { temperature: loading.temperature, num_predict: 400 },
        signal: AbortSignal.timeout(loading.timeoutMs),
      });
      const parsed = parseGenerated(raw);
      if (parsed) return parsed;
      lastError = new Error("resposta invalida do gerador");
    } catch (err) {
      lastError = err;
      if (err instanceof TypeError) break; // sem conexao: nao adianta tentar de novo
    }
  }
  throw lastError;
}

/**
 * Cria o cenario de todos os personagens em paralelo e grava em personas.get(id).scenario.
 * `onProgress(id, status)`: "working" | "done" (gerado pelo modelo) | "fallback" (cenario pronto).
 */
export async function buildScenarios(characters, { useModel = true, onProgress } = {}) {
  const levels = assignDifficulties(characters.length);
  await Promise.all(
    characters.map(async (character, i) => {
      const persona = personas.get(character.id);
      const level = levels[i];
      let scenario = null;
      onProgress?.(character.id, "working");
      if (useModel) {
        try {
          scenario = { ...(await generateOne(character, persona, level)), source: "ollama" };
        } catch (err) {
          console.warn(`[scenario] ${character.name}: usando cenario pronto (${err.message})`);
        }
      }
      if (!scenario) {
        const ready = persona.scenarios[level] ?? Object.values(persona.scenarios)[0];
        scenario = { word: ready.word, category: ready.category, clues: ready.clues, source: "pronto" };
      }
      persona.scenario = { ...scenario, difficulty: level };
      onProgress?.(character.id, scenario.source === "ollama" ? "done" : "fallback");
    }),
  );
  return characters.map((c) => ({ id: c.id, name: c.name, ...personas.get(c.id).scenario }));
}
