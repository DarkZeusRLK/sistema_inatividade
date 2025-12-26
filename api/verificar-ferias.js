module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    POLICE_ROLE_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
  } = process.env;

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    // --- 1. LÓGICA DE ANTECIPAÇÃO (POST) ---
    if (req.method === "POST") {
      const { userId } = req.body;
      const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`;
      const response = await fetch(url, { method: "DELETE", headers });
      return res
        .status(200)
        .json({ message: "Retorno antecipado processado." });
    }

    // --- 2. VARREDURA AUTOMÁTICA (Toda vez que a API for chamada) ---
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    const msgRes = await fetch(
      `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
      { headers }
    );
    const messages = await msgRes.json();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let logs = [];

    for (const msg of messages) {
      if (msg.content.includes("Fim das férias:")) {
        const matchId = msg.content.match(/<@!?(\d+)>/);
        const matchData = msg.content.match(/(\d{2}\/\d{2}\/\d{4})/);

        if (matchId && matchData) {
          const userId = matchId[1];
          const [d, m, a] = matchData[1].split("/");
          const dataFim = new Date(a, m - 1, d);

          if (hoje > dataFim) {
            const membro = members.find((u) => u.user.id === userId);
            // Só remove se ele ainda tiver o cargo de férias
            if (membro && membro.roles.includes(FERIAS_ROLE_ID)) {
              await fetch(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                { method: "DELETE", headers }
              );
              logs.push(
                `${membro.nick || membro.user.username} (Prazo Expirado)`
              );
            }
          }
        }
      }
    }

    // --- 3. FILTRO DA LISTA (POLICIAL + FÉRIAS SIMULTANEAMENTE) ---
    const oficiaisEmFerias = members
      .filter(
        (m) =>
          m.roles.includes(POLICE_ROLE_ID) && m.roles.includes(FERIAS_ROLE_ID)
      )
      .map((m) => ({
        id: m.user.id,
        nome: m.nick || m.user.username,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    res.status(200).json({ oficiais: oficiaisEmFerias, logs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro no servidor" });
  }
};
