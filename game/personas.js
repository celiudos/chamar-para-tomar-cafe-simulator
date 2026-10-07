// Personas dos personagens: um arquivo Markdown por personagem em /personas.
//
// Formato (ver personas/README.md):
//   ---
//   saudacao: primeira fala ao abrir o chat (nao gasta o modelo)
//   dica: resumo publico mostrado no HUD (Employees)
//   ---
//   # Nome
//   ## Personalidade / Jeito de falar / Situacao agora / Motivo para aceitar o cafe / Pistas...
//
// O corpo (sem o cabecalho) vira o "system prompt" do personagem no Ollama.
import { game } from "../config/index.js";

/** persona por id do personagem, preenchido por loadPersonas(). */
export const personas = new Map();

/** Separa o cabecalho `chave: valor` (entre linhas ---) do corpo Markdown. */
export function parsePersona(markdown) {
  const text = markdown.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const meta = {};
  let body = text;
  const fm = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (fm) {
    body = text.slice(fm[0].length);
    for (const line of fm[1].split("\n")) {
      const i = line.indexOf(":");
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  return {
    greeting: meta.saudacao ?? "",
    hint: meta.dica ?? "",
    body: body.trim(),
  };
}

/** Carrega a persona de cada personagem (config/characters.js -> persona). */
export async function loadPersonas(characters) {
  await Promise.all(
    characters.map(async (c) => {
      const url = `${game.chat.personasPath}/${c.persona ?? c.id}.md`;
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        personas.set(c.id, parsePersona(await res.text()));
      } catch (err) {
        console.warn(`[personas] Nao foi possivel carregar ${url}: ${err.message}`);
        personas.set(c.id, parsePersona(`# ${c.name}\n\nVocê é ${c.name}, ${c.role}. Só aceita café se for muito bem convencido(a).`));
      }
    }),
  );
  return personas;
}
