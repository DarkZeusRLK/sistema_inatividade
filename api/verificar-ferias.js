module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
  } = process.env;

  const { org } = req.query;

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const OFFICER_ROLE_TO_CHECK =
    org === "PRF"
      ? PRF_ROLE_ID
      : org === "PMERJ"
      ? PMERJ_ROLE_ID
      : POLICE_ROLE_ID;

  try {
    // MÉTODO POST: Antecipação de volta
    if (req.method === "POST") {
      const { userId } = req.body;
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "DELETE", headers }
      );
      return res.status(200).json({ message: "Sucesso" });
    }

    // 1. BUSCA TODOS OS MEMBROS DE UMA VEZ (Otimização principal)
    // Isso evita fazer um fetch por usuário dentro do loop
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const allGuildMembers = await membersRes.json();

    if (!Array.isArray(allGuildMembers)) {
      throw new Error("Não foi possível carregar a lista de membros.");
    }

    // Criamos um mapa para busca rápida por ID
    const membersMap = new Map();
    allGuildMembers.forEach((m) => membersMap.set(m.user.id, m));

    // 2. Busca mensagens do canal de férias (últimas 300 mensagens costumam bastar)
    let allMessages = [];
    let lastId = null;
    for (let i = 0; i < 3; i++) {
      const url = `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100${
        lastId ? `&before=${lastId}` : ""
      }`;
      const r = await fetch(url, { headers });
      const batch = await r.json();
      if (!batch || batch.length === 0) break;
      allMessages = allMessages.concat(batch);
      lastId = batch[batch.length - 1].id;
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let logsRemocao = [];
    let validosParaAntecipar = [];
    let processados = new Set();

    const regexDataFim = /Fim das f[eé]rias:.*?(\d{2}\/\d{2}\/\d{4})/i;

    for (const msg of allMessages) {
      let textoTotal = msg.content || "";
      if (msg.embeds) {
        msg.embeds.forEach((e) => {
          textoTotal +=
            ` ${e.title} ${e.description} ` +
            (e.fields?.map((f) => `${f.name} ${f.value}`).join(" ") || "");
        });
      }

      const matchId = textoTotal.match(/<@!?(\d+)>/);
      const matchData = textoTotal.match(regexDataFim);

      if (matchId && matchData) {
        const userId = matchId[1];
        if (processados.has(userId)) continue;
        processados.add(userId);

        const [d, m, a] = matchData[1].split("/");
        const dataFim = new Date(a, m - 1, d);

        // 3. BUSCA NO MAPA EM MEMÓRIA (Instantâneo)
        const membro = membersMap.get(userId);

        if (membro && membro.roles.includes(OFFICER_ROLE_TO_CHECK)) {
          const temTagFerias = membro.roles.includes(FERIAS_ROLE_ID);

          if (hoje > dataFim) {
            if (temTagFerias) {
              // Remove a tag de quem já venceu
              await fetch(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                { method: "DELETE", headers }
              );
              logsRemocao.push(
                `${membro.nick || membro.user.username} (Vencido em: ${
                  matchData[1]
                })`
              );
            }
          } else if (temTagFerias) {
            validosParaAntecipar.push({
              id: userId,
              nome: membro.nick || membro.user.username,
              dataRetorno: matchData[1],
            });
          }
        }
      }
    }

    res.status(200).json({
      oficiais: validosParaAntecipar.sort((a, b) =>
        a.nome.localeCompare(b.nome)
      ),
      logs: logsRemocao,
    });
  } catch (error) {
    console.error("Erro no verificar-ferias:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
