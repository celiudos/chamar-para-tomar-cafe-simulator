// Rodada do modo "Equipe adivinha".
//
// O chefe (jogador) escolheu a palavra secreta, a categoria e as dicas. A equipe conversa em duplas:
// a cada conversa, dois funcionarios se encontram e trocam algumas falas, e cada fala traz um palpite.
// O chefe reage a cada palpite ("errado!", "ta quente!"); a primeira dica sai no comeco e as outras
// a cada `revealHintEvery` conversas (o jogador ainda pode dar dicas extras pelo HUD). Se alguem
// disser a palavra exata (singular ou plural, game/words.js), todos vao tomar cafe; se as conversas
// acabarem antes, a rodada termina sem acerto.
//
// Modulo sem DOM/Phaser: a cena entra como `stage` (ver game/TeamScene.js) e o modelo como `ask`
// (messages -> texto JSON), assim a rodada inteira roda nos testes com dublês.
import { game } from "../config/index.js";
import { CATEGORY_LABEL, buildLineMessages, displayGuess, parseLine, withFreshCandidate } from "./teamPrompt.js";
import { closeGuess, mentionsWord, sameGuess } from "./words.js";

/** Resultado de cada fala: acertou, quente, errado, palpite repetido ou sem palpite. */
export const VERDICTS = ["right", "close", "wrong", "repeat", "none"];

/** Falas de reserva quando o modelo nao devolve nada aproveitavel. */
const FILLERS = ["Hmm... deixa eu pensar mais um pouco.", "Travei. Me dá um segundo que já vem um palpite.", "Essa tá difícil, viu?"];

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

/** Espera `ms` (ou ate `signal` abortar). */
export function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true },
    );
  });
}

class Aborted extends Error {}

export class TeamRound {
  /**
   * @param {object} o
   * @param {string} o.word        palavra secreta
   * @param {string} o.category    "objeto" | "política"
   * @param {string[]} o.hints     dicas do formulario (na ordem em que serao reveladas)
   * @param {object[]} o.crew      funcionarios (config/characters.js)
   * @param {Map} o.personas       personas por id (game/personas.js)
   * @param {(messages, {signal}) => Promise<string>} o.ask  chama o modelo e devolve o JSON da fala
   * @param {object} o.stage       palco da cena (TeamScene)
   */
  constructor({ word, category, hints, crew, personas = new Map(), ask, stage, config = game.team, rng = Math.random, wait = sleep, now = () => Date.now() }) {
    this.word = word;
    this.category = category;
    this.crew = crew;
    this.personas = personas;
    this.ask = ask;
    this.stage = stage;
    this.cfg = config;
    this.rng = rng;
    this.wait = wait;
    this.now = now;

    /** Dicas ja ditas pelo chefe, na ordem. */
    this.hints = [];
    /** Dicas do formulario que ainda nao foram ditas. */
    this.pendingHints = [...hints];
    this.formHints = hints.length;
    this.extraHints = 0;
    /** Conversas: { index, ids: [a, b], lines: [{ speakerId, name, text, guess, verdict, ... }] } */
    this.conversations = [];
    /** Mural do chefe: palpites errados e quentes (como foram ditos). */
    this.wrong = [];
    this.close = [];
    /** Linha do tempo para o HUD: falas da equipe e do chefe na ordem em que aconteceram. */
    this.log = [];
    /** ready | running | won | lost | stopped */
    this.status = "ready";
    this.winner = null;
    /** Quem esta conversando / pensando agora (para o HUD). */
    this.talking = [];
    this.thinkingId = null;
    /** Ultimo erro de conexao com o modelo (a rodada tenta de novo sozinha). */
    this.error = null;
    this.startedAt = null;
    this.endedAt = null;

    this.talkCount = new Map(crew.map((c) => [c.id, 0]));
    this.lastPair = [];
    this.controller = new AbortController();
    this.listeners = new Map();
  }

  // ── Eventos: "update" (qualquer mudanca), "line", "boss", "end" ──
  on(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
    return () => this.listeners.get(name)?.delete(fn);
  }

  emit(name, detail) {
    for (const fn of this.listeners.get(name) ?? []) fn(detail);
    if (name !== "update") for (const fn of this.listeners.get("update") ?? []) fn({ type: name, detail });
  }

  get running() {
    return this.status === "running";
  }

  get finished() {
    return ["won", "lost", "stopped"].includes(this.status);
  }

  /** Quantos palpites a equipe ja deu. */
  get guessCount() {
    return this.conversations.reduce((n, c) => n + c.lines.filter((l) => l.guess).length, 0);
  }

  /** Quantas dicas extras o jogador ainda pode dar. */
  get extraHintsLeft() {
    return Math.max(0, this.cfg.extraHintsMax - this.extraHints);
  }

  /** O palpite ja foi descartado pelo chefe (errado ou quente)? */
  isUsed(guess) {
    return [...this.wrong, ...this.close].some((w) => sameGuess(w, guess));
  }

  /** A fala diz a palavra secreta (no palpite ou no meio da frase)? */
  hits(line) {
    return mentionsWord(line.text, this.word) || (line.guess ? mentionsWord(line.guess, this.word) : false);
  }

