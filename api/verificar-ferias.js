module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    POLICE_ROLE_ID, // Cargo PCERJ
    FERIAS_ROLE_ID, // Cargo de Férias
    FERIAS_CHANNEL_ID, // Canal de logs de férias
  } = process.env;

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    // --- LÓGICA DE ANTECIPAÇÃO (POST) ---
    if (req.method === "POST") {
      const { userId } = req.body;
      if (!userId)
        return res.status(400).json({ error: "ID do usuário não fornecido." });

      const url = `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`;
      const response = await fetch(url, { method: "DELETE", headers });

      if (response.ok || response.status === 404) {
        return res
          .status(200)
          .json({ message: "Férias antecipadas com sucesso!" });
      }
      return res.status(500).json({ error: "Erro ao remover cargo." });
    }

    // --- LÓGICA DE VERIFICAÇÃO E LISTAGEM (GET) ---

    // 1. Puxar todos os membros para filtrar quem é PCERJ
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();
    const oficiaisPcerj = members.filter((m) =>
      m.roles.includes(POLICE_ROLE_ID)
    );

    // 2. Puxar as últimas mensagens do canal de férias
    const msgRes = await fetch(
      `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
      { headers }
    );
    const messages = await msgRes.json();

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    let logsProcessamento = [];

    // 3. Varredura Automática (Verifica se a data de fim já passou)
    for (const msg of messages) {
      if (msg.content.includes("Fim das férias:")) {
        const matchId = msg.content.match(/<@!?(\d+)>/);
        const matchDataFim = msg.content.match(
          /Fim das férias:\s*(\d{2}\/\d{2}\/\d{4})/
        );

        if (matchId && matchDataFim) {
          const userId = matchId[1];
          const [dia, mes, ano] = matchDataFim[1].split("/");
          const dataFim = new Date(ano, mes - 1, dia);

          if (hoje > dataFim) {
            const membro = members.find((m) => m.user.id === userId);
            if (membro && membro.roles.includes(FERIAS_ROLE_ID)) {
              // Remove a tag automaticamente pois o prazo venceu
              await fetch(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                {
                  method: "DELETE",
                  headers,
                }
              );
              logsProcessamento.push(
                `Tag de ${
                  membro.nick || membro.user.username
                } removida (Prazo vencido).`
              );
            }
          }
        }
      }
    }

    // 4. Retorna a lista para o Comandante selecionar
    const listaParaSelect = oficiaisPcerj
      .map((m) => ({
        id: m.user.id,
        nome: m.nick || m.user.username,
        emFerias: m.roles.includes(FERIAS_ROLE_ID),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));

    res
      .status(200)
      .json({ oficiais: listaParaSelect, logs: logsProcessamento });
  } catch (error) {
    res.status(500).json({ error: "Erro ao processar férias." });
  }
};
