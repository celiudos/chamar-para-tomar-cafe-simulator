# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projeto

`chamar-para-tomar-cafe-simulator`: jogo pixel-art 2D (Phaser 3.90, ES modules, sem bundler/TypeScript) inspirado no [Agent Town](https://github.com/geezerrrr/agent-town). O jogador é o chefe, anda pelo escritório e conversa por chat com 6 funcionários **tentando convencê-los a tomar café** — mas, no estilo do jogo "Imagem e Ação" (sem mímica), cada funcionário só aceita quando o chefe **disser a palavra que ele está pensando** (um objeto, ou uma opinião política de esquerda/liberal ou direita/conservador). O funcionário vai soltando **pistas contextuais no diálogo** sobre o café e o trabalho; quando o chefe menciona a palavra exata (singular ou plural), ele se levanta e vai tomar café. As respostas vêm de um modelo local no Ollama (`gemma4:e2b`). Textos, comentários e commits são em português (pt-BR). O `README.md` é só um tutorial do Kiro CLI e não descreve o jogo; o `TODO.md` guarda os pedidos/requisitos históricos.

## Comandos

- `npm start` (ou `npm run dev`): `scripts/serve.mjs` sobe o jogo com live-reload em `http://localhost:3000` (também na LAN) e um proxy do Ollama na porta 3005. Aceita `--no-browser`.
- `npm run build:map`: regenera `public/maps/baias.json` a partir de `public/maps/office2.json` (`scripts/build-baias-map.mjs`). **Não edite `baias.json` à mão**: mude o script e rode de novo.
- Não há testes, linter nem build. O Phaser é carregado via `<script>` de `node_modules` no `index.html`; o resto roda direto como módulos no navegador.
- Requer o Ollama rodando localmente com o modelo `gemma4:e2b` instalado.
- `?debug` na URL mostra o cenário sorteado de cada personagem (dificuldade, palavra secreta, categoria, pistas) no loading, console e HUD.

## Arquitetura

**Configuração central (`config/`)**: `config/game.js` concentra tudo ajustável (identidade, tela, câmera, áudio, Ollama, limites do chat, `difficulty`, loading); `config/characters.js` define jogador e funcionários (nome, gênero, profissão, sprite, arquivo de persona). Tudo é importado via `config/index.js`. Prefira mudar valores aqui a espalhar constantes.

**Fluxo de boot (`game/main.js`)**: carrega fontes e personas fixas em paralelo → cria o `Phaser.Game` com `OfficeScene` por trás → `runLoading()` (`game/loading.js`) gera o cenário dinâmico e só libera o jogo no clique em "Começar" → `initHud()` (`game/hud.js`, DOM puro).

**Cena e entidades**: `OfficeScene` carrega o mapa Tiled `public/maps/baias.json`, descobre cadeiras/spawn/área de café por objetos do mapa (`MapHelpers`), e instancia `Player` (teclado), `Worker` (sentado na baia; levanta e vai ao café quando o chefe acerta a palavra secreta), `DoorManager`, `CameraController`, `ChatBubble`, `InteractionMenu`. A cena e o HUD (DOM) se comunicam pelo barramento `game/events.js` (`gameEvents.emit/on`; `on` reentrega o último valor emitido).

**Personas em duas camadas** (leia `personas/README.md` antes de mexer):
- **Fixa**: `personas/<id>.md` (front-matter `dica`, Personalidade, Jeito de falar, Interesses, "Cenários prontos" por dificuldade) + `config/characters.js`. Parseada por `game/personas.js`.
- **Dinâmica**: criada a cada carregamento em `game/scenario.js` — sorteia dificuldade (fácil/médio/difícil, repartida por igual) e pede ao Ollama a **palavra secreta**, a **categoria** (`objeto` ou `política`) e as **pistas** em JSON. Se o Ollama falhar ou responder inválido, usa o "cenário pronto" do `.md` da mesma dificuldade.
- As duas viram o system prompt do chat em `game/conversation.js` (`buildSystemPrompt`). Mantenha tudo curto: o prompt inteiro vai em toda mensagem.

**Chat/IA**: `game/ollama.js` é um cliente mínimo (`checkOllama`, `chatStream`, `generateJson`). O modelo responde JSON estruturado `{aceitou, fala}` (`REPLY_FORMAT`); a ordem das chaves importa (`aceitou` antes de `fala`, melhor coerência no gemma4:e2b). **A decisão do acerto é feita no código, não pelo modelo**: `game/conversation.js` (`mentionsWord`/`normalizeText`/`sameWord`) compara a fala do chefe com a palavra secreta — tem que ser a palavra **exata**, aceitando **singular ou plural** (via `singularForms`); sinônimo, palavra parecida ou substring não contam. O `aceitou` do modelo serve só para a fala sair coerente. A dificuldade controla `minMessages` (quando o personagem solta as pistas mais fortes) e o estilo das pistas (`rule`/`cluesGuide`). Limites de 1000 caracteres por pergunta/resposta e janela de histórico em `game.chat`. Modelo, `keep_alive`, `num_ctx` e demais opções são os mesmos em todas as chamadas — mudar `num_ctx` recarrega o modelo.

**Servidor (`scripts/serve.mjs`)**: live-server (observa `index.html`, `style.css`, `game`, `config`, `personas`, `public/maps`) + proxy HTTP que só libera `GET /api/tags` e `POST /api/chat` e remove `Origin`/`Referer`, porque o Ollama só escuta em `127.0.0.1:11434` e recusa origens externas. Quando o jogo é aberto por um IP da rede, `ollama.js` usa automaticamente esse proxy (`viaLanProxy`).

## Assets

Tilesets, personagens e ícones (LimeZu Modern Interiors) e a base do jogo (Agent Town, MIT) têm créditos em `config/game.js` → `credits`; mantenha-os ao reaproveitar código/assets.
