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

  // Função auxiliar para buscar um membro específico se ele não estiver na lista geral
  async function fetchMember(userId) {
    try {
      const r = await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}`,
        { headers }
      );
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }

  try {
    if (req.method === "POST") {
      const { userId } = req.body;
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "DELETE", headers }
      );
      return res.status(200).json({ message: "Sucesso" });
    }

    // 1. Busca mensagens com paginação (Até 1000)
    let allMessages = [];
    let lastId = null;
    for (let i = 0; i < 10; i++) {
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

    // Regex ultra-flexível para capturar a data após "Fim das férias"
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

        // Busca o membro (tenta direto se necessário)
        const membro = await fetchMember(userId);

        if (membro && membro.roles.includes(POLICE_ROLE_ID)) {
          const temTagFerias = membro.roles.includes(FERIAS_ROLE_ID);

          // CASO 1: DATA VENCIDA -> Adiciona no relatório de baixo
          if (hoje > dataFim) {
            if (temTagFerias) {
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
          }
          // CASO 2: DATA FUTURA -> Adiciona na lista de antecipação
          else if (temTagFerias) {
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
    res.status(500).json({ error: "Erro interno" });
  }
};
