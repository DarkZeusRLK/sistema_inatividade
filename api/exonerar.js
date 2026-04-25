// api/exonerar.js
const path = require("path");
const { appendLog } = require("./_utils/logs");

require("dotenv").config({ path: path.join(process.cwd(), ".env") });

const fetch = global.fetch || require("node-fetch");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({
      error:
        "Metodo HTTP nao permitido. Utilize o metodo POST para esta operacao.",
    });
  }

  const {
    Discord_Bot_Token,
    EXONERACAO_CHANNEL_ID,
    GUILD_ID,
    POLICE_ROLE_IDS,
  } = process.env;

  const {
    users,
    discordUser,
    nomeCidade,
    idPassaporte,
    cargo,
    action,
    org,
    emissor,
  } = req.body;

  async function processarExoneracao(idDiscord, nome, passaporte, cargoBase) {
    let cargoExibicao = cargoBase || "Oficial";

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
**Motivo:** Inatividade`;

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

    if (action === "kick" && idDiscord) {
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${idDiscord}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bot ${Discord_Bot_Token}`,
            "X-Audit-Log-Reason": "Inatividade - Auditoria Automatica",
          },
        }
      );
    }

    return {
      discordUser: idDiscord,
      nomeCidade: nome || "---",
      idPassaporte: passaporte || "---",
      cargo: cargoBase || "Oficial",
    };
  }

  try {
    if (Array.isArray(users) && users.length > 0) {
      console.log(`Iniciando exoneracao em massa: ${users.length} usuarios.`);
      const exonerados = [];

      for (const u of users) {
        const exonerado = await processarExoneracao(
          u.discordUser,
          u.nomeCidade,
          u.idPassaporte,
          u.cargo
        );
        exonerados.push(exonerado);
        await new Promise((r) => setTimeout(r, 300));
      }

      await appendLog({
        type: "exoneracao",
        org: org || null,
        emissor: {
          nome: emissor?.nome || "Nao identificado",
          id: emissor?.id || null,
        },
        quantidadeExonerados: exonerados.length,
        exonerados,
      });

      return res.status(200).json({
        success: true,
        msg: `${users.length} oficiais processados.`,
      });
    }

    if (discordUser) {
      const exonerado = await processarExoneracao(
        discordUser,
        nomeCidade,
        idPassaporte,
        cargo
      );

      await appendLog({
        type: "exoneracao",
        org: org || null,
        emissor: {
          nome: emissor?.nome || "Nao identificado",
          id: emissor?.id || null,
        },
        quantidadeExonerados: 1,
        exonerados: [exonerado],
      });

      return res.status(200).json({
        success: true,
        msg: "Oficial processado individualmente.",
      });
    }

    return res.status(400).json({
      error:
        "Dados insuficientes para processar a solicitacao. Verifique os parametros enviados.",
    });
  } catch (error) {
    console.error("Erro no processo de exoneracao:", error);
    return res.status(500).json({
      error: "Erro interno no servidor. Por favor, tente novamente mais tarde.",
    });
  }
};
