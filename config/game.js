// Configuracoes principais do jogo.
// Edite aqui nome, versao, autor, mapa, camera, audio e opcoes de interacao.
// (Os personagens ficam em ./characters.js)

export const game = {
  // ── Identidade ──────────────────────────────────────────
  name: "chamar-para-tomar-cafe-simulator",
  version: "0.5.0",
  description:
    "Simulador pixel-art de escritorio: estilo Imagem e Acao sem mimica. Cada funcionario (IA local via Ollama) da pistas e o chefe precisa adivinhar a palavra secreta.",
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
    model: "gemma4:e4b",
    /**
     * Quantas instancias do modelo usar (cada uma ocupa ~3 GB de VRAM: 6 GB = 2). A 1a e o Ollama
     * padrao (`baseUrl`); as demais sao `ollama serve` extras que o `npm start` sobe nas portas
     * `extraInstanceBasePort`, +1, +2... Os pedidos vao sempre para a instancia menos ocupada.
     * Se alguma nao subir ou nao couber na VRAM, o jogo segue com as que carregaram.
     */
    instances: 1,
    extraInstanceBasePort: 11435,
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
        text: "Vamos tomar um café? Dá uma pausa aí.",
        always: true,
      },
      {
        id: "clue",
        label: "Me dá uma pista?",
        text: "O que te faria largar isso e vir tomar café comigo?",
      },
    ],
  },

  // ── Dificuldade ─────────────────────────────────────────
  // A cada carregamento, cada personagem recebe uma dificuldade sorteada (com niveis repartidos por
  // igual entre a equipe) que muda o quao claras sao as pistas e quanto o personagem resiste antes de
  // dar a pista mais forte da palavra secreta.
  difficulty: {
    /** Ordem dos niveis; a equipe recebe os niveis em rodizio (embaralhado a cada jogo). */
    levels: ["easy", "medium", "hard"],
    easy: {
      label: "Fácil",
      /** Quantas falas do chefe (contando a atual) ate o personagem soltar as pistas mais fortes. */
      minMessages: 1,
      /** Instrucoes para o gerador de pistas (tela de loading). */
      cluesGuide:
        "pista bem clara, que quase entrega a palavra, mas sem dizê-la",
      /** Regra de comportamento no chat. */
      rule: "Você está de bom humor e brincalhão(ã): dá pistas bem claras e diretas, quase entregando a palavra, mas se diverte vendo o chefe boiar. Enquanto ele não acerta, enrola o convite do café com piadinhas e deboche leve. Nunca diga a palavra; só o chefe pode dizê-la.",
    },
    medium: {
      label: "Médio",
      minMessages: 2,
      cluesGuide:
        "pista de meio-termo: aponta para a palavra, mas exige um pouco de raciocínio",
      rule: 'Você é provocador(a) e irônico(a): dá pistas de meio-termo e caçoa dos palpites errados do chefe ("sério que foi isso que você entendeu?"). Resiste ao café com sarcasmo e, a cada erro, dá outra pista por um ângulo diferente. Nunca diga a palavra.',
    },
    hard: {
      label: "Difícil",
      minMessages: 3,
      cluesGuide:
        "pista vaga e curta, que só faz sentido para quem presta muita atenção",
      rule: "Você é enigmático(a), zombeteiro(a) e difícil de convencer: recusa o café com deboche e dá só pistas vagas e curtas, uma de cada vez, rindo da confusão do chefe. Nas primeiras falas, as pistas mais obscuras e as melhores tiradas; só solta algo mais claro se ele implorar. Nunca diga a palavra.",
    },
  },

  // ── Tela de loading ─────────────────────────────────────
  // Antes do jogo comecar, o Ollama complementa cada persona (personas/*.md) com a palavra secreta,
  // a categoria (objeto ou política) e as pistas. Se falhar, usa o cenario pronto do proprio .md.
  loading: {
    /** Tempo maximo (ms) para gerar o cenario de UM personagem antes de usar o cenario pronto. */
    timeoutMs: 45000,
    /** Tentativas por personagem (com o modelo) antes do cenario pronto. */
    attempts: 2,
    /** Temperatura da geracao (mais alta que a do chat: queremos variedade). */
    temperature: 0.8,
    tips: [
      "Preparando as pistas...",
      "Pensando em palavras secretas...",
      "Acordando a equipe...",
      "Cada pessoa esconde uma palavra: um objeto ou uma opinião política.",
      "Pergunte sobre o trabalho: as pistas aparecem no meio da conversa.",
      "Para vencer, mencione a palavra secreta no meio da sua resposta.",
    ],
  },

  // ── Modos de jogo ───────────────────────────────────────
  // Escolhidos na tela inicial. Na URL, `?modo=classico` ou `?modo=equipe` pula a escolha.
  modes: [
    {
      id: "classic",
      label: "Chefe adivinha",
      url: "classico",
      description:
        "Cada funcionário, sentado na baia, pensa numa palavra secreta. Converse no chat, siga as pistas e diga a palavra para levá-lo ao café.",
    },
    {
      id: "team",
      label: "Equipe adivinha",
      url: "equipe",
      description:
        "Você escolhe a palavra e as dicas. A equipe fica em pé, andando pelo escritório e conversando entre si até adivinhar.",
    },
  ],

  // ── Modo "Equipe adivinha" ──────────────────────────────
  // O jogador (chefe) define a palavra secreta, a categoria e as dicas. Os funcionarios andam pelo
  // escritorio, se encontram em duplas e conversam (baloes) tentando adivinhar. A decisao do acerto
  // e do codigo (game/words.js): palavra exata, singular ou plural. Ver game/teamChat.js.
  team: {
    /** Limites do formulario da rodada. */
    wordMaxChars: 40,
    wordMaxWords: 3,
    hintsMax: 3,
    hintMaxChars: 120,
    /** Quantas conversas (em dupla) a equipe tem para acertar; depois disso o chefe vence. */
    maxConversations: 10,
    /** Falas por conversa (alternando entre os dois): cada fala traz um palpite. */
    linesPerConversation: 2,
    /** A cada quantas conversas o chefe solta a proxima dica (a 1a sai no inicio). */
    revealHintEvery: 2,
    /** Velocidade (px/s) andando pelo escritorio. */
    walkSpeed: 70,
    /** Pausa (ms) parado entre uma caminhada e outra: [min, max]. */
    wanderPauseMs: [1200, 4500],
    /** Raio (px) maximo de cada caminhada a toa. */
    wanderRadius: 320,
    /** Distancia (px) entre os dois na conversa. */
    talkGap: 72,
    /** Pausa (ms) entre uma conversa e a proxima: [min, max]. */
    conversationGapMs: [1200, 3000],
    /** Pausa (ms) depois de cada fala, para dar tempo de ler o balao. */
    lineReadMs: 2600,
    /** Duracao minima (ms) do balao de fala; falas longas ficam mais tempo (ms por caractere). */
    bubbleMs: 4500,
    bubbleMsPerChar: 55,
    /** Tamanho maximo de cada fala da equipe (caracteres). */
    maxLineChars: 180,
    /** Quantas falas anteriores da conversa atual vao para o modelo. */
    historyLines: 6,
    /** Temperatura das falas (mais alta = palpites mais variados). */
    temperature: 0.8,
    /** Tentativas por fala (resposta invalida ou palpite repetido) antes de seguir. */
    attempts: 2,
    /** Sem Ollama no meio da rodada: espera (ms) antes de tentar de novo. */
    retryMs: 5000,
    /** Reacoes do chefe a cada palpite (sorteadas). */
    bossReplies: {
      wrong: [
        "Não!",
        "Errado!",
        "Nada a ver!",
        "Frio...",
        "Nem perto!",
        "Errou!",
      ],
      close: ["Tá quente!", "Quase!", "Chegou perto!", "Quente, quente!"],
      repeat: ["Já falaram isso!", "Esse já foi!", "De novo isso?"],
      none: ["Chuta alguma coisa!", "E aí, qual o palpite?"],
      right: ["ACERTOU! Café pra todo mundo!", "É isso! Café liberado!"],
      lost: "Acabou! A palavra era",
    },
    /** Pausa (ms) do chefe reagindo ao palpite antes da proxima fala. */
    bossReactMs: 1400,
    /** Dicas extras que o chefe pode dar durante a rodada (alem das do formulario). */
    extraHintsMax: 3,
    /** Exemplos que aparecem no formulario (placeholder e botao "Sortear exemplo"). */
    placeholders: {
      word: "grampeador",
      hints: [
        "Fica em cima da mesa",
        "Vive sumindo quando você precisa",
        'Faz "clack" e prende papel',
      ],
    },
    examples: [
      {
        word: "cadeira",
        category: "objeto",
        hints: ["Você passa o dia em cima dela", "Tem rodinhas", "Gira"],
      },
      {
        word: "guarda-chuva",
        category: "objeto",
        hints: [
          "Fica esquecido no ônibus",
          "Abre e fecha",
          "Salva no dia cinza",
        ],
      },
      {
        word: "fone de ouvido",
        category: "objeto",
        hints: [
          "Você usa na cabeça",
          "Serve para não ouvir os colegas",
          "Tem fio ou bluetooth",
        ],
      },
      {
        word: "caneca",
        category: "objeto",
        hints: [
          "Todo mundo tem a sua na copa",
          "Tem alça",
          "Café quente vai nela",
        ],
      },
      {
        word: "privatização",
        category: "política",
        hints: [
          "O governo vende o que é dele",
          "Correios e estatais entram na conversa",
          "Liberal adora, sindicato odeia",
        ],
      },
      {
        word: "reforma agrária",
        category: "política",
        hints: [
          "Bandeira do MST",
          "Dividir a terra parada",
          "Tem a ver com o campo",
        ],
      },
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
