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

  // Captura os dados da requisição
  const { users, discordUser, nomeCidade, idPassaporte, cargo, action } =
    req.body;

  // -----------------------------------------------------------
  // FUNÇÃO AUXILIAR: PROCESSA UMA ÚNICA EXONERAÇÃO
  // -----------------------------------------------------------
  async function processarExoneracao(idDiscord, nome, passaporte, cargoBase) {
    let cargoExibicao = cargoBase || "Oficial";

    // 1. Detecção de Patente via Discord
    if (idDiscord && POLICE_ROLE_IDS) {
      try {
        const memberRes = await fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${idDiscord}`,
          { headers: { Authorization: `Bot ${Discord_Bot_Token}` } }
        );

        if (memberRes.ok) {
          const memberData = await memberRes.json();
          const rolesDoUsuario = memberData.roles || [];
          const listaCargosPolicia = POLICE_ROLE_IDS.split(",").map((id) =>
            id.trim()
          );

          const cargoEncontrado = listaCargosPolicia.find((roleId) =>
            rolesDoUsuario.includes(roleId)
          );

          if (cargoEncontrado) {
            cargoExibicao = `<@&${cargoEncontrado}>`;
          }
        }
      } catch (err) {
        console.error("Erro ao buscar patente:", err);
      }
    }

    // 2. Formatação da Mensagem
    const dataFormatada = new Date().toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const mensagemTexto = `**Discord:** <@${idDiscord}>
**Nome na cidade:** ${nome || "---"}
**ID:** ${passaporte || "---"}
**Patente/Cargo:** ${cargoExibicao}
**Data e hora:** ${dataFormatada}
**Motivo:** Inatividade (Auditoria Automática)`;

    // 3. Envio de Log
    await fetch(
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

    // 4. Execução do Kick
    if (action === "kick" && idDiscord) {
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${idDiscord}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${Discord_Bot_Token}`,
            "X-Audit-Log-Reason": `Inatividade - Auditoria Automática`,
          },
        }
      );
    }

    return true;
  }

  // -----------------------------------------------------------
  // LÓGICA DE EXECUÇÃO (INDIVIDUAL OU MASSA)
  // -----------------------------------------------------------
  try {
    // Caso receba um array de usuários (Exoneração em Massa)
    if (Array.isArray(users) && users.length > 0) {
      console.log(`Iniciando exoneração em massa: ${users.length} usuários.`);

      // Processa um por um (Sequencial para evitar spam block da API do Discord)
      for (const u of users) {
        await processarExoneracao(
          u.discordUser,
          u.nomeCidade,
          u.idPassaporte,
          u.cargo
        );
        // Pequeno delay opcional para segurança
        await new Promise((r) => setTimeout(r, 300));
      }

      return res
        .status(200)
        .json({ success: true, msg: `${users.length} oficiais processados.` });
    }

    // Caso receba apenas um usuário (Exoneração Individual antigo)
    else if (discordUser) {
      await processarExoneracao(discordUser, nomeCidade, idPassaporte, cargo);
      return res
        .status(200)
        .json({ success: true, msg: "Oficial processado individualmente." });
    }

    return res
      .status(400)
      .json({ error: "Dados insuficientes para processar." });
  } catch (error) {
    console.error("Erro no processo de exoneração:", error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
};
