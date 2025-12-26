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
    if (req.method === "POST") {
      const { userId } = req.body;
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "DELETE", headers }
      );
      return res.status(200).json({ message: "Sucesso" });
    }

    // 1. BUSCA DE TODOS OS MEMBROS (Para checar cargos)
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    // 2. BUSCA DE MENSAGENS COM PAGINAÇÃO (Até 1000 mensagens)
    let allMessages = [];
    let lastId = null;

    for (let i = 0; i < 10; i++) {
      // 10 iterações de 100 = 1000 mensagens
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

    // Regex específica baseada no seu print: "Fim das férias: DD/MM/AAAA"
    const regexDataFim = /Fim das f[eé]rias:\s*(\d{2}\/\d{2}\/\d{4})/i;

    for (const msg of allMessages) {
      // Combina o conteúdo da mensagem e de todos os Embeds para análise
      let textoParaAnalisar = msg.content || "";
      if (msg.embeds && msg.embeds.length > 0) {
        msg.embeds.forEach((embed) => {
          textoParaAnalisar += ` ${embed.title || ""} ${
            embed.description || ""
          }`;
          if (embed.fields) {
            embed.fields.forEach(
              (f) => (textoParaAnalisar += ` ${f.name} ${f.value}`)
            );
          }
        });
      }

      const matchId = textoParaAnalisar.match(/<@!?(\d+)>/);
      const matchDataFim = textoParaAnalisar.match(regexDataFim);

      if (matchId && matchDataFim) {
        const userId = matchId[1];
        if (processados.has(userId)) continue;

        const [d, m, a] = matchDataFim[1].split("/");
        const dataFim = new Date(a, m - 1, d);

        const membro = members.find((u) => u.user.id === userId);

        // --- FILTRO PCERJ (POLICE_ROLE_ID) ---
        if (membro && membro.roles.includes(POLICE_ROLE_ID)) {
          processados.add(userId);

          if (hoje > dataFim) {
            if (membro.roles.includes(FERIAS_ROLE_ID)) {
              await fetch(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                { method: "DELETE", headers }
              );
              logsRemocao.push(
                `${membro.nick || membro.user.username} (Fim: ${
                  matchDataFim[1]
                })`
              );
            }
          } else if (membro.roles.includes(FERIAS_ROLE_ID)) {
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
    console.error("Erro Férias:", error);
    res.status(500).json({ error: "Erro interno" });
  }
};
