// Configuracoes principais do jogo.
// Edite aqui nome, versao, autor, mapa, camera, audio e opcoes de interacao.
// (Os personagens ficam em ./characters.js)

export const game = {
  // ── Identidade ──────────────────────────────────────────
  name: "chamar-para-tomar-cafe-simulator",
  version: "0.5.0",
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
    playfield: { x: 26, y: 44, width: 934, height: 446 },
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
    /**
     * Ollama desta maquina. Aberto por localhost, o navegador chama a API direto
     * (o Ollama libera CORS para localhost/127.0.0.1).
     */
    baseUrl: "http://127.0.0.1:11434",
    /**
     * Aberto pelo IP da rede (LAN), o navegador usa o proxy que o `npm start` sobe nesta porta
     * (scripts/serve.mjs), que repassa as chamadas para o `baseUrl`.
     */
    lanProxyPort: 3005,
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
    /**
     * Opcoes prontas do chat. `label` e o texto do botao; `text` e o que o chefe diz ao clicar.
     * Com `always: true` o botao fica sempre disponivel; sem isso, so aparece para iniciar a conversa.
     */
    quickReplies: [
      {
        id: "coffee",
        label: "Vamos tomar café?",
        text: "Vamos tomar café?",
        always: true,
      },
      {
        id: "work",
        label: "Perguntar sobre o trabalho",
        text: "Como está o trabalho hoje? No que você está trabalhando agora?",
      },
    ],
  },

  // ── Dificuldade ─────────────────────────────────────────
  // A cada carregamento, cada personagem recebe uma dificuldade sorteada (com niveis repartidos por
  // igual entre a equipe) que muda o quao exigente ele e para aceitar o cafe e quao claras sao as pistas.
  difficulty: {
    /** Ordem dos niveis; a equipe recebe os niveis em rodizio (embaralhado a cada jogo). */
    levels: ["easy", "medium", "hard"],
    easy: {
      label: "Fácil",
      /** Quantas falas do chefe (contando a atual) sao necessarias antes de aceitar. */
      minMessages: 1,
      /** Instrucoes para o gerador de cenarios (tela de loading). */
      motiveGuide:
        "UMA coisa simples e direta que o chefe precisa dizer ou prometer.",
      cluesGuide: "pista clara e direta, que quase entrega o motivo",
      /** Regra de comportamento no chat. */
      rule: "Você está bem-humorado(a) e aberto(a): aceita assim que o chefe cumprir o motivo, mesmo de forma simples. Se ele perguntar do seu trabalho, conte a sua situação e deixe escapar as pistas com clareza.",
    },
    medium: {
      label: "Médio",
      minMessages: 2,
      motiveGuide:
        "UMA coisa específica que o chefe precisa dizer ou prometer, ligada à situação da pessoa.",
      cluesGuide:
        "pista indireta: comenta o problema sem dizer exatamente o que o chefe deve fazer",
      rule: "Você é neutro(a): aceita quando o chefe cumprir o motivo de forma clara. Se ele só chegar perto, peça mais detalhes. Só dê pistas se ele se interessar pela sua situação, e de forma indireta.",
    },
    hard: {
      label: "Difícil",
      minMessages: 3,
      motiveGuide:
        "DUAS coisas que o chefe precisa cumprir juntas (por exemplo: reconhecer o problema E oferecer uma solução concreta). Só uma delas não basta.",
      cluesGuide:
        "pista vaga e curta, que só faz sentido para quem presta atenção",
      rule: "Você é desconfiado(a) e teimoso(a): só aceita quando o chefe cumprir TODAS as partes do motivo, e nunca na primeira vez em que ele acertar: antes, hesite e peça uma garantia. Dê só pistas vagas, e apenas se o chefe perguntar da sua situação.",
    },
  },

  // ── Tela de loading ─────────────────────────────────────
  // Antes do jogo comecar, o Ollama complementa cada persona (personas/*.md) com a situacao agora,
  // o motivo para aceitar o cafe e as pistas. Se falhar, usa o cenario pronto do proprio .md.
  loading: {
    /** Tempo maximo (ms) para gerar o cenario de UM personagem antes de usar o cenario pronto. */
    timeoutMs: 45000,
    /** Tentativas por personagem (com o modelo) antes do cenario pronto. */
    attempts: 2,
    /** Temperatura da geracao (mais alta que a do chat: queremos variedade). */
    temperature: 0.8,
    tips: [
      "Preparando a cafeteira...",
      "Moendo os grãos...",
      "Acordando a equipe...",
      "Cada pessoa tem um motivo diferente para aceitar o café.",
      "Pergunte sobre o trabalho: as pessoas contam o que as prende na mesa.",
      "Convite comum, insistência e ordem raramente funcionam.",
    ],
  },

  // ── Cafe (objetivo do jogo) ─────────────────────────────
  coffee: {
    /**
     * Pontos de espera na area de cafe (camada "pois" do mapa): o 1o a aceitar vai para o 1o,
     * o 2o para o 2o; quem chegar depois faz fila a esquerda do ultimo.
     */
    spots: ["coffee", "coffee-2"],
    /** Velocidade (px/s) do personagem andando ate o cafe. */
    walkSpeed: 90,
    /**
     * Corredores (y em px) usados no caminho baia -> cafe: quem senta virado para baixo
     * sai pelo corredor de cima; quem senta virado para cima, pelo de baixo (e sobe pela coluna `corridorX`).
     */
    aisles: { top: 172, bottom: 436 },
    corridorX: 561,
    /** Distancia (px) entre quem faz fila. */
    queueGap: 44,
    /** Area de cafe do mapa (px do mapa): faixa de piso colorida e a placa na parede. */
    area: {
      label: "CAFÉ",
      x: 684,
      y: 196,
      width: 228,
      height: 280,
      color: "#d9a05b",
      alpha: 0.22,
      sign: { x: 840, y: 72 },
    },
  },
};
