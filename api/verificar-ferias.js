module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    POLICE_ROLE_ID, // ID Único da PCERJ
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
  } = process.env;

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    if (req.method === "POST") {
      const { userId } = req.body;
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "DELETE", headers }
      );
      return res.status(200).json({ message: "Sucesso" });
    }

    // 1. Puxa membros e mensagens simultaneamente
    const [membersRes, msgRes] = await Promise.all([
      fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
        { headers }
      ),
      fetch(
        `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
        { headers }
      ),
    ]);

    const members = await membersRes.json();
    const messages = await msgRes.json();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let logsRemocao = [];
    let validosParaAntecipar = [];
    let processados = new Set(); // Evita duplicados se o bot mandou 2 msgs

    // 2. Analisa as mensagens do canal (onde o outro bot postou)
    for (const msg of messages) {
      const matchId = msg.content.match(/<@!?(\d+)>/);
      const matchData = msg.content.match(/(\d{2}\/\d{2}\/\d{4})/);

      if (matchId && matchData) {
        const userId = matchId[1];
        if (processados.has(userId)) continue;

        const [d, m, a] = matchData[1].split("/");
        const dataFim = new Date(a, m - 1, d);

        // Localiza o membro no servidor para checar os cargos
        const membro = members.find((u) => u.user.id === userId);

        // SEGURANÇA: Só processa se o membro existir e tiver o Cargo da PCERJ
        if (membro && membro.roles.includes(POLICE_ROLE_ID)) {
          processados.add(userId);

          // CASO A: Data Venceu -> Remove cargo automaticamente
          if (hoje > dataFim) {
            if (membro.roles.includes(FERIAS_ROLE_ID)) {
              await fetch(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                { method: "DELETE", headers }
              );
              logsRemocao.push(
                `${membro.nick || membro.user.username} (Retorno Automático)`
              );
            }
          }
          // CASO B: Data Futura -> Adiciona na lista de antecipação (se tiver a tag de férias)
          else if (membro.roles.includes(FERIAS_ROLE_ID)) {
            validosParaAntecipar.push({
              id: membro.user.id,
              nome: membro.nick || membro.user.username,
              dataRetorno: matchData[1],
            });
          }
        }
      }
    }

    // Ordena a lista por nome
    validosParaAntecipar.sort((a, b) => a.nome.localeCompare(b.nome));

    res.status(200).json({ oficiais: validosParaAntecipar, logs: logsRemocao });
  } catch (error) {
    console.error("Erro Férias:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
