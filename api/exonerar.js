// api/exonerar.js
const path = require("path");
// Tenta carregar o .env da raiz
require("dotenv").config({ path: path.join(process.cwd(), ".env") });

// Fallback para fetch (Node 18+ nativo)
const fetch = global.fetch || require("node-fetch");

module.exports = async (req, res) => {
  // --- CONFIGURAÇÃO DE CORS ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido (Use POST)" });
  }

  const {
    Discord_Bot_Token,
    EXONERACAO_CHANNEL_ID,
    GUILD_ID,
    POLICE_ROLE_IDS,
  } = process.env;
  const { discordUser, nomeCidade, idPassaporte, cargo, action } = req.body;

  try {
    // -----------------------------------------------------------
    // 1. DETECÇÃO AUTOMÁTICA DE CARGO (PATENTE) VIA ENV
    // -----------------------------------------------------------
    let cargoExibicao = cargo || "Oficial"; // Valor padrão

    if (discordUser && POLICE_ROLE_IDS) {
      try {
        const memberRes = await fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUser}`,
          { headers: { Authorization: `Bot ${Discord_Bot_Token}` } }
        );

        if (memberRes.ok) {
          const memberData = await memberRes.json();
          const rolesDoUsuario = memberData.roles || [];
          const listaCargosPolicia = POLICE_ROLE_IDS.split(",").map((id) =>
            id.trim()
          );

          // Encontra a primeira role da lista que o usuário possui
          const cargoEncontrado = listaCargosPolicia.find((roleId) =>
            rolesDoUsuario.includes(roleId)
          );

          if (cargoEncontrado) {
            cargoExibicao = `<@&${cargoEncontrado}>`; // Menciona o cargo
          }
        }
      } catch (err) {
        console.error("Erro ao buscar patente:", err);
      }
    }

    // -----------------------------------------------------------
    // 2. MONTAGEM DA MENSAGEM (TEXTO NORMAL)
    // -----------------------------------------------------------
    const dataAtual = new Date().toLocaleDateString("pt-BR"); // Ex: 08/01/2026

    // Monta a string exatamente como pedido
    const mensagemTexto = `**Discord:** <@${discordUser}>
**Nome na cidade:** ${nomeCidade || "---"}
**ID:** ${idPassaporte || "---"}
**Patente/Cargo:** ${cargoExibicao}
**Data:** ${dataAtual}
**Motivo:** Inatividade`;

    // Envia para o canal de Logs (usando 'content' em vez de 'embeds')
    const logResponse = await fetch(
      `https://discord.com/api/v10/channels/${EXONERACAO_CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${Discord_Bot_Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: mensagemTexto }),
      }
    );

    if (!logResponse.ok) {
      console.error(`❌ Erro log: ${await logResponse.text()}`);
    }

    // -----------------------------------------------------------
    // 3. KICK DO USUÁRIO
    // -----------------------------------------------------------
    if (action === "kick" && discordUser) {
      const kickResponse = await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUser}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${Discord_Bot_Token}`,
            "Content-Type": "application/json",
            "X-Audit-Log-Reason": `Inatividade - Auditoria Automática`,
          },
        }
      );

      if (kickResponse.ok) {
        return res
          .status(200)
          .json({ success: true, msg: "Exonerado e removido." });
      } else if (kickResponse.status === 404) {
        return res
          .status(200)
          .json({ success: true, msg: "Relatório enviado (Usuário já saiu)." });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno." });
  }
};
