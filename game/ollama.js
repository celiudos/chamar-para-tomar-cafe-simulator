// Cliente minimo da API local do Ollama (https://github.com/ollama/ollama/blob/main/docs/api.md).
// Modelo, URL e opcoes ficam em config/game.js (ollama).
import { game } from "../config/index.js";

const cfg = game.ollama;

/** Aberto pelo IP da rede (LAN): passa pelo proxy do `npm start` na mesma maquina do jogo. */
export const viaLanProxy = !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
export const baseUrl = viaLanProxy
  ? `http://${location.hostname}:${cfg.lanProxyPort}`
  : cfg.baseUrl.replace(/\/+$/, "");
const endpoint = (path) => `${baseUrl}${path}`;

/** Mesmo modelo, keep_alive e opcoes em todas as chamadas: mudar num_ctx recarregaria o modelo. */
function chatBody(extra) {
  return { model: cfg.model, keep_alive: cfg.keepAlive, think: cfg.think, options: cfg.options, ...extra };
}

async function post(path, body, signal) {
  const res = await fetch(endpoint(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let message = detail;
    try {
      message = JSON.parse(detail).error ?? detail;
    } catch {}
    throw new Error(message || `HTTP ${res.status}`);
  }
  return res;
}

/** Ollama no ar? Modelo instalado? -> { online, hasModel, error } */
export async function checkOllama() {
  try {
    const res = await fetch(endpoint("/api/tags"), { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { online: false, hasModel: false, error: `HTTP ${res.status}` };
    const { models = [] } = await res.json();
    const wanted = cfg.model.includes(":") ? cfg.model : `${cfg.model}:latest`;
    return { online: true, hasModel: models.some((m) => m.name === wanted || m.model === wanted) };
  } catch (err) {
    return { online: false, hasModel: false, error: err.message };
  }
}

/** Carrega o modelo na memoria (chat sem mensagens) para a 1a resposta nao esperar o load. */
export async function warmUp() {
  const res = await post("/api/chat", chatBody({ messages: [], stream: false }));
  await res.json();
}

/**
 * Pedido unico (sem stream) ao modelo, para gerar um JSON no formato `format`.
 * `options` sobrescreve as opcoes do chat (so campos que nao recarregam o modelo, como temperature).
 */
export async function generateJson({ messages, format, options, signal }) {
  const res = await post("/api/chat", chatBody({ messages, format, stream: false, options: { ...cfg.options, ...options } }), signal);
  const data = await res.json();
  return data.message?.content ?? "";
}

/**
 * POST /api/chat em stream. `onText(textoAcumulado)` e chamado a cada pedaco;
 * se retornar false, a geracao e interrompida (o Ollama para ao perder a conexao).
 * Retorna { content, stats } (stats = ultimo pedaco, com contagem de tokens e tempos).
 */
export async function chatStream({ messages, format, onText, signal }) {
  const res = await post("/api/chat", chatBody({ messages, format, stream: true }), signal);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let content = "";
  let stats = null;

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let nl;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const chunk = JSON.parse(line);
      if (chunk.error) throw new Error(chunk.error);
      if (chunk.done) stats = chunk;
      if (chunk.message?.content) {
        content += chunk.message.content;
        if (onText?.(content) === false) {
          await reader.cancel();
          return { content, stats };
        }
      }
    }
  }
  return { content, stats };
}
