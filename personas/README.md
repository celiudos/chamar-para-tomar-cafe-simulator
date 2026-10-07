# Personas

Cada personagem de `config/characters.js` aponta para um arquivo desta pasta
(`persona: "bob"` → `personas/bob.md`). O arquivo é carregado quando o jogo abre e vira o
_system prompt_ do personagem no Ollama (`config/game.js` → `ollama.model`).

```markdown
---
saudacao: Primeira fala ao abrir o chat (não usa o modelo).
dica: Resumo público, mostrado no painel Employees do HUD.
---

# Nome

## Personalidade
## Jeito de falar
## Situação agora
## Motivo para aceitar o café
Fulano só aceita ir tomar café se o chefe ... Convite comum, insistência ou ordem não bastam.
## Pistas que você pode dar
```

Dicas para escrever uma persona:

- **Motivo para aceitar o café** é a regra do jogo: escreva uma condição concreta e
  verificável. O modelo responde `aceitou: true` só quando ela é cumprida, e então o
  personagem levanta e vai até a cafeteira.
- Diga também o que **não** vale (por exemplo, "bug em outra coisa não basta"). Modelos
  pequenos confundem situações parecidas.
- Mantenha o texto curto: a persona vai inteira em toda mensagem, e menos texto deixa a
  resposta mais rápida.
- Pistas na conversa devem ser sutis. A `dica` do HUD já ajuda o jogador a começar.

O jogo recarrega sozinho (`npm start`) ao salvar um arquivo desta pasta.
