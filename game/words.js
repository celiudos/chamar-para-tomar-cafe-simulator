// Comparacao de palavras usada nos dois modos de jogo para decidir o acerto.
// Regra (estilo "Imagem e Acao"): tem que ser a palavra EXATA, aceitando singular ou plural.
// Sinonimo, palavra parecida ou pedaco de outra palavra nao contam.
// Modulo puro (sem DOM/Phaser): roda no navegador e nos testes (node --test).

/** Tira acentos, pontuacao e espacos extras: usado para comparar a palavra secreta com uma fala. */
export function normalizeText(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Formas singulares candidatas de UMA palavra ja normalizada, para o match aceitar singular OU
 * plural nos dois sentidos. Nao e um lematizador: gera algumas possibilidades e o match aceita
 * se qualquer forma de uma bater com qualquer forma da outra.
 * Ex.: "cadeiras"->{cadeira}, "papeis"->{papel}, "canoes"->{canao,cao}, "homens"->{homem}.
 */
function singularForms(w) {
  const forms = new Set([w]);
  if (w.length > 3 && w.endsWith("s")) {
    // plural simples: cadeiras->cadeira, livres->livre, canecas->caneca
    forms.add(w.slice(0, -1));
    // ...oes/...aes/...aos -> ...ao  (canoes->canao, paes->pao, caes->cao)
    if (/(oes|aes|aos)$/.test(w)) forms.add(w.slice(0, -3) + "ao");
    // ...eis/...ais/...ois/...uis -> ...el/al/ol/ul  (papeis->papel, animais->animal)
    if (/(ei|ai|oi|ui)s$/.test(w)) forms.add(w.slice(0, -2) + "l");
    // ...is  (barris->barril, fuzis->fuzil)
    if (w.endsWith("is")) forms.add(w.slice(0, -2) + "il");
    // ...es -> tira "es"  (mares->mar, luzes->luz)  — candidato extra, nao exclusivo
    if (w.endsWith("es")) forms.add(w.slice(0, -2));
    // ...ns -> ...m  (homens->homem, jovens->jovem)
    if (w.endsWith("ns")) forms.add(w.slice(0, -2) + "m");
  }
  return forms;
}

/** Duas palavras (ja normalizadas) sao a mesma a menos de singular/plural? */
export function sameWord(a, b) {
  if (a === b) return true;
  const fa = singularForms(a);
  for (const f of singularForms(b)) if (fa.has(f)) return true;
  return false;
}

/**
 * A fala `message` menciona EXATAMENTE a palavra `word` (aceitando singular ou plural)?
 * - Palavra de um termo: algum token da fala tem que ser a mesma palavra (ou seu singular/plural).
 *   Nao vale pedaco dentro de outra palavra nem palavra parecida.
 * - Expressao (varias palavras): a sequencia tem que aparecer na fala, cada palavra batendo
 *   no singular ou plural.
 */
export function mentionsWord(message, word) {
  const text = normalizeText(message);
  const target = normalizeText(word);
  if (!text || !target) return false;
  const tokens = text.split(" ");
  const targetWords = target.split(" ");
  if (targetWords.length === 1) {
    return tokens.some((t) => sameWord(t, target));
  }
  // Expressao: procura a sequencia completa (palavra a palavra, singular/plural) na fala.
  for (let i = 0; i + targetWords.length <= tokens.length; i++) {
    if (targetWords.every((tw, j) => sameWord(tokens[i + j], tw))) return true;
  }
  return false;
}

/** Dois palpites sao o mesmo (mesmas palavras, a menos de acento/pontuacao/singular/plural)? */
export function sameGuess(a, b) {
  const ta = normalizeText(a).split(" ").filter(Boolean);
  const tb = normalizeText(b).split(" ").filter(Boolean);
  return ta.length > 0 && ta.length === tb.length && ta.every((t, i) => sameWord(t, tb[i]));
}

/** Palavrinhas que nao contam para "ta quente" (artigos, preposicoes...). */
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "um", "uma", "uns", "umas", "e", "ou",
  "em", "no", "na", "nos", "nas", "com", "sem", "por", "para", "pra", "ao", "aos", "mais", "menos",
]);

/**
 * Palpite "quente": nao e a palavra, mas chegou perto:
 * - tem uma palavra importante (4+ letras) em comum com ela ("fone sem fio" ~ "fone de ouvido"), ou
 * - uma palavra do palpite comeca igual a uma da resposta (5+ letras: "grampo" ~ "grampeador").
 */
export function closeGuess(guess, word) {
  if (!normalizeText(guess) || mentionsWord(guess, word)) return false;
  const significant = (s) => normalizeText(s).split(" ").filter((t) => t.length >= 4 && !STOPWORDS.has(t));
  const target = significant(word);
  return significant(guess).some((g) => target.some((t) => sameWord(g, t) || commonPrefix(g, t) >= 5));
}

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
