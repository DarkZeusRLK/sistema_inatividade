// api/exonerar.js
const fetch = require("node-fetch");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const { discordUser, nomeCidade, idPassaporte, cargo, motivo } = req.body;
  const { Discord_Bot_Token, EXONERACAO_CHANNEL_ID } = process.env;

  const dataAtual = new Date().toLocaleDateString("pt-BR");

  const mensagem = {
    content:
      `**RELATÓRIO DE EXONERAÇÃO**\n\n` +
      `**Discord:** <@${discordUser}>\n` +
      `**Nome na cidade:** ${nomeCidade}\n` +
      `**ID:** ${idPassaporte}\n` +
      `**Patente/Cargo:** ${cargo}\n` +
      `**Data:** ${dataAtual}\n` +
      `**Motivo:** ${motivo}`,
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
        body: JSON.stringify(mensagem),
      }
    );

    if (response.ok) {
      return res.status(200).json({ success: true });
    } else {
      const err = await response.text();
      return res.status(500).json({ error: err });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
