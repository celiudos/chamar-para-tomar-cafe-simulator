# Kiro CLI

Tutorial de instalação e uso do [Kiro CLI](https://kiro.dev/cli/), baseado na
[documentação oficial](https://kiro.dev/docs/cli/).

## O que é o Kiro CLI?

O Kiro CLI é a interface de linha de comando do Kiro para desenvolver,
testar e automatizar tarefas usando instruções em linguagem natural. Ele pode
ser usado de forma interativa no terminal ou em modo headless, por exemplo em
pipelines de CI/CD.

## Requisitos

O CLI está disponível para:

- macOS;
- Windows 11 (PowerShell);
- Linux com glibc 2.34 ou superior, ou uma variante com musl.

Também é necessário ter uma conta Kiro para o login interativo. Para
automação headless, é necessário um plano Kiro compatível com a criação de
API keys.

## Instalação

O instalador oficial pode ser executado com `curl` e `bash`:

```bash
curl -fsSL https://cli.kiro.dev/install | bash
```

No Windows, execute o comando em um ambiente que forneça `curl` e `bash`,
como Git Bash ou WSL. A documentação do Kiro lista o CLI como compatível com
Windows 11 via PowerShell, mas o comando de instalação publicado atualmente é
o instalador em Bash.

Depois da instalação, abra um novo terminal caso o instalador tenha
atualizado o `PATH` e confirme que o comando está disponível:

```bash
kiro-cli --version
```

Se o shell não encontrar o comando no Linux ou macOS, confirme que
`$HOME/.local/bin` está no `PATH`:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

Para tornar a alteração permanente, adicione essa linha ao arquivo de
configuração do seu shell, como `~/.bashrc` ou `~/.zshrc`.

## Primeiro uso

### 1. Fazer login

Para iniciar o fluxo de autenticação:

```bash
kiro-cli login
```

Em um computador local, o Kiro abre o navegador para concluir o login. Em
uma máquina remota, o CLI exibe uma URL e um código de uso único; abra a URL
em outro dispositivo, informe o código e aguarde a confirmação no terminal.

Confira a identidade autenticada com:

```bash
kiro-cli whoami
```

### 2. Abrir uma sessão interativa

Entre na pasta do projeto e inicie o Kiro:

```bash
cd caminho/para/seu-projeto
kiro-cli
```

Também é possível iniciar o chat explicitamente:

```bash
kiro-cli chat
```

Descreva a tarefa no terminal, por exemplo:

```text
Analise a estrutura deste projeto, explique como executá-lo e sugira os
próximos testes que devo criar.
```

O Kiro pode pedir confirmação antes de executar ações ou usar ferramentas.
Leia cada solicitação antes de aprová-la, principalmente quando a tarefa
alterar arquivos, executar comandos ou acessar serviços externos.

### 3. Usar o CLI em outro projeto

O contexto usado pelo agente depende da pasta de onde o comando é executado.
Por isso, abra o terminal na raiz do repositório antes de iniciar uma sessão:

```bash
cd /caminho/para/o-repositorio
kiro-cli chat
```

Recursos de configuração como steering, hooks, MCP, agentes personalizados,
skills, sub-agentes, modelos e permissões são documentados na
[seção de recursos do Kiro](https://kiro.dev/docs/cli/).

## Uso headless (scripts e CI/CD)

O modo headless executa uma instrução sem interação humana. Ele exige uma API
key na variável de ambiente `KIRO_API_KEY`.

No macOS/Linux:

```bash
export KIRO_API_KEY="ksk_sua_chave_aqui"
kiro-cli chat --no-interactive "Explique a estrutura deste projeto"
```

No PowerShell:

```powershell
$env:KIRO_API_KEY = "ksk_sua_chave_aqui"
kiro-cli chat --no-interactive "Explique a estrutura deste projeto"
```

Para criar a chave, entre em [app.kiro.dev](https://app.kiro.dev), abra
**API Keys**, crie uma chave e copie-a. O valor completo só é exibido no
momento da criação.

### Aprovar ferramentas em automações

Como não há uma pessoa para aprovar cada chamada durante uma execução
headless, as permissões precisam ser definidas explicitamente:

```bash
kiro-cli chat --no-interactive \
  --trust-tools=read,grep \
  "Encontre comentários TODO e sugira uma ordem de implementação"
```

Use `--trust-all-tools` somente quando a automação realmente precisar de
acesso amplo:

```bash
kiro-cli chat --no-interactive \
  --trust-all-tools \
  "Execute os testes e corrija as falhas encontradas"
```

Uma instrução também pode ser recebida por `stdin`:

```bash
printf '%s\n' "Analise os logs e explique a falha" | \
  kiro-cli chat --no-interactive --trust-tools=read
```

Para pipelines que dependem de servidores MCP, aguarde a inicialização e
falhe se algum servidor não estiver disponível:

```bash
kiro-cli chat --no-interactive \
  --require-mcp-startup \
  --trust-tools=read,grep \
  "Use as ferramentas MCP configuradas para validar o projeto"
```

Em CI/CD, armazene `KIRO_API_KEY` como secret do provedor. Nunca coloque a
chave no código, no README ou em arquivos versionados.

## Exemplos práticos

```bash
# Pedir uma explicação sem alterar arquivos
kiro-cli chat --no-interactive \
  --trust-tools=read,grep \
  "Descreva os módulos principais e os pontos de entrada deste projeto"

# Gerar e executar testes (requer permissões de escrita e execução)
kiro-cli chat --no-interactive \
  --trust-all-tools \
  "Crie testes para o módulo de autenticação e execute a suíte"
```

## Solução de problemas

- **`kiro-cli` não encontrado:** abra um novo terminal e confira se
  `$HOME/.local/bin` (ou o diretório informado pelo instalador) está no
  `PATH`.
- **Login em servidor remoto:** execute `kiro-cli login` e conclua o device
  flow no navegador de outra máquina.
- **Automação sem credenciais:** defina `KIRO_API_KEY` no ambiente do processo;
  API keys são destinadas ao modo não interativo.
- **Ferramenta não autorizada:** substitua `--trust-all-tools` por
  `--trust-tools=<ferramentas>` e conceda apenas o necessário.

Consulte também:

- [Kiro CLI](https://kiro.dev/docs/cli/)
- [Autenticação](https://kiro.dev/docs/getting-started/authentication/)
- [Headless mode](https://kiro.dev/docs/cli/headless/)
- [Instalação e plataformas suportadas](https://kiro.dev/docs/getting-started/installation/)

# Outros

https://d-90666082a3.awsapps.com/start

https://catalog.us-east-1.prod.workshops.aws/join?access-code=a4f6-01ce52-81

https://catalog.us-east-1.prod.workshops.aws/join?access-code=77e4-075a8a-3c
