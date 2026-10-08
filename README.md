# Chamar para Tomar Café Simulator

Jogo pixel-art 2D de escritório, feito com [Phaser](https://phaser.io/) 3.90, inspirado no [Agent Town](https://github.com/geezerrrr/agent-town). Você é o chefe, anda pelo escritório e conversa por chat com 6 funcionários **tentando convencê-los a tomar café**.

A dinâmica segue o jogo "Imagem e Ação", sem mímica. Cada funcionário pensa numa **palavra secreta**: um objeto ou uma opinião política (esquerda/liberal ou direita/conservador). Ele não diz a palavra, só solta **pistas** no diálogo. Quando você menciona a palavra exata (no singular ou no plural), ele se levanta e vai tomar café.

As respostas dos personagens são geradas por um modelo de IA local, rodando no [Ollama](https://ollama.com/). Nada é enviado para a nuvem.

## Modos de jogo

- **Chefe adivinha**: cada funcionário, sentado na baia, pensa numa palavra. Converse, siga as pistas e diga a palavra para levá-lo ao café.
- **Equipe adivinha**: você escolhe a palavra e as dicas. A equipe anda pelo escritório e conversa entre si até adivinhar.

## Pré-requisitos

- [Node.js](https://nodejs.org/) em uma versão atual (LTS recomendada), com npm. O projeto usa ES modules e `node --test`.
- [Ollama](https://ollama.com/download), disponível para Windows, macOS e Linux.
- Um computador capaz de rodar o modelo local. A configuração atual usa `gemma4:e4b`.

## Instalação

1. Clone o repositório e entre na pasta:

   ```bash
   git clone <url-do-repositorio>
   cd kiro-treino
   ```

2. Instale as dependências do projeto:

   ```bash
   npm install
   ```

3. Instale o Ollama pelo instalador oficial em <https://ollama.com/download>. No Linux, você também pode usar:

   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```

4. Baixe o modelo usado pelo jogo:

   ```bash
   ollama pull gemma4:e4b
   ```

O modelo, a porta do Ollama e outras opções ficam em `config/game.js`.

## Como rodar

1. Garanta que o Ollama está rodando em `http://127.0.0.1:11434`. No Windows e no macOS o aplicativo costuma iniciar sozinho. No Linux, ou se ele não estiver ativo, rode em outro terminal:

   ```bash
   ollama serve
   ```

2. Inicie o jogo:

   ```bash
   npm start
   ```

3. Abra <http://localhost:3000> (o navegador abre sozinho). Escolha o modo de jogo e clique em "Começar".

Detalhes:

- Para não abrir o navegador automaticamente: `npm start -- --no-browser`.
- O servidor também fica acessível na rede local. Um proxy do Ollama sobe na porta 3005 para quem abrir o jogo pelo IP da máquina.
- Para pular a escolha de modo, use `?modo=classico` ou `?modo=equipe` na URL.
- Para ver a palavra secreta e as pistas de cada personagem (útil para testar), use `?debug` na URL.

## Como jogar

- **Andar**: setas ou `W`, `A`, `S`, `D`.
- **Interagir**: aproxime-se de um funcionário e pressione `E`. Navegue no menu com `W`/`S` ou as setas e confirme com `E`.
- **Conversar**: escreva no chat e envie com `Enter`. Cada mensagem pode ter até 1000 caracteres.

## Testes

```bash
npm test
```

## Créditos

- Cenário, UI e lógica base: [Agent Town](https://github.com/geezerrrr/agent-town) (geezerrrr), licença MIT.
- Tilesets, personagens, emotes e ícones: [LimeZu - Modern Interiors](https://limezu.itch.io/moderninteriors). É um pacote comercial, então verifique a licença antes de publicar.
