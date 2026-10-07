// Definicao dos personagens.
//
// gender: "male" | "female"
// sprite: numero da sheet em public/characters/Premade_Character_48x48_<sprite>.png
// seat:   id da cadeira no mapa (objetos da camada "spawns" de public/maps/baias.json)
// dialogue.talk           -> falas ao "Conversar"
// dialogue.inviteAccept   -> falas quando aceita o convite de cafe
// dialogue.inviteDecline  -> falas quando recusa o convite de cafe

/** Personagem principal: fica de pe e e controlado pelo teclado (WASD / setas). */
export const player = {
  id: "boss",
  name: "Chefe",
  gender: "male",
  sprite: "09",
  /** Posicao inicial definida no mapa (objeto "boss" da camada "spawns"). */
  spawn: "boss",
};

/** Personagens sentados nas baias. */
export const characters = [
  {
    id: "bob",
    name: "Bob",
    gender: "male",
    role: "Desenvolvedor",
    sprite: "03",
    seat: "seat-1",
    dialogue: {
      talk: ["Quase terminando este bug...", "Esse codigo nao se escreve sozinho."],
      inviteAccept: ["Cafe? Bora!", "Preciso mesmo de uma pausa."],
      inviteDecline: ["Depois, estou no meio de um deploy.", "Me chama daqui a pouco!"],
    },
  },
  {
    id: "dave",
    name: "Dave",
    gender: "male",
    role: "Analista de dados",
    sprite: "05",
    seat: "seat-2",
    dialogue: {
      talk: ["Os numeros nao mentem.", "Estou conferindo uma planilha enorme."],
      inviteAccept: ["Com acucar, por favor!", "Aceito, preciso espairecer."],
      inviteDecline: ["Agora nao, fechando o relatorio.", "Mais tarde eu vou."],
    },
  },
  {
    id: "eve",
    name: "Eve",
    gender: "female",
    role: "Designer",
    sprite: "01",
    seat: "seat-3",
    dialogue: {
      talk: ["Estou ajustando uns pixels aqui.", "Voce viu o novo layout?"],
      inviteAccept: ["Aceito! Cafe com leite?", "Vamos, preciso de inspiracao."],
      inviteDecline: ["Estou quase entregando o layout.", "Me guarda um cafezinho!"],
    },
  },
  {
    id: "frank",
    name: "Frank",
    gender: "male",
    role: "Suporte",
    sprite: "06",
    seat: "seat-4",
    dialogue: {
      talk: ["Mais um chamado na fila...", "Ja tentou reiniciar?"],
      inviteAccept: ["Eu pago o primeiro cafe!", "Salvou meu dia."],
      inviteDecline: ["Tenho um chamado urgente.", "Hoje nao da, desculpa."],
    },
  },
  {
    id: "carol",
    name: "Carol",
    gender: "female",
    role: "Gerente de projetos",
    sprite: "04",
    seat: "seat-5",
    dialogue: {
      talk: ["Reuniao as tres, nao esquece.", "O prazo esta apertado."],
      inviteAccept: ["Boa ideia, vamos ao cafe!", "Cinco minutos e eu vou."],
      inviteDecline: ["Estou fechando o cronograma.", "Hoje nao, tenho reuniao."],
    },
  },
  {
    id: "alice",
    name: "Alice",
    gender: "female",
    role: "Qualidade (QA)",
    sprite: "02",
    seat: "seat-6",
    dialogue: {
      talk: ["Achei mais um bug.", "Preciso testar isso de novo."],
      inviteAccept: ["Vou sim, cafe forte!", "Topo, so salvo meu teste."],
      inviteDecline: ["Estou no meio de um teste.", "Daqui a pouco, prometo."],
    },
  },
];
