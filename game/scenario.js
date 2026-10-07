// Cenario da partida: complementa a persona FIXA de cada personagem (personas/*.md) com a parte
// DINAMICA, criada a cada carregamento do jogo (tela de loading):
//   - dificuldade (sorteada, repartida por igual entre a equipe)
//   - situacao agora
//   - motivo para aceitar o cafe
//   - pistas que o personagem pode dar na conversa
// O Ollama inventa o complemento; se ele estiver fora do ar ou responder algo invalido,
// usa o "cenario pronto" do proprio .md para a mesma dificuldade.
import { game } from "../config/index.js";
import { generateJson } from "./ollama.js";
import { personas } from "./personas.js";

const { difficulty, loading } = game;

export const SCENARIO_FORMAT = {
  type: "object",
  properties: {
    situacao: { type: "string" },
    motivo: { type: "string" },
    pistas: { type: "string" },
  },
  required: ["situacao", "motivo", "pistas"],
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

/** Prompt do gerador. O exemplo (cenario pronto do .md) mostra o formato e o nivel de dificuldade. */
export function buildGeneratorMessages(character, persona, level) {
  const d = difficulty[level];
  const example = persona.scenarios[level];
  const gender = character.gender === "female" ? "feminino" : "masculino";
  const system = [
    "Você cria cenários para um jogo de escritório bem-humorado, em português do Brasil.",
    "No jogo, o chefe tenta convencer um funcionário a ir tomar café.",
    "Você inventa a situação atual do funcionário, o motivo que o faria aceitar o café e as pistas que ele deixa escapar na conversa.",
    'Responda só com JSON: {"situacao": "...", "motivo": "...", "pistas": "..."}',
  ].join("\n");
  const user = [
    `Funcionário: ${character.name} (${character.role}, gênero ${gender}).`,
    persona.body,
    "",
    `Dificuldade: ${d.label}.`,
    '- "situacao": o que a pessoa está fazendo agora e por que está presa à mesa (1 frase curta, em 3ª pessoa, ligada aos Interesses).',
    `- "motivo": a condição para aceitar o café; algo simples que o chefe cumpre só conversando, girando em torno de UM dos Interesses. Comece com "${character.name} só aceita ir tomar café se". Máximo 2 frases, linguagem do dia a dia. Peça ${d.motiveGuide} Convite comum, insistência, ordem ou suborno nunca bastam.`,
    `- "pistas": 1 frase curta que a pessoa diz na conversa sem entregar o motivo: ${d.cluesGuide}.`,
    "- Nada de termos técnicos rebuscados nem exigências absurdas. Invente algo diferente do exemplo.",
    example
      ? `\nExemplo de estilo (invente algo DIFERENTE):\n${JSON.stringify({ situacao: example.situation, motivo: example.reason, pistas: example.clues })}`
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
  const situation = clean(data.situacao);
  const reason = clean(data.motivo);
  const clues = clean(data.pistas);
  if (situation.length < 15 || reason.length < 30 || clues.length < 8) return null;
  if (situation.length > 400 || reason.length > 500 || clues.length > 300) return null;
  return { situation, reason, clues };
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
        scenario = { situation: ready.situation, reason: ready.reason, clues: ready.clues, source: "pronto" };
      }
      persona.scenario = { ...scenario, difficulty: level };
      onProgress?.(character.id, scenario.source === "ollama" ? "done" : "fallback");
    }),
  );
  return characters.map((c) => ({ id: c.id, name: c.name, ...personas.get(c.id).scenario }));
}
