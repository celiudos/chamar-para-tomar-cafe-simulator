import { test } from "node:test";
import assert from "node:assert/strict";
import { characters, game } from "../config/index.js";
import { TeamRound } from "../game/teamChat.js";

/** Palco de mentira: registra tudo o que a rodada pediu para a cena. */
function fakeStage(hooks = {}) {
  const calls = [];
  const record = (name) => (...args) => {
    calls.push([name, ...args]);
    return hooks[name]?.(...args);
  };
  return {
    calls,
    meet: async (...a) => record("meet")(...a),
    thinking: record("thinking"),
    say: record("say"),
    bossSay: record("bossSay"),
    release: record("release"),
    celebrate: async (...a) => record("celebrate")(...a),
    lament: record("lament"),
  };
}

const line = (palpite, fala = `Acho que é ${palpite}.`, candidatos = [palpite]) =>
  JSON.stringify({ raciocinio: "pensando", candidatos, palpite, fala });

/** Modelo de mentira: devolve as respostas da fila (string, Error ou funcao) e guarda os pedidos. */
function fakeAsk(queue) {
  const asked = [];
  const ask = async (messages) => {
    asked.push(messages);
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(messages) : next;
  };
  return { ask, asked };
}

const config = { ...game.team, maxConversations: 3, linesPerConversation: 2, revealHintEvery: 2, attempts: 2, extraHintsMax: 2 };
const instant = async () => {};

function makeRound({ queue, stage = fakeStage(), hints = ["Fica na mesa", "Tem rodinhas", "Gira"], word = "cadeira", cfg = config } = {}) {
  const { ask, asked } = fakeAsk(queue);
  const round = new TeamRound({ word, category: "objeto", hints, crew: characters, ask, stage, config: cfg, wait: instant, rng: () => 0.3 });
  return { round, stage, asked };
}

test("a equipe acerta: todos vao ao cafe e o chefe comemora", async () => {
  const { round, stage } = makeRound({ queue: [line("mesa"), line("teclado"), line("cadeiras", "Seriam as cadeiras?")] });
  const ends = [];
  round.on("end", (e) => ends.push(e.status));
  const status = await round.run();

  assert.equal(status, "won");
  assert.deepEqual(ends, ["won"]);
  assert.equal(round.conversations.length, 2);
  assert.equal(round.winner.id, round.conversations[1].ids[0], "quem abriu a 2a conversa acertou");
  assert.deepEqual(round.wrong, ["mesa", "teclado"]);
  assert.equal(round.guessCount, 3);
  assert.deepEqual(stage.calls.find((c) => c[0] === "celebrate"), ["celebrate", round.winner.id]);
  const kinds = round.log.filter((e) => e.type === "boss").map((e) => e.kind);
  assert.deepEqual(kinds, ["start", "wrong", "wrong", "right"]);
  // O palpite vai em destaque no balao.
  assert.deepEqual(stage.calls.find((c) => c[0] === "say").slice(2), ["Acho que é mesa.", { highlight: "mesa" }]);
});

test("ninguem acerta: dicas saem no ritmo certo e a rodada termina sem acerto", async () => {
  let n = 0;
  const { round, stage, asked } = makeRound({ queue: [() => line(`chute${String.fromCharCode(97 + n++)}`)] });
  const status = await round.run();

  assert.equal(status, "lost");
  assert.equal(round.conversations.length, 3);
  assert.equal(round.wrong.length, 6);
  // revealHintEvery = 2: 1 dica nas conversas 1 e 2, a 2a na conversa 3.
  assert.deepEqual(round.hints, ["Fica na mesa", "Tem rodinhas"]);
  assert.deepEqual(round.pendingHints, ["Gira"]);
  assert.doesNotMatch(asked[3][1].content, /Tem rodinhas/);
  assert.match(asked[4][1].content, /Tem rodinhas {2}<- dica NOVA/);
  assert.ok(stage.calls.some((c) => c[0] === "lament"));
  assert.equal(round.log.at(-1).kind, "lost");
  assert.match(round.log.at(-1).text, /"cadeira"/);
  // Os palpites errados vao para os pedidos seguintes.
  assert.match(asked.at(-1)[1].content, /ERRADOS \(não repita\): chutea, chuteb/);
});

