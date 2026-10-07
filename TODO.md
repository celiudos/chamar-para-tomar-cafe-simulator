# Contexto

Crie um jogo simples similar ao `Agent Town` em `https://github.com/geezerrrr/agent-town`.

# Implementado

A ideia é ultizar um cenário e UI similar ao `Agent Town`. Pode reaproveitar o código do github, se possível.

Crie apenas a interface com o cenário e os personagens.
A mecânica será diferente e irei implementar no futuro.
Utilize package.json para iniciar o servidor local.

Altere a UI do game para ficar o mais parecido possível visualmente com o `Agent Town`.

Alere o nome do jogo para `chamar-para-tomar-cafe-simulator`.

Agora crie uma pasta que defina todas as principais configurações do jogo, como nome, versão, autor, etc.
Ela também vai definir os personagens, como nome e gênero, por exemplo.

Altere o package.json para usar servidor de live-reload.

Crie um outro cenário, com base no cenário atual, e o utilize como principal.
O cenário vai ser apenas 6 pessoas trabalhando em um escritório. Hoje no cenário atual já tem 6 pessoas trabalhando nas baias. Utilize apenas esta parte do cenário.
O personagem principal vai ficar de pé, ser controlável pelo teclado e vai poder interagir com os outros personagens, que vão estar sentados nas baias.

# Instrução

Agora faça uma integração com o Ollama local rodando o modelo Gemma4:e2b.
Cada personagem, ao começo, irá ter uma personalidade e terá uma persona definida na pasta "/personas" através de um arquivo Markdown.
As conversas serão manuais, feitas através do jogador e digitando um chat, o qual o personagem que irá responder terá a persona definida no início do jogo.
As conversas via chat serão utilizadas com o modelo ollama local.
As personas definirão o motivo para conseguirem tomar café.
Se durante a conversa o jogador conseguir, o personagem irá levantar e ir até o café, e então o jogo dirá que o jogador ganhou.

As conversas não podem ter mais do que 1000 caracteres de perguntas e 1000 de respostas.
Deixe otimizado para que o ollama responda rápido.
