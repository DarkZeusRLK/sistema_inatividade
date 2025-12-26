module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID, // Global (Igual para todos)
    FERIAS_CHANNEL_ID, // Global (Igual para todos)
    POLICE_ROLE_ID, // PCERJ
    PRF_ROLE_ID, // PRF
    PMERJ_ROLE_ID, // PMERJ
  } = process.env;

  const { org } = req.query; // Recebe 'PCERJ', 'PRF' ou 'PMERJ'

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  // Define qual cargo de "Oficial/Membro" filtrar baseado na organização logada
  const OFFICER_ROLE_TO_CHECK =
    org === "PRF"
      ? PRF_ROLE_ID
      : org === "PMERJ"
      ? PMERJ_ROLE_ID
      : POLICE_ROLE_ID;

  // Função auxiliar para buscar um membro específico
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
    // MÉTODO POST: Executa a antecipação (Remoção manual da tag)
    if (req.method === "POST") {
      const { userId } = req.body;
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "DELETE", headers }
      );
      return res.status(200).json({ message: "Sucesso" });
    }

    // 1. Busca mensagens com paginação no canal ÚNICO de férias
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

    // Regex para capturar a data após "Fim das férias"
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

        // Busca o membro para validar a organização e a tag
        const membro = await fetchMember(userId);

        // VALIDAÇÃO CRUCIAL:
        // Verifica se o membro pertence à organização que está auditando agora
        if (membro && membro.roles.includes(OFFICER_ROLE_TO_CHECK)) {
          const temTagFerias = membro.roles.includes(FERIAS_ROLE_ID);

          // CASO 1: DATA VENCIDA -> Remove a tag automaticamente
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
          // CASO 2: DATA FUTURA -> Adiciona na lista de antecipação do select
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
    console.error("Erro no verificar-ferias:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
