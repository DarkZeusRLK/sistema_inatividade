// api/exonerar.js - VERSÃO SERVERLESS (Vercel)
const fetch = global.fetch || require("node-fetch");

module.exports = async (req, res) => {
  // Configuração CORS (Permite que seu site acesse a API)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // Responde rápido a pre-flight requests do navegador
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  // Pegando as variáveis do .env da Vercel
  const { Discord_Bot_Token, GUILD_ID, EXONERACAO_CHANNEL_ID } = process.env;

  if (!Discord_Bot_Token || !GUILD_ID || !EXONERACAO_CHANNEL_ID) {
    return res
      .status(500)
      .json({ error: "Erro de configuração (.env) na Vercel." });
  }

  // Dados vindos do Frontend (script.js)
  const { discordUser, motivo, idPassaporte, nomeCidade, cargo, org, action } =
    req.body;

  if (!discordUser || !motivo) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  try {
    // ------------------------------------------------------------------
    // AÇÃO 1: EXPULSAR (KICK) O USUÁRIO
    // Usamos a API REST do Discord diretamente
    // ------------------------------------------------------------------
    if (action === "kick") {
      const kickUrl = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUser}`;

      const kickRes = await fetch(kickUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${Discord_Bot_Token}`,
          "X-Audit-Log-Reason": motivo, // Aparece no Audit Log do Discord
        },
      });

      // Se der erro (exceto 404 - usuário já saiu), logamos o erro
      if (!kickRes.ok && kickRes.status !== 404) {
        const errTxt = await kickRes.text();
        console.error("Erro ao expulsar:", errTxt);
        // Não paramos o código, pois precisamos mandar o relatório mesmo assim
      }
    }

    // ------------------------------------------------------------------
    // AÇÃO 2: ENVIAR O EMBED (RELATÓRIO)
    // ------------------------------------------------------------------
    const configCores = {
      PCERJ: 0x000000,
      PMERJ: 0x0051ff,
      PRF: 0xffd700,
    };

    const embed = {
      title: `🚨 EXONERAÇÃO - ${org || "SISTEMA"}`,
      color: configCores[org] || 0xff4d4d,
      thumbnail: { url: "https://i.imgur.com/AfFp7pu.png" },
      fields: [
        { name: "👤 Oficial", value: `<@${discordUser}>`, inline: true },
        { name: "🆔 Passaporte", value: idPassaporte || "---", inline: true },
        { name: "🏢 Nome", value: nomeCidade || "---", inline: false },
        { name: "🎖️ Cargo", value: cargo || "---", inline: true },
        { name: "📝 Motivo", value: `\`\`\`${motivo}\`\`\`` },
        { name: "⚙️ Status", value: "✅ Exonerado e Removido", inline: false },
      ],
      footer: { text: "Auditoria Automática • Vercel" },
      timestamp: new Date().toISOString(),
    };

    const msgUrl = `https://discord.com/api/v10/channels/${EXONERACAO_CHANNEL_ID}/messages`;

    const msgRes = await fetch(msgUrl, {
      method: "POST",
      headers: {
        Authorization: `Bot ${Discord_Bot_Token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!msgRes.ok) {
      const msgErr = await msgRes.text();
      throw new Error(`Erro ao enviar log: ${msgErr}`);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno na Vercel." });
  }
};
