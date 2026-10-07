# Personas

Cada personagem de `config/characters.js` aponta para um arquivo desta pasta
(`persona: "bob"` → `personas/bob.md`).

O jogo é uma adivinhação no estilo "Imagem e Ação", mas **sem mímica**: cada personagem tem uma
**palavra secreta** e vai soltando **pistas contextuais no diálogo**. O chefe vence quando
**menciona a palavra secreta** no meio de uma mensagem.

A persona tem duas partes:

- **Fixa** (este arquivo + `config/characters.js`): profissão, gênero, personalidade, jeito de
  falar e interesses. Não muda entre partidas.
- **Dinâmica** (criada na tela de loading, `game/scenario.js`): **dificuldade**, **palavra
  secreta**, **categoria** (`objeto` ou `política`) e **pistas que o personagem dá**. A cada
  carregamento o Ollama inventa um complemento novo para cada pessoa, e as dificuldades
  (fácil / médio / difícil, ver `config/game.js` → `difficulty`) são sorteadas e repartidas
  por igual entre a equipe.

Os dois juntos viram o _system prompt_ do personagem no chat (`game/conversation.js`).

```markdown
---
dica: Resumo público e fixo, mostrado no painel Employees do HUD.
---

# Nome

## Personalidade
## Jeito de falar
## Interesses
Temas que mexem com a pessoa; o gerador usa um deles na palavra secreta e nas pistas.

## Cenários prontos
### Fácil: título
- Palavra: ...
- Categoria: objeto | política
- Pistas: ...

### Médio: título
### Difícil: título
```

## Cenários prontos

São um por dificuldade e têm duas funções:

1. **Exemplo** de formato e de nível para o gerador da tela de loading.
2. **Reserva**: se o Ollama estiver fora do ar, sem o modelo ou responder algo inválido, o jogo
   usa o cenário pronto da dificuldade sorteada.

Escreva-os assim:

- A **palavra** é a resposta do jogo: 1 a 3 palavras, do dia a dia, ligada aos Interesses. Pode ser
  um **objeto** (uma coisa concreta) ou uma **opinião política** curta de esquerda/liberal ou
  direita/conservador.
- A **categoria** é `objeto` ou `política` (qualquer rótulo com "polit" vira `política`; o resto, `objeto`).
- As **pistas** são o que o personagem comenta _sem nunca dizer a palavra_: mais claras no fácil,
  vagas no difícil. Elas devem levar o chefe até a palavra.
- Mantenha tudo curto: a persona vai inteira em toda mensagem, e menos texto deixa a
  resposta mais rápida.

## Como o acerto é decidido

O diálogo é temático: o chefe conversa tentando **convencer a pessoa a tomar café**, mas ela só vai
quando ele disser a palavra que ela está pensando (no estilo Imagem e Ação, com pistas no diálogo).

Não é o modelo que decide o acerto: o código (`game/conversation.js` → `mentionsWord`) compara a fala
do chefe (sem acentos nem pontuação) com a palavra secreta. A palavra tem que ser **exatamente** a
mesma, mas o match aceita **singular ou plural** (ex.: palavra "cadeira" casa com "cadeiras", e
"papel" com "papeis"). Palavra parecida, sinônimo ou um termo que apenas _contém_ a palavra não
contam. Para expressões (ex.: "livre mercado"), a sequência precisa aparecer na fala, cada termo
batendo no singular ou plural.

## Dificuldade

Definida em `config/game.js` → `difficulty`. Cada nível tem:

- `cluesGuide`: instrução para o gerador (quão claras as pistas);
- `rule`: como o personagem dá as pistas no chat (claro no fácil, enigmático no difícil);
- `minMessages`: a partir de qual fala do chefe o personagem solta as pistas mais fortes (1 / 2 / 3).
  Antes disso ele dá pistas mais obscuras — mas se o chefe mencionar a palavra, vence do mesmo jeito.

## Ver a palavra secreta

No HUD, o botão **Personas** (ícone de pergaminho, canto superior direito) mostra a dificuldade, a
palavra secreta, a categoria e as pistas de cada personagem. Como isso revela as respostas do jogo,
o painel avisa sobre o spoiler e só mostra o conteúdo depois que o jogador clica em "Ver as respostas".

## Depuração

Abra o jogo com `?debug` na URL (ex.: `http://localhost:3000/?debug`) para ver o cenário sorteado de
cada personagem (dificuldade, palavra secreta, categoria e pistas) na tela de loading, no console e no
painel Employees.

O jogo recarrega sozinho (`npm start`) ao salvar um arquivo desta pasta.
