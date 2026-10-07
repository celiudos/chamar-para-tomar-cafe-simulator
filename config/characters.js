// Definicao dos personagens.
//
// gender:  "male" | "female"
// sprite:  numero da sheet em public/characters/Premade_Character_48x48_<sprite>.png
// seat:    id da cadeira no mapa (objetos da camada "spawns" de public/maps/baias.json)
// role/gender: parte FIXA da persona, junto com o arquivo Markdown em /personas (<persona>.md),
//          que traz personalidade e jeito de falar. Palavra secreta, categoria,
//          pistas e dificuldade sao criados a cada partida na tela de loading (game/scenario.js).
// persona: nome do arquivo em /personas (sem .md).

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
    persona: "bob",
  },
  {
    id: "dave",
    name: "Dave",
    gender: "male",
    role: "Analista de dados",
    sprite: "05",
    seat: "seat-2",
    persona: "dave",
  },
  {
    id: "eve",
    name: "Eve",
    gender: "female",
    role: "Designer",
    sprite: "01",
    seat: "seat-3",
    persona: "eve",
  },
  {
    id: "frank",
    name: "Frank",
    gender: "male",
    role: "Suporte",
    sprite: "06",
    seat: "seat-4",
    persona: "frank",
  },
  {
    id: "carol",
    name: "Carol",
    gender: "female",
    role: "Gerente de projetos",
    sprite: "04",
    seat: "seat-5",
    persona: "carol",
  },
  {
    id: "alice",
    name: "Alice",
    gender: "female",
    role: "Qualidade (QA)",
    sprite: "02",
    seat: "seat-6",
    persona: "alice",
  },
];
