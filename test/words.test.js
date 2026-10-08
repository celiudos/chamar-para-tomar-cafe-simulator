import { test } from "node:test";
import assert from "node:assert/strict";
import { closeGuess, mentionsWord, normalizeText, sameGuess, sameWord } from "../game/words.js";

test("normalizeText tira acentos, pontuacao e espacos extras", () => {
  assert.equal(normalizeText("  Guarda-Chuva!!  É "), "guarda chuva e");
  assert.equal(normalizeText(null), "");
});

test("sameWord aceita singular e plural", () => {
  for (const [a, b] of [
    ["cadeira", "cadeiras"],
    ["papel", "papeis"],
    ["pao", "paes"],
    ["homem", "homens"],
    ["luz", "luzes"],
    ["barril", "barris"],
  ]) {
    assert.ok(sameWord(a, b), `${a} ~ ${b}`);
    assert.ok(sameWord(b, a), `${b} ~ ${a}`);
  }
  assert.ok(!sameWord("cadeira", "cadeirao"));
});

test("mentionsWord: palavra exata no meio da frase, singular ou plural", () => {
  assert.ok(mentionsWord("Acho que é uma cadeira, né?", "cadeira"));
  assert.ok(mentionsWord("Seriam as CADEIRAS?", "cadeira"));
  assert.ok(mentionsWord("Será o guarda chuva?", "guarda-chuva"));
  assert.ok(mentionsWord("Aposto em fones de ouvido", "fone de ouvido"));
  assert.ok(mentionsWord("é privatização!", "privatizacao"));
  // pedaco de outra palavra, palavra parecida ou expressao incompleta nao contam
  assert.ok(!mentionsWord("cadeirante", "cadeira"));
  assert.ok(!mentionsWord("é um fone", "fone de ouvido"));
  assert.ok(!mentionsWord("", "cadeira"));
});

test("sameGuess compara palpites inteiros", () => {
  assert.ok(sameGuess("Porta-caneta", "porta canetas"));
  assert.ok(sameGuess("Mousepad", "mousepad."));
  assert.ok(!sameGuess("porta caneta", "porta documentos"));
  assert.ok(!sameGuess("bolsa", "bolsa de mão"));
  assert.ok(!sameGuess("", ""));
});

test("closeGuess: chegou perto sem acertar", () => {
  assert.ok(closeGuess("fone", "fone de ouvido"));
  assert.ok(closeGuess("capa de chuva", "guarda-chuva"));
  assert.ok(closeGuess("grampo", "grampeador"));
  assert.ok(closeGuess("armas", "porte de armas"));
  assert.ok(!closeGuess("mochila", "guarda-chuva"));
  assert.ok(!closeGuess("cadeira", "cadeira"), "acerto nao e 'quente'");
  assert.ok(!closeGuess("pasta de papel", "papa"), "palavras curtas nao contam");
});
