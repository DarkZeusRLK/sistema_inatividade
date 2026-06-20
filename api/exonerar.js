// api/exonerar.js
const path = require("path");

require("dotenv").config({ path: path.join(process.cwd(), ".env") });

const fetch = global.fetch || require("node-fetch");

async function appendLogEntry(entry) {
  const fs = require("fs");
  const logsPath = path.join(process.cwd(), "data", "logs.json");
  let logs = { entries: [] };
  try {
    const raw = await fs.promises.readFile(logsPath, "utf8");
    logs = JSON.parse(raw || '{"entries":[]}');
  } catch (_) {}
  if (!Array.isArray(logs.entries)) logs.entries = [];

  logs.entries.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  });

  await fs.promises.writeFile(logsPath, JSON.stringify(logs, null, 2), "utf8");
}

async function buscarNicknameEAvatar(discordId, botToken, guildId) {
  try {
    const res = await fetch(
      `https://discord.com/api/v10/guilds/${guildId}/members/${discordId}`,
      {
        headers: {
          Authorization: `Bot ${botToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) return { nick: null, avatar: null };
    const data = await res.json();
    const nick = data.nick || data.user?.global_name || data.user?.username || null;
    let avatar = null;
    if (data.user?.avatar) {
      avatar = `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.${data.user.avatar.startsWith("a_") ? "gif" : "png"}`;
    } else if (data.user?.discriminator) {
      avatar = `https://cdn.discordapp.com/embed/avatars/${Number(data.user.discriminator) % 5}.png`;
    }
    return { nick, avatar };
  } catch {
    return { nick: null, avatar: null };
  }
}

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
        const result = await processarExoneracao(
          u.discordUser,
          u.nomeCidade,
          u.idPassaporte,
          u.cargo
        );
        exonerados.push(result);
        // Delay reduzido: 150ms entre cada usuário para evitar rate limit do Discord
        await new Promise((r) => setTimeout(r, 150));
      }

      // Buscar nickname e avatar do emissor
      const emissorInfo = emissor?.id
        ? await buscarNicknameEAvatar(emissor.id, Discord_Bot_Token, GUILD_ID)
        : { nick: null, avatar: null };

      await appendLogEntry({
        type: "exoneracao",
        org: org || null,
        emissor: {
          id: emissor?.id || null,
          nome: emissor?.nome || "Nao identificado",
          nick: emissorInfo.nick,
          avatar: emissorInfo.avatar,
        },
        exonerados,
        quantidadeExonerados: exonerados.length,
      });

      return res.status(200).json({
        success: true,
        msg: `${users.length} oficiais processados.`,
      });
    }

    if (discordUser) {
      const result = await processarExoneracao(
        discordUser,
        nomeCidade,
        idPassaporte,
        cargo
      );

      // Buscar nickname e avatar do emissor
      const emissorInfo = emissor?.id
        ? await buscarNicknameEAvatar(emissor.id, Discord_Bot_Token, GUILD_ID)
        : { nick: null, avatar: null };

      await appendLogEntry({
        type: "exoneracao",
        org: org || null,
        emissor: {
          id: emissor?.id || null,
          nome: emissor?.nome || "Nao identificado",
          nick: emissorInfo.nick,
          avatar: emissorInfo.avatar,
        },
        exonerados: [result],
        quantidadeExonerados: 1,
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