test("palpite repetido: pede de novo e, se repetir, usa outro candidato da resposta", async () => {
  const { round, asked } = makeRound({
    queue: [line("mesa"), line("mesa", "Mesa, de novo!", ["mesa", "banco"]), line("mesa", "Mesa!", ["mesa", "banco"]), line("cadeira")],
  });
  await round.run();
  const [first, second] = round.conversations[0].lines;
  assert.equal(first.guess, "mesa");
  assert.equal(second.guess, "banco");
  assert.equal(second.verdict, "wrong");
  assert.match(asked[2][1].content, /"mesa" já foi descartado/);
});

test("resposta invalida duas vezes: fala de reserva, sem palpite", async () => {
  const { round } = makeRound({ queue: ["isso nao e json", "{}", line("cadeira")] });
  await round.run();
  const first = round.conversations[0].lines[0];
  assert.equal(first.verdict, "none");
  assert.equal(first.guess, "");
  assert.equal(round.log.find((e) => e.type === "boss" && e.kind === "none")?.type, "boss");
  assert.equal(round.status, "won");
});

test("acerto no meio da frase tambem conta (mesmo com outro palpite)", async () => {
  const { round } = makeRound({ queue: [line("banco", "Banco? Não, pensando bem, é cadeira.")] });
  await round.run();
  assert.equal(round.status, "won");
  assert.equal(round.conversations[0].lines[0].verdict, "right");
});

test("'ta quente' quando o palpite chega perto", async () => {
  const { round } = makeRound({ word: "fone de ouvido", queue: [line("fone"), line("fone de ouvido")] });
  await round.run();
  assert.equal(round.conversations[0].lines[0].verdict, "close");
  assert.deepEqual(round.close, ["fone"]);
  assert.equal(round.status, "won");
});

test("sem conexao: avisa, tenta de novo e segue a rodada", async () => {
  const { round } = makeRound({ queue: [new TypeError("Failed to fetch"), line("cadeira")] });
  const errors = [];
  round.on("update", (e) => e.type === "error" && errors.push(e.error?.message ?? null));
  await round.run();
  assert.deepEqual(errors, ["Failed to fetch", null]);
  assert.equal(round.status, "won");
  assert.equal(round.error, null);
});

test("dicas extras: validadas, ditas pelo chefe e usadas na proxima fala", async () => {
  let round;
  const stage = fakeStage({
    meet: () => {
      if (round.conversations.length !== 1) return;
      assert.match(round.addHint("Tem cadeiras na sala").error, /palavra secreta/);
      assert.match(round.addHint("   ").error, /Escreva/);
      assert.match(round.addHint("Fica na mesa").error, /já foi dada/);
      assert.ok(round.addHint("Gira e tem encosto").ok);
      assert.ok(round.addHint("Fica embaixo de você").ok);
      assert.match(round.addHint("Mais uma").error, /todas as dicas extras/);
    },
  });
  const made = makeRound({ stage, queue: [line("mesa"), line("cadeira")] });
  round = made.round;
  assert.match(round.addHint("antes").error, /não está em andamento/);
  await round.run();
  assert.equal(round.extraHintsLeft, 0);
  assert.match(made.asked[1][1].content, /Gira e tem encosto/);
  assert.ok(round.log.some((e) => e.type === "boss" && e.text === "Mais uma dica: Gira e tem encosto"));
});

test("encerrar a rodada no meio: para na hora e avisa o fim uma vez", async () => {
  let round;
  const stage = fakeStage({ meet: () => round.stop() });
  round = makeRound({ stage, queue: [line("mesa")] }).round;
  const ends = [];
  round.on("end", (e) => ends.push(e.status));
  const status = await round.run();
  assert.equal(status, "stopped");
  assert.deepEqual(ends, ["stopped"]);
  assert.equal(round.conversations[0].lines.length, 0);
});

test("duplas: todo mundo conversa antes de alguem repetir", async () => {
  let n = 0;
  const { round } = makeRound({ queue: [() => line(`chute${String.fromCharCode(97 + n++)}`)] });
  await round.run();
  const ids = round.conversations.flatMap((c) => c.ids);
  assert.equal(new Set(ids).size, characters.length);
});
