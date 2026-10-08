import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { characters, game } from "../config/index.js";
import { parsePersona } from "../game/personas.js";
import { buildLineMessages, parseLine, personaStyle, validateRound, withFreshCandidate } from "../game/teamPrompt.js";

const bob = characters.find((c) => c.id === "bob");
const dave = characters.find((c) => c.id === "dave");
const bobPersona = parsePersona(readFileSync(new URL("../personas/bob.md", import.meta.url), "utf8"));

test("validateRound aceita uma rodada valida e limpa os campos", () => {
  const r = validateRound({ word: "  Guarda-chuva ", category: "objeto", hints: [" Abre e  fecha ", "", "Dia cinza"] });
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.deepEqual(r.value, { word: "Guarda-chuva", category: "objeto", hints: ["Abre e fecha", "Dia cinza"] });
});

test("validateRound aponta cada problema", () => {
  assert.ok(validateRound({ word: "", category: "objeto", hints: ["x"] }).errors.word);
  assert.ok(validateRound({ word: "a", category: "objeto", hints: ["x"] }).errors.word);
  assert.ok(validateRound({ word: "um dois tres quatro", category: "objeto", hints: ["x"] }).errors.word);
  assert.ok(validateRound({ word: "caneta2", category: "objeto", hints: ["x"] }).errors.word);
  assert.ok(validateRound({ word: "caneta", category: "comida", hints: ["x"] }).errors.category);
  assert.ok(validateRound({ word: "caneta", category: "objeto", hints: ["", " "] }).errors.hints);
  const tooMany = Array.from({ length: game.team.hintsMax + 1 }, (_, i) => `dica ${i}`);
  assert.ok(validateRound({ word: "caneta", category: "objeto", hints: tooMany }).errors.hints);
  // A dica nao pode entregar a palavra (nem no plural)
  const leak = validateRound({ word: "caneta", category: "objeto", hints: ["Escreve", "Tem varias canetas no estojo"] });
  assert.match(leak.errors.hints, /dica 2/);
});

test("personaStyle mantem personalidade e jeito de falar, sem titulo nem interesses", () => {
  const style = personaStyle(bobPersona.body);
  assert.match(style, /## Personalidade/);
  assert.match(style, /## Jeito de falar/);
  assert.doesNotMatch(style, /## Interesses/);
  assert.doesNotMatch(style, /^# Bob/m);
});

test("buildLineMessages monta o prompt com dicas, palpites descartados e a conversa", () => {
  const [system, user] = buildLineMessages({
    speaker: bob,
    listener: dave,
    persona: bobPersona,
    category: "objeto",
    hints: ["Fica na mesa", "Faz clack"],
    lines: [{ name: "Dave", text: "Será um teclado?" }],
    wrong: ["teclado"],
    close: ["grampo"],
    avoid: "teclado",
  });
  assert.equal(system.role, "system");
  assert.match(system.content, /Você é Bob \(Desenvolvedor\)/);
  assert.match(system.content, /OBJETO/);
  assert.match(system.content, /"raciocinio"/);
  assert.match(user.content, /1\. Fica na mesa\n2\. Faz clack {2}<- dica NOVA/);
  assert.match(user.content, /ERRADOS \(não repita\): teclado/);
  assert.match(user.content, /tá quente!.*grampo/);
  assert.match(user.content, /"teclado" já foi descartado/);
  assert.match(user.content, /Dave: "Será um teclado\?"/);
  assert.match(user.content, /Agora responda a Dave/);
  assert.doesNotMatch(user.content, /\n\n\n/);
});

test("buildLineMessages: 1a fala da conversa e categoria politica", () => {
  const [system, user] = buildLineMessages({ speaker: bob, listener: dave, persona: bobPersona, category: "política", hints: ["Liberal adora"] });
  assert.match(system.content, /POLÍTICO/);
  assert.match(user.content, /nenhum ainda/);
  assert.match(user.content, /Você começa a conversa/);
  assert.doesNotMatch(user.content, /dica NOVA/, "com uma dica so, nada de marcar 'nova'");
});

test("parseLine le o JSON, limpa o palpite e garante que a fala diga o palpite", () => {
  const ok = parseLine(JSON.stringify({ raciocinio: "algo de sentar", candidatos: ["a cadeira", "banco"], palpite: "A Cadeira.", fala: "Dave, aposto na cadeira!" }));
  assert.equal(ok.guess, "Cadeira");
  assert.equal(ok.text, "Dave, aposto na cadeira!");
  assert.deepEqual(ok.candidates, ["cadeira", "banco"]);
  assert.equal(ok.reasoning, "algo de sentar");

  const missing = parseLine(JSON.stringify({ palpite: "monitor", fala: "Isso tá difícil." }));
  assert.equal(missing.text, "Isso tá difícil. Será monitor?");

  const cut = parseLine('{"raciocinio": "x", "palpite": "mesa", "fala": "Acho que é mesa');
  assert.equal(cut, null, "fala sem fechar aspas nao e aproveitada");
  assert.equal(parseLine("nada de json"), null);
  assert.equal(parseLine(JSON.stringify({ palpite: "x", fala: "" })), null);

  const long = parseLine(JSON.stringify({ palpite: "mesa", fala: `${"bla ".repeat(80)}mesa` }), 60);
  assert.ok(long.text.length <= 60);
});

test("withFreshCandidate troca o palpite repetido por um candidato novo", () => {
  const line = { guess: "mesa", text: "Acho que é mesa.", candidates: ["mesa", "cadeira", "banco"] };
  const fresh = withFreshCandidate(line, (g) => ["mesa"].includes(g));
  assert.equal(fresh.guess, "cadeira");
  assert.match(fresh.text, /Ou melhor: cadeira!$/);
  assert.equal(withFreshCandidate(line, () => true), null);
});
