// Configuracoes principais do jogo.
// Edite aqui nome, versao, autor, mapa, camera, audio e opcoes de interacao.
// (Os personagens ficam em ./characters.js)

export const game = {
  // ── Identidade ──────────────────────────────────────────
  name: "chamar-para-tomar-cafe-simulator",
  version: "0.4.0",
  description:
    "Simulador pixel-art de escritorio: o chefe conversa com a equipe (IA local via Ollama) e tenta convencer alguem a tomar cafe.",
  author: {
    name: "Marcelo Note",
  },
  license: "UNLICENSED",
  language: "pt-BR",

  // ── Creditos (obrigatorios para o que foi reaproveitado) ─
  credits: [
    {
      what: "Cenario, UI e logica base do jogo",
      by: "Agent Town (geezerrrr)",
      url: "https://github.com/geezerrrr/agent-town",
      license: "MIT",
    },
    {
      what: "Tilesets, personagens, emotes e icones (pixel art)",
      by: "LimeZu - Modern Interiors",
      url: "https://limezu.itch.io/moderninteriors",
      license: "Pacote comercial: verifique a licenca antes de publicar",
    },
  ],

  // ── Tela ────────────────────────────────────────────────
  display: {
    width: 1280,
    height: 720,
    backgroundColor: "#1a1814",
  },

  // ── Camera ──────────────────────────────────────────────
  camera: {
    /** Ajusta o zoom inicial para o mapa caber na janela. */
    fitToMap: true,
    /** Fracao da janela ocupada pelo mapa quando fitToMap = true. */
    fitMargin: 0.86,
    zoomMin: 0.5,
    zoomMax: 3,
    lerp: 0.1,
  },

  // ── Mapa (cenario principal) ────────────────────────────
  map: {
    key: "baias",
    path: "/public/maps/baias.json",
    tilesetsPath: "/public/tilesets",
    /**
     * Area visivel/jogavel do mapa em pixels (x, y, largura, altura).
     * Tudo fora dela e coberto com a cor de fundo; a camera e o mundo fisico ficam limitados a ela.
     * public/maps/baias.json tem 720x528px; o recorte inclui um pouco de parede/corredor vizinhos.
     */
    playfield: { x: 26, y: 44, width: 694, height: 446 },
    /** Portas animadas deste mapa (x, y em pixels). O cenario das baias nao tem portas. */
    doors: [],
  },

  // ── Audio ───────────────────────────────────────────────
  audio: {
    bgm: "/public/audio/bgm.mp3",
    defaultVolume: 0.45,
    storageKey: "chamar-para-tomar-cafe:bgm-volume",
  },

  // ── Interacao com os personagens sentados ───────────────
  interaction: {
    /** Distancia maxima (px) entre o chefe e o personagem para aparecer "Press E". */
    distance: 64,
    promptText: "Press E",
    /** Duracao minima (ms) do balao de fala; respostas longas ficam mais tempo. */
    bubbleMs: 4500,
    /**
     * Opcoes do menu. `id` e usado pelo codigo (game/interactions.js);
     * para criar novas mecanicas, adicione uma opcao aqui e trate o `id` la.
     */
    options: [
      { id: "talk", label: "Conversar" },
      { id: "cancel", label: "Cancelar" },
    ],
  },

  // ── IA local (Ollama) ───────────────────────────────────
  ollama: {
    /** O navegador chama a API direto (o Ollama libera CORS para localhost/127.0.0.1). */
    baseUrl: "http://127.0.0.1:11434",
    model: "gemma4:e2b",
    /** Mantem o modelo carregado entre as mensagens (o 1o carregamento leva alguns segundos). */
    keepAlive: "30m",
    /** Desliga o modo "thinking" do Gemma 4: a resposta comeca na hora. */
    think: false,
    /**
     * Opcoes do modelo. Contexto pequeno e limite de tokens deixam a resposta rapida.
     * O aquecimento usa as mesmas opcoes, assim o modelo nao e recarregado na 1a mensagem.
     */
    options: {
      num_ctx: 4096,
      /** ~1000 caracteres em portugues + o JSON da resposta. */
      num_predict: 340,
      temperature: 0.6,
      top_k: 40,
      top_p: 0.9,
    },
    /** Carrega o modelo na memoria assim que o jogo abre. */
    warmUp: true,
  },

  // ── Chat com os personagens ─────────────────────────────
  chat: {
    /** Pasta com uma persona (Markdown) por personagem: <personasPath>/<persona>.md */
    personasPath: "/personas",
    maxQuestionChars: 1000,
    maxAnswerChars: 1000,
    /** Quantas mensagens anteriores vao para o modelo junto com a persona (menos = mais rapido). */
    historyMessages: 8,
  },

  // ── Cafe (objetivo do jogo) ─────────────────────────────
  coffee: {
    /** Ponto em frente a cafeteira: objeto "coffee" da camada "pois" do mapa. */
    poi: "coffee",
    /** Velocidade (px/s) do personagem andando ate o cafe. */
    walkSpeed: 90,
    /**
     * Corredores (y em px) usados no caminho baia -> cafeteira: quem senta virado para baixo
     * sai pelo corredor de cima; quem senta virado para cima, pelo de baixo.
     * O ultimo trecho sobe/desce na coluna x da cafeteira.
     */
    aisles: { top: 172, bottom: 436 },
    /** Quem chega depois faz fila a esquerda do primeiro (distancia em px). */
    queueGap: 44,
  },
};
