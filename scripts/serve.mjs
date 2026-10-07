// Servidor de desenvolvimento (npm start).
// - Jogo com live reload na porta 3000, aberto para localhost e para a rede (LAN).
// - Proxy do Ollama na porta `game.ollama.lanProxyPort` (3005), usado por quem abre o jogo
//   pelo IP da rede: o navegador nao alcanca o Ollama, que so escuta em 127.0.0.1:11434.
//
// Uso: node scripts/serve.mjs [--no-browser]
import http from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream";
import { fileURLToPath } from "node:url";
import liveServer from "live-server";
import { game } from "../config/game.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GAME_PORT = 3000;
const WATCH = ["index.html", "style.css", "game", "config", "personas", "public/maps"];

const ollama = new URL(game.ollama.baseUrl);
const PROXY_PORT = game.ollama.lanProxyPort;
/** So as rotas que o jogo usa: o resto da API (pull, delete...) nao fica exposto na rede. */
const PROXY_ROUTES = new Set(["GET /api/tags", "POST /api/chat"]);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(res, status, body) {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

// ── Proxy do Ollama ───────────────────────────────────────
const proxy = http.createServer((req, res) => {
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end();
  if (!PROXY_ROUTES.has(`${req.method} ${req.url.split("?")[0]}`)) {
    return sendJson(res, 404, { error: `rota nao liberada no proxy: ${req.method} ${req.url}` });
  }

  // O Ollama recusa Origin de fora do localhost: o pedido segue como se viesse desta maquina.
  const { origin, referer, ...headers } = req.headers;
  const upstream = http.request(
    {
      hostname: ollama.hostname,
      port: ollama.port,
      path: req.url,
      method: req.method,
      headers: { ...headers, host: ollama.host },
    },
    (up) => {
      res.writeHead(up.statusCode, { ...up.headers, ...CORS });
      pipeline(up, res, () => {});
    },
  );
  upstream.on("error", (err) => {
    if (res.headersSent || res.destroyed) return res.destroy();
    sendJson(res, 502, { error: `Ollama indisponivel em ${ollama.origin} (${err.message})` });
  });
  // Navegador desistiu (ex.: cancelou o stream): derruba o pedido para o Ollama parar de gerar.
  res.on("close", () => upstream.destroy());
  req.pipe(upstream);
});

proxy.on("error", (err) => {
  console.error(`Proxy do Ollama nao subiu na porta ${PROXY_PORT} (${err.message}). Pela LAN o chat nao vai funcionar.`);
});
proxy.listen(PROXY_PORT, "0.0.0.0", () => {
  console.log(`Proxy do Ollama para a LAN: porta ${PROXY_PORT} -> ${ollama.origin}`);
});

// ── Jogo ──────────────────────────────────────────────────
const server = liveServer.start({
  root,
  host: "0.0.0.0",
  port: GAME_PORT,
  open: process.argv.includes("--no-browser") ? false : "/",
  watch: WATCH.map((p) => resolve(root, p)),
  wait: 200,
});

server.on("listening", () => {
  const { port } = server.address();
  const lan = Object.entries(networkInterfaces()).flatMap(([name, addrs]) =>
    addrs.filter((a) => a.family === "IPv4" && !a.internal).map((a) => `  http://${a.address}:${port}  (${name})`),
  );
  console.log(lan.length ? `Na rede (LAN):\n${lan.join("\n")}` : "Nenhum IP de rede (LAN) encontrado.");
});
