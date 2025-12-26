module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    POLICE_ROLE_ID, // ID exclusivo da PCERJ
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
    let processados = new Set();

    // REGEX MELHORADA: Procura especificamente o texto "Fim das férias:" antes da data
    const regexDataFim = /Fim das férias:\s*(\d{2}\/\d{2}\/\d{4})/i;

    for (const msg of messages) {
      const matchId = msg.content.match(/<@!?(\d+)>/);
      const matchDataFim = msg.content.match(regexDataFim); // Pega apenas a data de FIM

      if (matchId && matchDataFim) {
        const userId = matchId[1];
        if (processados.has(userId)) continue;

        const [d, m, a] = matchDataFim[1].split("/");
        const dataFim = new Date(a, m - 1, d);

        const membro = members.find((u) => u.user.id === userId);

        // --- FILTRO DE SEGURANÇA MÁXIMA ---
        // Só entra aqui se o membro existir E tiver o cargo de PCERJ (POLICE_ROLE_ID)
        if (membro && membro.roles.includes(POLICE_ROLE_ID)) {
          processados.add(userId);

          if (hoje > dataFim) {
            // Se venceu e ele ainda tem a tag, remove
            if (membro.roles.includes(FERIAS_ROLE_ID)) {
              await fetch(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                { method: "DELETE", headers }
              );
              logsRemocao.push(
                `${membro.nick || membro.user.username} (Prazo Vencido em ${
                  matchDataFim[1]
                })`
              );
            }
          } else if (membro.roles.includes(FERIAS_ROLE_ID)) {
            // Se NÃO venceu e tem a tag, vai para a lista de antecipação
            validosParaAntecipar.push({
              id: membro.user.id,
              nome: membro.nick || membro.user.username,
              dataRetorno: matchDataFim[1],
            });
          }
        }
      }
    }

    validosParaAntecipar.sort((a, b) => a.nome.localeCompare(b.nome));
    res.status(200).json({ oficiais: validosParaAntecipar, logs: logsRemocao });
  } catch (error) {
    res.status(500).json({ error: "Erro interno" });
  }
};