  judge(line) {
    if (this.hits(line)) return "right";
    if (!line.guess) return "none";
    if (this.isUsed(line.guess)) return "repeat";
    if (closeGuess(line.guess, this.word)) return "close";
    return "wrong";
  }

  /** Fala do chefe: balao na cena + linha do tempo. */
  boss(text, kind) {
    const entry = { type: "boss", text, kind, at: this.now() };
    this.log.push(entry);
    this.stage.bossSay(text, kind);
    this.emit("boss", entry);
  }

  /**
   * Dica extra durante a rodada (pelo HUD). Sai na hora, vale para as proximas falas.
   * Retorna { ok, error }.
   */
  addHint(raw) {
    const text = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!this.running) return { ok: false, error: "A rodada não está em andamento." };
    if (!text) return { ok: false, error: "Escreva a dica." };
    if (text.length > this.cfg.hintMaxChars) return { ok: false, error: `Use até ${this.cfg.hintMaxChars} caracteres.` };
    if (this.extraHintsLeft <= 0) return { ok: false, error: "Você já deu todas as dicas extras." };
    if (mentionsWord(text, this.word)) return { ok: false, error: "A dica não pode conter a palavra secreta." };
    if (this.hints.some((h) => h.toLowerCase() === text.toLowerCase())) return { ok: false, error: "Essa dica já foi dada." };
    this.extraHints++;
    this.hints.push(text);
    this.boss(`Mais uma dica: ${text}`, "hint");
    return { ok: true };
  }

  /** Encerra a rodada antes da hora (botao do HUD). */
  stop() {
    if (!this.running) return;
    this.status = "stopped";
    this.endedAt = this.now();
    this.talking = [];
    this.thinkingId = null;
    this.controller.abort();
    this.emit("end", { status: this.status });
  }

  /** Roda a rodada inteira. Resolve com o status final. */
  async run() {
    if (this.status !== "ready") return this.status;
    this.status = "running";
    this.startedAt = this.now();
    this.emit("update", { type: "start" });
    try {
      for (let n = 0; n < this.cfg.maxConversations && this.running; n++) {
        await this.revealHints(n);
        await this.converse(n);
        if (!this.running) break;
        this.stage.release(this.talking);
        this.talking = [];
        this.emit("update", { type: "release" });
        const [min, max] = this.cfg.conversationGapMs;
        await this.pause(min + this.rng() * (max - min));
      }
      if (this.running) {
        this.status = "lost";
        this.endedAt = this.now();
        this.talking = [];
        this.boss(`${this.cfg.bossReplies.lost} "${this.word}"!`, "lost");
        this.stage.lament();
      }
    } catch (err) {
      if (!(err instanceof Aborted)) throw err;
    }
    if (this.status === "won") {
      await this.stage.celebrate(this.winner.id);
      this.endedAt ??= this.now();
    }
    if (this.status !== "stopped") this.emit("end", { status: this.status });
    return this.status;
  }

  /** Espera, mas para na hora se a rodada for encerrada. */
  async pause(ms) {
    await this.wait(ms, this.controller.signal);
    if (this.controller.signal.aborted) throw new Aborted();
  }

  /** Dicas do formulario: a 1a no comeco e mais uma a cada `revealHintEvery` conversas. */
  async revealHints(n) {
    const target = Math.min(this.formHints, 1 + Math.floor(n / this.cfg.revealHintEvery));
    while (this.formHints - this.pendingHints.length < target) {
      const hint = this.pendingHints.shift();
      this.hints.push(hint);
      const first = this.hints.length === 1;
      this.boss(first ? `Pensei em ${CATEGORY_LABEL[this.category] ?? "uma coisa"}! Dica: ${hint}` : `Dica nova: ${hint}`, first ? "start" : "hint");
      await this.pause(this.cfg.bossReactMs * 1.6);
    }
  }

  /** Escolhe a dupla: quem conversou menos, sem repetir a dupla anterior. */
  pickPair() {
    const shuffled = [...this.crew].sort(() => this.rng() - 0.5);
    const order = shuffled.sort((a, b) => this.talkCount.get(a.id) - this.talkCount.get(b.id));
    const fresh = (c) => !this.lastPair.includes(c.id);
    const a = order.find(fresh) ?? order[0];
    const rest = order.filter((c) => c !== a);
    const b = rest.find(fresh) ?? rest[0];
    for (const c of [a, b]) this.talkCount.set(c.id, this.talkCount.get(c.id) + 1);
    this.lastPair = [a.id, b.id];
    return [a, b];
  }

  /** Uma conversa em dupla. A proxima fala ja e pedida enquanto a atual esta sendo lida. */
  async converse(n) {
    const [a, b] = this.pickPair();
    const conv = { index: n + 1, ids: [a.id, b.id], lines: [] };
    this.conversations.push(conv);
    this.talking = [a.id, b.id];
    this.emit("update", { type: "conversation", conversation: conv });

    // A 1a fala comeca a ser gerada enquanto os dois andam ate o ponto de encontro.
    let task = this.lineTask(a, b, conv.lines);
    await Promise.race([this.stage.meet(a.id, b.id), this.abortPromise()]);
    if (!this.running) throw new Aborted();

    for (let i = 0; i < this.cfg.linesPerConversation; i++) {
      const [speaker, listener] = i % 2 ? [b, a] : [a, b];
      if (!task.done) this.setThinking(speaker.id);
      const line = await Promise.race([task.promise, this.abortPromise()]);
      this.setThinking(null);
      if (!this.running) throw new Aborted();

      const verdict = this.judge(line);
      const guess = line.guess ? displayGuess(line.guess) : "";
      if (verdict === "wrong") this.wrong.push(guess);
      if (verdict === "close") this.close.push(guess);
      const entry = {
        type: "line",
        conversation: conv.index,
        speakerId: speaker.id,
        name: speaker.name,
        text: line.text,
        guess,
        verdict,
        reasoning: line.reasoning ?? "",
        candidates: line.candidates ?? [],
        at: this.now(),
      };
      conv.lines.push(entry);
      this.log.push(entry);

      if (verdict === "right") {
        this.status = "won";
        this.winner = speaker;
        this.endedAt = this.now();
      } else if (i < this.cfg.linesPerConversation - 1) {
        task = this.lineTask(listener, speaker, conv.lines);
      }
      this.stage.say(speaker.id, line.text, { highlight: line.guess });
      this.emit("line", entry);

      if (verdict === "right") {
        await this.wait(this.cfg.bossReactMs);
        this.talking = [];
        this.boss(pick(this.cfg.bossReplies.right, this.rng), "right");
        return;
      }
      await this.pause(this.cfg.bossReactMs);
      this.boss(pick(this.cfg.bossReplies[verdict] ?? this.cfg.bossReplies.wrong, this.rng), verdict);
      await this.pause(Math.max(this.cfg.lineReadMs, line.text.length * 35));
    }
  }

  setThinking(id) {
    this.thinkingId = id;
    if (id) this.stage.thinking(id, true);
    else for (const c of this.crew) this.stage.thinking(c.id, false);
    this.emit("update", { type: "thinking", id });
  }

  /** Promessa que so rejeita quando a rodada e encerrada (para nao ficar presa esperando). */
  abortPromise() {
    const signal = this.controller.signal;
    return new Promise((_, reject) => {
      if (signal.aborted) return reject(new Aborted());
      signal.addEventListener("abort", () => reject(new Aborted()), { once: true });
    });
  }

  /** Gera uma fala em segundo plano: { promise, done }. */
  lineTask(speaker, listener, lines) {
    const task = { done: false };
    task.promise = this.generateLine(speaker, listener, lines).finally(() => {
      task.done = true;
    });
    // Se a rodada acabar antes de alguem esperar por ela, o erro de "abortado" nao vaza.
    task.promise.catch(() => {});
    return task;
  }

  /** Pede a fala ao modelo; sem conexao, avisa o HUD e tenta de novo ate dar certo (ou a rodada acabar). */
  async generateLine(speaker, listener, lines) {
    for (;;) {
      try {
        const line = await this.tryGenerate(speaker, listener, lines);
        if (this.error) {
          this.error = null;
          this.emit("update", { type: "error", error: null });
        }
        return line;
      } catch (err) {
        if (this.controller.signal.aborted || err instanceof Aborted) throw new Aborted();
        this.error = err;
        this.emit("update", { type: "error", error: err });
        await this.pause(this.cfg.retryMs);
      }
    }
  }

  /**
   * Ate `attempts` pedidos: resposta invalida ou palpite ja descartado pede de novo (avisando qual
   * palpite evitar). Se continuar repetindo, troca por um candidato novo da propria resposta.
   */
  async tryGenerate(speaker, listener, lines) {
    let avoid = "";
    let repeated = null;
    for (let attempt = 0; attempt < this.cfg.attempts; attempt++) {
      const messages = buildLineMessages({
        speaker,
        listener,
        persona: this.personas.get(speaker.id),
        category: this.category,
        hints: this.hints,
        lines: lines.map((l) => ({ name: l.name, text: l.text })),
        wrong: this.wrong,
        close: this.close,
        avoid,
      });
      const raw = await this.ask(messages, { signal: this.controller.signal });
      const line = parseLine(raw);
      if (!line) continue;
      if (line.guess && this.isUsed(line.guess) && !this.hits(line)) {
        repeated = line;
        avoid = line.guess;
        continue;
      }
      return line;
    }
    if (repeated) return withFreshCandidate(repeated, (g) => this.isUsed(g)) ?? repeated;
    return { guess: "", text: pick(FILLERS, this.rng), candidates: [], reasoning: "" };
  }

  /** Resumo para a tela final e o HUD. */
  summary() {
    return {
      status: this.status,
      word: this.word,
      category: this.category,
      winner: this.winner,
      conversations: this.conversations.length,
      guesses: this.guessCount,
      hints: this.hints.length,
      durationMs: (this.endedAt ?? this.now()) - (this.startedAt ?? this.now()),
    };
  }
}
