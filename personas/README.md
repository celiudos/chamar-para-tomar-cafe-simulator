# Personas

Cada personagem de `config/characters.js` aponta para um arquivo desta pasta
(`persona: "bob"` → `personas/bob.md`).

A persona tem duas partes:

- **Fixa** (este arquivo + `config/characters.js`): profissão, gênero, personalidade, jeito de
  falar e interesses. Não muda entre partidas.
- **Dinâmica** (criada na tela de loading, `game/scenario.js`): **dificuldade**, **situação
  agora**, **motivo para aceitar o café** e **pistas que o personagem pode dar**. A cada
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
Temas que mexem com a pessoa; o gerador usa um deles no motivo e nas pistas.

## Cenários prontos
### Fácil: título
- Situação: ...
- Motivo: Fulano aceita ir tomar café se o chefe ...
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

- O **motivo** é a regra do jogo: uma condição concreta que o chefe cumpre só conversando.
  No _difícil_, exija **duas** coisas juntas ("as DUAS coisas: ... E ...").
- Diga também o que **não** vale (por exemplo, "bug em outra coisa não basta"). Modelos
  pequenos confundem situações parecidas.
- As **pistas** descrevem o que o personagem comenta sem entregar o motivo: mais claras no
  fácil, vagas no difícil.
- Mantenha tudo curto: a persona vai inteira em toda mensagem, e menos texto deixa a
  resposta mais rápida.

## Dificuldade

Definida em `config/game.js` → `difficulty`. Cada nível tem:

- `motiveGuide` / `cluesGuide`: instruções para o gerador (quantas condições, quão claras as pistas);
- `rule`: como o personagem negocia no chat;
- `minMessages`: quantas falas do chefe são necessárias antes de aceitar (1 / 2 / 3). Antes disso o
  personagem hesita, mesmo que o chefe acerte o motivo.

## Ver o cenário gerado

No HUD, o botão **Personas** (ícone de pergaminho, canto superior direito) mostra a dificuldade, a
situação, o motivo e as pistas de cada personagem. Como isso revela as respostas do jogo, o painel
avisa sobre o spoiler e só mostra o conteúdo depois que o jogador clica em "Ver as respostas".

## Depuração

Abra o jogo com `?debug` na URL (ex.: `http://localhost:3000/?debug`) para ver o cenário sorteado de
cada personagem (dificuldade, situação, motivo e pistas) na tela de loading, no console e no painel
Employees.

O jogo recarrega sozinho (`npm start`) ao salvar um arquivo desta pasta.
