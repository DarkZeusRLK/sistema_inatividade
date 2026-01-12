// =========================================================
// API DE VERIFICAÇÃO DE PERÍODO DE FÉRIAS
// Verifica se um usuário está no período de férias mesmo sem a tag
// =========================================================
const fetch = global.fetch || require("node-fetch");

module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID,
  } = process.env;

  const { userId, org } = req.query;

  if (!userId || !org) {
    return res.status(400).json({ error: "userId e org são obrigatórios" });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    // Determinar qual role verificar
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

    // Buscar mensagens do canal de férias
    let allMessages = [];
    let lastId = null;
    for (let i = 0; i < 5; i++) {
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

    // Regex para encontrar data de início e fim das férias
    // Procura por "Início", "Começo", "Data de início", "Solicitação" (pode ter data de início)
    const regexDataInicio = /(?:In[ií]cio|Come[cç]o|Data de in[ií]cio|Solicita[cç][aã]o|Sa[ií]da).*?(\d{2}\/\d{2}\/\d{4})/i;
    const regexDataFim = /(?:Fim|T[eé]rmino|Data de fim|Fim das f[eé]rias|Retorno).*?(\d{2}\/\d{2}\/\d{4})/i;

    // Procurar mensagens do usuário
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
      if (matchId && matchId[1] === userId) {
        const matchInicio = textoTotal.match(regexDataInicio);
        const matchFim = textoTotal.match(regexDataFim);

        if (matchInicio || matchFim) {
          let dataInicio = null;
          let dataFim = null;

          if (matchInicio) {
            const [d, m, a] = matchInicio[1].split("/");
            dataInicio = new Date(a, m - 1, d);
            dataInicio.setHours(0, 0, 0, 0);
          }

          if (matchFim) {
            const [d, m, a] = matchFim[1].split("/");
            dataFim = new Date(a, m - 1, d);
            dataFim.setHours(23, 59, 59, 999);
          }

          // Se não encontrou data de início mas tem data de fim, 
          // e a data de fim é no futuro, assume que começou hoje ou antes
          if (!dataInicio && dataFim && hoje <= dataFim) {
            dataInicio = new Date(hoje);
          }

          // Verificar se hoje está no período de férias
          if (dataInicio && dataFim) {
            // Se a data de início já passou (ou é hoje) e a data de fim ainda não chegou (ou é hoje)
            if (hoje >= dataInicio && hoje <= dataFim) {
              return res.status(200).json({ estaEmFerias: true });
            }
            // Se a data de início é no futuro mas muito próxima (até 7 dias), 
            // pode ser que a pessoa já esteja se preparando para as férias
            if (dataInicio > hoje) {
              const diffDias = Math.floor((dataInicio - hoje) / (1000 * 60 * 60 * 24));
              if (diffDias <= 7 && diffDias >= 0) {
                // Se está a menos de 7 dias do início das férias, considerar como em férias
                return res.status(200).json({ estaEmFerias: true });
              }
            }
          } else if (dataInicio && hoje >= dataInicio) {
            // Se só tem data de início e já passou, pode estar em férias
            // Considerar como em férias se a data de início foi há menos de 60 dias
            const diffDias = Math.floor((hoje - dataInicio) / (1000 * 60 * 60 * 24));
            if (diffDias >= 0 && diffDias <= 60) {
              return res.status(200).json({ estaEmFerias: true });
            }
          } else if (dataFim && hoje <= dataFim) {
            // Se só tem data de fim e ainda não chegou, pode estar em férias
            // Considerar como em férias se a data de fim é no futuro próximo (até 60 dias)
            const diffDias = Math.floor((dataFim - hoje) / (1000 * 60 * 60 * 24));
            if (diffDias >= 0 && diffDias <= 60) {
              return res.status(200).json({ estaEmFerias: true });
            }
          }
        }
      }
    }

    res.status(200).json({ estaEmFerias: false });
  } catch (error) {
    console.error("Erro ao verificar período de férias:", error);
    res.status(500).json({ error: "Erro interno no servidor" });
  }
};
