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
      await fetch(url, { method: "DELETE", headers });
      return res.status(200).json({ message: "Sucesso" });
    }

    // --- 2. BUSCA DE DADOS ---
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
    let mapaDatasFim = {}; // userId -> Date object

    // --- 3. MAPEAMENTO DE DATAS E REMOÇÃO AUTOMÁTICA ---
    for (const msg of messages) {
      const matchId = msg.content.match(/<@!?(\d+)>/);
      const matchData = msg.content.match(/(\d{2}\/\d{2}\/\d{4})/);

      if (matchId && matchData) {
        const userId = matchId[1];
        const [d, m, a] = matchData[1].split("/");
        const dataFim = new Date(a, m - 1, d);

        // Se houver mais de uma mensagem do mesmo usuário, pegamos a mais recente (dataFim maior)
        if (!mapaDatasFim[userId] || dataFim > mapaDatasFim[userId]) {
          mapaDatasFim[userId] = dataFim;
        }

        // Verificação de expiração imediata
        if (hoje > dataFim) {
          const membro = members.find((u) => u.user.id === userId);
          if (membro && membro.roles.includes(FERIAS_ROLE_ID)) {
            await fetch(
              `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
              { method: "DELETE", headers }
            );
            logsRemocao.push(
              `${membro.nick || membro.user.username} (Prazo Vencido)`
            );
          }
        }
      }
    }

    // --- 4. FILTRO ESTREITO PARA A LISTA DE ANTECIPAÇÃO ---
    // Regras:
    // 1. Deve ter o POLICE_ROLE_ID
    // 2. Deve ter o FERIAS_ROLE_ID
    // 3. A data de fim de férias deve ser MAIOR OU IGUAL a hoje (não expirou)
    const listaFinal = members
      .filter((m) => {
        const temCargos =
          m.roles.includes(POLICE_ROLE_ID) && m.roles.includes(FERIAS_ROLE_ID);
        const dataFim = mapaDatasFim[m.user.id];

        // Se não acharmos a data no canal, por segurança, mantemos na lista se tiver a tag
        const aindaNaoExpirou = dataFim ? dataFim >= hoje : true;

        return temCargos && aindaNaoExpirou;
      })
      .map((m) => ({
        id: m.user.id,
        nome: m.nick || m.user.username,
        dataRetorno: mapaDatasFim[m.user.id]
          ? mapaDatasFim[m.user.id].toLocaleDateString("pt-BR")
          : "Não informada",
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    res.status(200).json({ oficiais: listaFinal, logs: logsRemocao });
  } catch (error) {
    res.status(500).json({ error: "Erro interno" });
  }
};
