const fetch = require("node-fetch");

module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  // Recebe dados do Frontend
  const { discordUser, nomeCidade, idPassaporte, cargo, motivo, org, action } =
    req.body;
  const { Discord_Bot_Token, EXONERACAO_CHANNEL_ID, GUILD_ID } = process.env;

  // 1. Validação de Variáveis de Ambiente
  if (!Discord_Bot_Token || !EXONERACAO_CHANNEL_ID || !GUILD_ID) {
    console.error(
      "❌ ERRO: Faltam variáveis no .env (Token, Canal ou Guild ID)."
    );
    return res.status(500).json({ error: "Erro de configuração no servidor." });
  }

  // 2. Validação de Dados Recebidos
  if (!discordUser || !motivo) {
    return res.status(400).json({ error: "Dados incompletos." });
  }

  // Definição visual baseada na ORG (Matriz)
  // Define cores e títulos baseados na organização enviada pelo painel
  const configMatriz = {
    PCERJ: { color: 0x000000, title: "POLÍCIA CIVIL" }, // Preto/Cinza
    PMERJ: { color: 0x0051ff, title: "POLÍCIA MILITAR" }, // Azul
    PRF: { color: 0xffd700, title: "POLÍCIA RODOVIÁRIA FEDERAL" }, // Amarelo
  };

  const estilo = configMatriz[org] || { color: 0xff4d4d, title: "SISTEMA" };
  const dataAtual = new Date().toLocaleDateString("pt-BR");

  try {
    // ---------------------------------------------------------
    // PASSO 1: REMOVER (KICK) O USUÁRIO DO SERVIDOR
    // ---------------------------------------------------------
    if (action === "kick") {
      const kickUrl = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${discordUser}`;

      const kickResponse = await fetch(kickUrl, {
        method: "DELETE",
        headers: {
          Authorization: `Bot ${Discord_Bot_Token}`,
          "X-Audit-Log-Reason": `Exonerado do ${estilo.title} por Inatividade`,
        },
      });

      // Se der erro, logamos no console da Discloud, mas tentamos enviar o relatório mesmo assim.
      // 404 = Usuário já saiu do servidor. 403 = Bot sem permissão (cargo baixo).
      if (!kickResponse.ok && kickResponse.status !== 404) {
        const errText = await kickResponse.text();
        console.error(`⚠️ Falha ao expulsar usuário: ${errText}`);
      }
    }

    // ---------------------------------------------------------
    // PASSO 2: ENVIAR O RELATÓRIO (LOG)
    // ---------------------------------------------------------
    const embed = {
      title: `🚨 RELATÓRIO DE EXONERAÇÃO - ${estilo.title}`,
      color: estilo.color,
      thumbnail: { url: "https://i.imgur.com/AfFp7pu.png" }, // Pode trocar por logo da org se quiser
      fields: [
        { name: "👤 Oficial", value: `<@${discordUser}>`, inline: true },
        { name: "🆔 Passaporte", value: idPassaporte || "---", inline: true },
        {
          name: "🏢 Nome na Cidade",
          value: nomeCidade || "---",
          inline: false,
        },
        { name: "🎖️ Cargo Anterior", value: cargo || "Oficial", inline: true },
        { name: "📅 Data", value: dataAtual, inline: true },
        { name: "📝 Motivo", value: `\`\`\`${motivo}\`\`\`` },
        {
          name: "⚙️ Ação",
          value: "Remoção automática do servidor.",
          inline: false,
        },
      ],
      footer: { text: `Auditoria Automática • ${org || "Sistema"}` },
      timestamp: new Date().toISOString(),
    };

    const logResponse = await fetch(
      `https://discord.com/api/v10/channels/${EXONERACAO_CHANNEL_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${Discord_Bot_Token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ embeds: [embed] }),
      }
    );

    if (logResponse.ok) {
      return res.status(200).json({ success: true });
    } else {
      const errText = await logResponse.text();
      console.error("❌ Erro Discord Log:", errText);
      return res
        .status(500)
        .json({ error: "Falha ao enviar log para o Discord." });
    }
  } catch (error) {
    console.error("❌ Erro Interno:", error);
    return res.status(500).json({ error: "Falha interna na API do Bot." });
  }
};
