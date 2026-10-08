// Modo "Equipe adivinha": textos para o modelo e validacao dos dados.
// O jogador (chefe) define a palavra secreta, a categoria e as dicas; cada fala de um funcionario
// e um pedido ao Ollama que devolve { palpite, fala } em JSON. Modulo puro (testado com node --test).
import { game } from "../config/index.js";
import { mentionsWord, normalizeText } from "./words.js";

const cfg = game.team;

/** Categorias da palavra (as mesmas do modo classico). */
export const TEAM_CATEGORIES = ["objeto", "política"];

/** Como cada categoria e descrita para a equipe (e anunciada pelo chefe). */
export const CATEGORY_TEXT = {
  objeto: "um OBJETO (uma coisa material e concreta, que dá para pegar na mão)",
  política: "um termo POLÍTICO curto (uma ideia, proposta, medida ou bandeira política, de esquerda/liberal ou de direita/conservador)",
};
export const CATEGORY_LABEL = { objeto: "um objeto", política: "uma opinião política" };

/**
 * Esquema da fala. A ordem importa no gemma4:e2b: primeiro um raciocinio curto sobre as dicas e uma
 * lista de candidatos (o modelo "pensa" antes de chutar: nos testes, sem isso ele chutava "chave
 * inglesa" para "você passa o dia em cima dela"), depois o palpite e por ultimo a fala.
 * Bem mais rapido que o modo `think` do Gemma 4 (~1 s contra ~4,5 s) e acertou mais.
 */
export const LINE_FORMAT = {
  type: "object",
  properties: {
    raciocinio: { type: "string" },
    candidatos: { type: "array", items: { type: "string" } },
    palpite: { type: "string" },
    fala: { type: "string" },
  },
  required: ["raciocinio", "candidatos", "palpite", "fala"],
};

const clean = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .trim();

/**
 * Valida o formulario da rodada. Retorna { ok, errors, value }:
 * - errors: { word?, category?, hints? } com a mensagem de cada campo
 * - value: { word, category, hints } ja limpos (dicas vazias saem da lista)
 */
export function validateRound({ word, category, hints } = {}) {
  const errors = {};
  const w = clean(word);
  const words = w ? w.split(" ") : [];
  if (!w) errors.word = "Escreva a palavra secreta.";
  else if (w.length < 2) errors.word = "A palavra precisa ter pelo menos 2 letras.";
  else if (w.length > cfg.wordMaxChars) errors.word = `Use no máximo ${cfg.wordMaxChars} caracteres.`;
  else if (words.length > cfg.wordMaxWords) errors.word = `Use no máximo ${cfg.wordMaxWords} palavras.`;
  else if (!/^[\p{L}\s-]+$/u.test(w)) errors.word = "Use só letras (sem números ou símbolos).";

  const cat = TEAM_CATEGORIES.includes(category) ? category : null;
  if (!cat) errors.category = "Escolha a categoria.";

  const list = (Array.isArray(hints) ? hints : []).map(clean).filter(Boolean);
  if (!list.length) errors.hints = "Escreva pelo menos uma dica.";
  else if (list.length > cfg.hintsMax) errors.hints = `Use no máximo ${cfg.hintsMax} dicas.`;
  else if (list.some((h) => h.length > cfg.hintMaxChars)) errors.hints = `Cada dica pode ter até ${cfg.hintMaxChars} caracteres.`;
  else if (w && !errors.word) {
    const leak = list.findIndex((h) => mentionsWord(h, w));
    if (leak >= 0) errors.hints = `A dica ${leak + 1} entrega a palavra: tire "${w}" dela.`;
  }

  return { ok: Object.keys(errors).length === 0, errors, value: { word: w, category: cat, hints: list } };
}

/**
 * Parte da persona que interessa na conversa: personalidade e jeito de falar.
 * Sai o titulo e os "Interesses" (puxariam os palpites para longe das dicas).
 */
