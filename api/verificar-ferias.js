// =========================================================
// API DE VERIFICAÇÃO DE FÉRIAS (FILTRO POR MATRIZ)
// =========================================================
const { processarFerias } = require("./_ferias-service");

module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID, // PCERJ
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID, // <--- Adicionado
  } = process.env;

  const { org } = req.query;

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    // MÉTODO POST: Antecipação de volta
    if (req.method === "POST") {
      const { userId } = req.body;
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "DELETE", headers }
      );
      return res.status(200).json({ message: "Operação processada com sucesso." });
    }

    if (!org) {
      return res.status(400).json({ error: "Parâmetro 'org' é obrigatório." });
    }

    const data = await processarFerias({
      org,
      env: {
        Discord_Bot_Token,
        GUILD_ID,
        FERIAS_ROLE_ID,
        FERIAS_CHANNEL_ID,
        POLICE_ROLE_ID,
        PRF_ROLE_ID,
        PMERJ_ROLE_ID,
        PF_ROLE_ID,
      },
    });

    res.status(200).json(data);
  } catch (error) {
    console.error("Erro no verificar-ferias:", error);
    res.status(500).json({ error: "Erro interno no servidor durante a verificação de férias. Por favor, tente novamente." });
  }
};
