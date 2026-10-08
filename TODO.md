<!-- Implemente as instruções de `TODO.md` -->

# Contexto

Jogo simples com Ollama.

Leia o `CLAUDE.md` para entender o projeto

# Implementado

A ideia é ultizar um cenário e UI similar ao `Agent Town`. Pode reaproveitar o código do github, se possível.

Altere a dinâmica de o personagem conseguir aceitar a tomar café.
Faça algo parecido com o jogo de tabuleiro chamado "Imagem e Ação".
O jogador deve tentar conseguir adivinhar a palavra que o personagem está querendo que o jogador mencione. O jogador pode mencionar a palavra no meio de suas respostas e ser aceito.
O personagem não vai fazer mímica, mas vai dar pistas contextuais no diálogo.
Adapte o diálogo para que fique conforme o contexto do jogo e pareça natural.
Para adivinhar, pode ser apenas objetos ou opiniões políticas de "esquerda" (liberal) ou "direita" (conservador).

A palavra que o usuário quer tem que ser exatamente a mesma que o personagem está pensando. O match da palavra pode ser no singular ou plural.

O diálgo tem que simular como se fosse uma tentativa de convencer o personagem a tomar café, mas o diálogo seguirá a linha da dinânmica do jogo "Imagem e Ação", onde o personagem vai dar pistas contextuais para que o jogador tente adivinhar a palavra que ele está pensando.

# Instrução

Crie um novo modo de jogo para o jogo atual, no qual, em vez de os personagens ficarem sentados, eles ficam em pé e andando, conversando uns com os outros. Então fica aparecendo balões de diálogo entre eles.

O objetivo vai ser, o jogador consegue definir a palavra chave e as dicas e os personagens vão conversar entre eles e tentar identificar a palavra que o jogador está pensando.
