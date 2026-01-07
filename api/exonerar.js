// api/exonerar.js
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  // Configuração de CORS Básica para evitar bloqueios de navegador
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { discordUser, nomeCidade, idPassaporte, cargo, motivo } = req.body;
  const { Discord_Bot_Token, EXONERACAO_CHANNEL_ID } = process.env;

  // 1. Validação de Variáveis de Ambiente
  if (!Discord_Bot_Token || !EXONERACAO_CHANNEL_ID) {
    console.error(
      "❌ ERRO: Discord_Bot_Token ou EXONERACAO_CHANNEL_ID não configurados na Vercel."
    );
    return res.status(500).json({
      error: "Configuração do servidor incompleta (Token/Canal faltando).",
    });
  }

  // 2. Validação de Dados Recebidos
  if (!discordUser || !motivo) {
    return res
      .status(400)
      .json({ error: "Dados incompletos para a exoneração." });
  }

  const dataAtual = new Date().toLocaleDateString("pt-BR");

  // Estrutura do Embed (Mais profissional que mensagem de texto)
  const embed = {
    title: "📑 RELATÓRIO DE EXONERAÇÃO",
    color: 0xff4d4d, // Vermelho
    fields: [
      { name: "👤 Oficial", value: `<@${discordUser}>`, inline: true },
      { name: "🆔 ID Cidade", value: idPassaporte || "---", inline: true },
      { name: "🏢 Nome na Cidade", value: nomeCidade || "---", inline: false },
      { name: "🎖️ Última Patente", value: cargo || "Oficial", inline: true },
      { name: "📅 Data", value: dataAtual, inline: true },
      { name: "📝 Motivo", value: `\`\`\`${motivo}\`\`\`` },
    ],
    timestamp: new Date(),
  };

  try {
    const response = await fetch(
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

    const resultText = await response.text();

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      console.error("❌ Discord API Error:", resultText);
      return res.status(response.status).json({
        error: "O Discord recusou o envio. Verifique as permissões do Bot.",
      });
    }
  } catch (error) {
    console.error("❌ Erro de Conexão:", error);
    return res
      .status(500)
      .json({ error: "Falha ao conectar com o servidor do Discord." });
  }
};