export function personaStyle(body) {
  return String(body ?? "")
    .replace(/^# .*$/m, "")
    .replace(/^## Interesses[\s\S]*?(?=^## |$(?![\s\S]))/m, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Rotulo "Nome (Profissao)". */
const who = (c) => `${c.name} (${c.role})`;

/**
 * Mensagens para UMA fala de `speaker` conversando com `listener`.
 * - hints: dicas ja reveladas pelo chefe
 * - lines: falas desta conversa ate agora [{ name, text }]
 * - wrong: palpites que o chefe ja descartou (de toda a equipe)
 * - close: palpites em que o chefe disse "ta quente"
 * - avoid: palpite que acabou de sair repetido (2a tentativa)
 */
export function buildLineMessages({ speaker, listener, persona, category, hints, lines = [], wrong = [], close = [], avoid = "" }) {
  const style = personaStyle(persona?.body);
  const system = [
    `Você é ${who(speaker)} e está em pé, andando pelo escritório, batendo papo com ${who(listener)}.`,
    "O chefe pensou numa palavra secreta e só libera o café quando a equipe adivinhar. É como o jogo Imagem e Ação, mas sem mímica: o chefe dá dicas e vocês conversam entre si até alguém dizer a palavra exata.",
    style ? `\n## Seu jeito\n${style}\n` : "",
    "## Regras",
    `- A palavra secreta é ${CATEGORY_TEXT[category] ?? CATEGORY_TEXT.objeto}.`,
    "- O palpite é a coisa que as dicas DESCREVEM (não algo só relacionado a ela). Pense nas dicas JUNTAS: tem que combinar com todas ao mesmo tempo.",
    '- Nas dicas, "você" é qualquer pessoa (quem usa ou convive com a coisa), não você especificamente.',
    '- "raciocinio": 1 frase curta em que você explica para si mesmo o que as dicas descrevem (ex.: "algo em que a pessoa senta o dia todo e que tem rodinhas").',
    '- "candidatos": 3 palavras diferentes que combinam com o raciocínio e com todas as dicas, fora das já descartadas.',
    '- "palpite": o melhor dos candidatos, escrito por inteiro como se fala (ex.: "bloco de notas", "fone de ouvido"), de 1 a 3 palavras em português do Brasil, sem artigo no começo e sem explicação. Nunca repita um palpite já descartado.',
    "- Só o chefe sabe a palavra: nunca diga que o palpite de um colega está certo ou errado; comente e dê o seu.",
    `- "fala": no máximo 2 frases curtas (até 25 palavras), em primeira pessoa, falando com ${listener.name}, com humor de escritório no seu estilo. Diga o palpite dentro da fala.`,
    "- Fale só português do Brasil. Não invente dicas novas.",
    'Responda só com JSON: {"raciocinio": "...", "candidatos": ["...", "...", "..."], "palpite": "...", "fala": "..."}',
  ].join("\n");

  const transcript = lines.slice(-cfg.historyLines).map((l) => `${l.name}: "${l.text}"`);
  const last = lines.at(-1);
  const turn = last
    ? `Agora responda a ${last.name}: comente o palpite dele(a) e dê o SEU palpite, diferente.`
    : `Você começa a conversa: puxe papo com ${listener.name} sobre as dicas e dê o seu palpite.`;
  // A dica mais nova vem marcada: sem isso o modelo fica preso na 1a dica e repete a mesma linha.
  const hintLines = hints.map((h, i) => `${i + 1}. ${h}${hints.length > 1 && i === hints.length - 1 ? "  <- dica NOVA: comece por ela" : ""}`);
  const user = [
    `A palavra é ${CATEGORY_LABEL[category] ?? CATEGORY_LABEL.objeto}.`,
    "Dicas do chefe:",
    ...hintLines,
    "",
    `Palpites que o chefe já disse que estão ERRADOS (não repita): ${wrong.length ? wrong.join(", ") : "nenhum ainda"}.`,
    wrong.length >= 4 ? "Muitos palpites parecidos já erraram: mude de linha de raciocínio e pense em outro tipo de coisa." : "",
    close.length ? `Palpites em que o chefe disse "tá quente!" (chegaram perto, mas não é exatamente isso): ${close.join(", ")}.` : "",
    avoid ? `Atenção: "${avoid}" já foi descartado. Escolha OUTRO palpite.` : "",
    "",
    transcript.length ? `Conversa até agora:\n${transcript.join("\n")}` : "",
    turn,
  ]
    .filter((l, i, a) => l !== "" || a[i - 1] !== "")
    .join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

/** Corta o texto no limite, de preferencia no fim de uma frase. */
function truncate(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, max - 3).trimEnd()}...`;
}

/** Limpa um palpite: sem aspas/pontuacao nas pontas nem artigo no comeco; "" se nao parecer palavra. */
function cleanGuess(raw) {
  const g = clean(raw)
    .replace(/^["'“”«»]+|["'“”«».!?,;:]+$/g, "")
    .replace(/^(o|a|os|as|um|uma)\s+/i, "")
    .trim();
  return g.length > cfg.wordMaxChars || g.split(" ").length > 4 ? "" : g;
}

/**
 * Le { guess, text, candidates, reasoning } do JSON do modelo; null se nao der para aproveitar.
 * Se a fala nao mencionar o palpite, o palpite entra no fim, para o balao mostrar o chute.
 */
export function parseLine(raw, maxChars = cfg.maxLineChars) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    const g = /"palpite"\s*:\s*"([^"]*)"/.exec(raw);
    const f = /"fala"\s*:\s*"([^"]*)"/.exec(raw);
    if (!f) return null;
    data = { palpite: g?.[1] ?? "", fala: f[1] };
  }
  if (!data || typeof data !== "object") return null;
  const guess = cleanGuess(data.palpite);
  const candidates = (Array.isArray(data.candidatos) ? data.candidatos : []).map(cleanGuess).filter(Boolean);
  let text = clean(data.fala);
  if (!text) return null;
  if (guess && !mentionsWord(text, guess)) text = `${text.replace(/[.!]*$/, "")}. Será ${guess}?`;
  return { guess, text: truncate(text, maxChars), candidates, reasoning: clean(data.raciocinio) };
}

/**
 * Troca o palpite repetido por um candidato novo da mesma resposta (quando as tentativas acabam).
 * `isUsed(g)` diz se o palpite ja foi descartado. Retorna a linha ajustada ou null se nao houver.
 */
export function withFreshCandidate(line, isUsed, maxChars = cfg.maxLineChars) {
  const fresh = line.candidates?.find((c) => !isUsed(c));
  if (!fresh) return null;
  return { ...line, guess: fresh, text: truncate(`${line.text.replace(/[.!?]*$/, "")}... Ou melhor: ${fresh}!`, maxChars) };
}

/** Palpite ja normalizado, para mostrar e comparar (minusculas, sem pontuacao, com acentos). */
export const displayGuess = (g) => clean(g).toLowerCase();

/** Chave para comparar palpites (sem acentos). */
export const guessKey = (g) => normalizeText(g);
