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
      return res.status(200).json({ message: "Operação processada com sucesso." });
    }

    // 1. Busca todos os membros
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const allGuildMembers = await membersRes.json();

    if (!Array.isArray(allGuildMembers)) {
      throw new Error("Falha ao recuperar a lista de membros do servidor Discord.");
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
    let logsAplicacao = [];
    let validosParaAntecipar = [];
    let processados = new Set();

    const regexDataInicio =
      /(?:In[ií]cio|Come[cç]o|Data de in[ií]cio|Solicita[cç][aã]o|Sa[ií]da).*?(\d{2}\/\d{2}\/\d{4})/i;
    const regexDataFim =
      /(?:Fim|T[eé]rmino|Data de fim|Fim das f[eé]rias|Retorno).*?(\d{2}\/\d{2}\/\d{4})/i;

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
      const matchDataInicio = textoTotal.match(regexDataInicio);
      const matchDataFim = textoTotal.match(regexDataFim);

      if (matchId && (matchDataInicio || matchDataFim)) {
        const userId = matchId[1];
        if (processados.has(userId)) continue;
        processados.add(userId);

        let dataInicio = null;
        let dataFim = null;

        if (matchDataInicio) {
          const [d, m, a] = matchDataInicio[1].split("/");
          dataInicio = new Date(a, m - 1, d);
          dataInicio.setHours(0, 0, 0, 0);
        }
        if (matchDataFim) {
          const [d, m, a] = matchDataFim[1].split("/");
          dataFim = new Date(a, m - 1, d);
          dataFim.setHours(23, 59, 59, 999);
        }

        const membro = membersMap.get(userId);

        // --- VERIFICAÇÃO RIGOROSA: Deve pertencer à ROLE da organização selecionada ---
        if (
          membro &&
          OFFICER_ROLE_TO_CHECK &&
          membro.roles.includes(OFFICER_ROLE_TO_CHECK)
        ) {
          const temTagFerias = membro.roles.includes(FERIAS_ROLE_ID);

          let deveAplicarTag = false;
          if (dataInicio && dataFim) {
            if (hoje >= dataInicio && hoje <= dataFim) {
              deveAplicarTag = true;
            } else if (dataInicio > hoje) {
              const diffDias = Math.floor(
                (dataInicio - hoje) / (1000 * 60 * 60 * 24)
              );
              if (diffDias <= 7 && diffDias >= 0) {
                deveAplicarTag = true;
              }
            }
          } else if (dataInicio && !dataFim) {
            const diffDias = Math.floor(
              (hoje - dataInicio) / (1000 * 60 * 60 * 24)
            );
            if (diffDias >= 0 && diffDias <= 60) {
              deveAplicarTag = true;
            }
          } else if (!dataInicio && dataFim) {
            const diffDias = Math.floor(
              (dataFim - hoje) / (1000 * 60 * 60 * 24)
            );
            if (diffDias >= 0 && diffDias <= 60) {
              deveAplicarTag = true;
            }
          }

          // Se a data de fim já passou, remover a tag automaticamente
          if (dataFim && hoje >= dataFim) {
            if (temTagFerias) {
              try {
                await fetch(
                  `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                  { method: "DELETE", headers }
                );
                logsRemocao.push(
                  `${membro.nick || membro.user.username} (Férias encerradas em: ${
                    matchDataFim[1]
                  } - Tag removida automaticamente)`
                );
              } catch (e) {
                console.error(`Erro ao remover tag de férias de ${userId}:`, e);
              }
            }
          } else if (!temTagFerias && deveAplicarTag) {
            try {
              await fetch(
                `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
                { method: "PUT", headers }
              );
              try {
                const emojiCheck = encodeURIComponent("✅");
                await fetch(
                  `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages/${msg.id}/reactions/${emojiCheck}/@me`,
                  { method: "PUT", headers }
                );
              } catch (e) {
                console.error(
                  `Erro ao reagir com check na mensagem ${msg.id}:`,
                  e
                );
              }
              logsAplicacao.push(
                `${membro.nick || membro.user.username} (Tag de férias aplicada automaticamente)`
              );
            } catch (e) {
              console.error(`Erro ao aplicar tag de férias em ${userId}:`, e);
            }
          } else if (temTagFerias && dataFim) {
            validosParaAntecipar.push({
              id: userId,
              nome: membro.nick || membro.user.username,
              dataRetorno: matchDataFim[1],
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
      logsAplicacao,
    });
  } catch (error) {
    console.error("Erro no verificar-ferias:", error);
    res.status(500).json({ error: "Erro interno no servidor durante a verificação de férias. Por favor, tente novamente." });
  }
};
