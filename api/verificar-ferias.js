// =========================================================
// API DE VERIFICAÇÃO DE FÉRIAS (FILTRO POR MATRIZ)
// =========================================================
const fetch = global.fetch || require("node-fetch");

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

  // --- CORREÇÃO DA LÓGICA DE FILTRO POR MATRIZ ---
  let OFFICER_ROLE_TO_CHECK = "";

  if (org === "PRF") {
    OFFICER_ROLE_TO_CHECK = PRF_ROLE_ID;
  } else if (org === "PMERJ") {
    OFFICER_ROLE_TO_CHECK = PMERJ_ROLE_ID;
  } else if (org === "PF") {
    OFFICER_ROLE_TO_CHECK = PF_ROLE_ID;
  } else if (org === "PCERJ") {
    OFFICER_ROLE_TO_CHECK = POLICE_ROLE_ID;
  }

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

    // 1. Busca todos os membros
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const allGuildMembers = await membersRes.json();

    if (!Array.isArray(allGuildMembers)) {
      throw new Error("Não foi possível carregar a lista de membros.");
    }

    const membersMap = new Map();
    allGuildMembers.forEach((m) => membersMap.set(m.user.id, m));

    // 2. Busca mensagens do canal de férias
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

        const membro = membersMap.get(userId);

        // --- VERIFICAÇÃO RIGOROSA: Deve pertencer à ROLE da organização selecionada ---
        if (
          membro &&
          OFFICER_ROLE_TO_CHECK &&
          membro.roles.includes(OFFICER_ROLE_TO_CHECK)
        ) {
          const temTagFerias = membro.roles.includes(FERIAS_ROLE_ID);

          // Se a data de fim já passou, remover a tag automaticamente
          if (hoje >= dataFim) {
            if (temTagFerias) {
              try {
                await fetch(
                  `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                  { method: "DELETE", headers }
                );
                logsRemocao.push(
                  `${membro.nick || membro.user.username} (Férias encerradas em: ${
                    matchData[1]
                  } - Tag removida automaticamente)`
                );
              } catch (e) {
                console.error(`Erro ao remover tag de férias de ${userId}:`, e);
              }
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
