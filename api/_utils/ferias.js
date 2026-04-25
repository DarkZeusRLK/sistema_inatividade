const { appendLog, readLogs } = require("./logs");

const fetchImpl = global.fetch || require("node-fetch");
const MAX_FERIAS_DIAS = 15;

function parseDateBr(value, endOfDay = false) {
  if (!value) return null;
  const [d, m, a] = value.split("/");
  const date = new Date(Number(a), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function diffDiasInclusivo(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 0;
  const diff = dataFim.getTime() - dataInicio.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

function diffDiasRegraFerias(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 0;
  const inicio = new Date(dataInicio);
  const fim = new Date(dataFim);
  inicio.setHours(0, 0, 0, 0);
  fim.setHours(0, 0, 0, 0);
  const diff = fim.getTime() - inicio.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function extrairTextoMensagem(msg) {
  let textoTotal = msg?.content || "";
  if (Array.isArray(msg?.embeds)) {
    msg.embeds.forEach((embed) => {
      textoTotal += ` ${embed.title || ""} ${embed.description || ""} `;
      if (Array.isArray(embed.fields)) {
        embed.fields.forEach((field) => {
          textoTotal += ` ${field.name || ""} ${field.value || ""} `;
        });
      }
    });
  }
  return textoTotal.trim();
}

function extrairSolicitacaoFerias(msg) {
  const texto = extrairTextoMensagem(msg);
  const regexDataInicio =
    /(?:In[ií]cio|Come[cç]o|Data de in[ií]cio|Sa[ií]da|Inicio).*?(\d{2}\/\d{2}\/\d{4})/i;
  const regexDataFim =
    /(?:Fim|T[eé]rmino|Data de fim|Fim das f[eé]rias|Retorno).*?(\d{2}\/\d{2}\/\d{4})/i;
  const regexMention = /<@!?(\d{17,20})>/g;

  const mentionIds = [];
  let matchMention;
  while ((matchMention = regexMention.exec(texto)) !== null) {
    mentionIds.push(matchMention[1]);
  }

  const userId =
    mentionIds[0] ||
    msg?.author?.id ||
    (Array.isArray(msg?.mentions) && msg.mentions[0] ? msg.mentions[0].id : null);

  const matchInicio = texto.match(regexDataInicio);
  const matchFim = texto.match(regexDataFim);

  const dataInicio = parseDateBr(matchInicio?.[1] || null, false);
  const dataFim = parseDateBr(matchFim?.[1] || null, true);

  let status = "reprovado";
  let motivo = "";

  if (!userId) {
    motivo = "Solicitante nao identificado.";
  } else if (!dataInicio || !dataFim) {
    motivo = "Datas de inicio e termino nao encontradas.";
  } else if (dataFim.getTime() < dataInicio.getTime()) {
    motivo = "A data de termino e anterior a data de inicio.";
  } else if (diffDiasRegraFerias(dataInicio, dataFim) > MAX_FERIAS_DIAS) {
    motivo = `O periodo solicitado ultrapassa o limite de ${MAX_FERIAS_DIAS} dias.`;
  } else {
    status = "aprovado";
  }

  return {
    messageId: msg?.id || null,
    channelId: msg?.channel_id || null,
    userId,
    texto,
    dataInicio,
    dataFim,
    periodoDias:
      dataInicio && dataFim ? diffDiasRegraFerias(dataInicio, dataFim) : 0,
    status,
    motivo,
  };
}

function normalizarPeriodoAprovado(entry) {
  if (
    !entry ||
    entry.type !== "ferias" ||
    entry.status !== "aprovado" ||
    !entry.solicitante?.id ||
    !entry.dataFim
  ) {
    return null;
  }

  const dataFim = new Date(entry.dataFim);
  if (Number.isNaN(dataFim.getTime())) return null;
  dataFim.setHours(0, 0, 0, 0);

  return {
    userId: entry.solicitante.id,
    dataFim,
  };
}

function determinarOrgDoMembro(member, env) {
  if (!member || !Array.isArray(member.roles)) return null;
  if (env.PMERJ_ROLE_ID && member.roles.includes(env.PMERJ_ROLE_ID)) return "PMERJ";
  if (env.PRF_ROLE_ID && member.roles.includes(env.PRF_ROLE_ID)) return "PRF";
  if (env.POLICE_ROLE_ID && member.roles.includes(env.POLICE_ROLE_ID)) return "PCERJ";
  if (env.PF_ROLE_ID && member.roles.includes(env.PF_ROLE_ID)) return "PF";
  return null;
}

async function fetchDiscord(url, options = {}, maxRetries = 4) {
  for (let tentativa = 0; tentativa <= maxRetries; tentativa++) {
    const response = await fetchImpl(url, options);
    if (response.status !== 429) return response;

    let retryAfter = 1;
    try {
      const data429 = await response.json();
      if (typeof data429?.retry_after === "number" && data429.retry_after > 0) {
        retryAfter = data429.retry_after;
      }
    } catch (_) {}

    await new Promise((resolve) =>
      setTimeout(resolve, Math.ceil(retryAfter * 1000) + 250)
    );
  }

  throw new Error("Discord API rate limit persistente (429).");
}

async function buscarMensagensFerias({ headers, channelId, pages = 8 }) {
  const mensagens = [];
  let before = null;

  for (let i = 0; i < pages; i++) {
    const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
      before ? `&before=${before}` : ""
    }`;
    const response = await fetchDiscord(url, { headers });
    if (!response.ok) break;
    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    mensagens.push(...batch);
    before = batch[batch.length - 1].id;
  }

  return mensagens;
}

async function processarSolicitacoesFerias(env) {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
  } = env;

  if (!Discord_Bot_Token || !GUILD_ID || !FERIAS_ROLE_ID || !FERIAS_CHANNEL_ID) {
    return { processados: 0 };
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const [membersRes, logsStore, mensagens] = await Promise.all([
    fetchDiscord(`https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`, {
      headers,
    }),
    readLogs(),
    buscarMensagensFerias({ headers, channelId: FERIAS_CHANNEL_ID }),
  ]);

  if (!membersRes.ok) {
    return { processados: 0 };
  }

  const membros = await membersRes.json();
  const membersMap = new Map();
  membros.forEach((member) => membersMap.set(member.user.id, member));

  const messageIdsJaProcessados = new Set(
    logsStore.entries
      .filter((entry) => entry.type === "ferias" && entry.sourceMessageId)
      .map((entry) => entry.sourceMessageId)
  );
  const ultimoPeriodoAprovadoPorUsuario = new Map();

  logsStore.entries.forEach((entry) => {
    const periodo = normalizarPeriodoAprovado(entry);
    if (!periodo) return;

    const atual = ultimoPeriodoAprovadoPorUsuario.get(periodo.userId);
    if (!atual || periodo.dataFim.getTime() > atual.dataFim.getTime()) {
      ultimoPeriodoAprovadoPorUsuario.set(periodo.userId, periodo);
    }
  });

  let processados = 0;

  for (const msg of mensagens.reverse()) {
    if (!msg?.id || messageIdsJaProcessados.has(msg.id)) continue;

    const solicitacao = extrairSolicitacaoFerias(msg);
    const membro = solicitacao.userId ? membersMap.get(solicitacao.userId) : null;
    const nomeSolicitante = membro
      ? membro.nick || membro.user.username
      : msg?.author?.global_name || msg?.author?.username || "Nao identificado";
    const org = determinarOrgDoMembro(membro, env);

    let status = solicitacao.status;
    let observacao = solicitacao.motivo;

    if (status === "aprovado" && !membro) {
      status = "reprovado";
      observacao = "Solicitante nao encontrado no servidor.";
    }

    if (status === "aprovado" && !org) {
      status = "reprovado";
      observacao = "Solicitante nao pertence a uma organizacao valida.";
    }

    if (status === "aprovado") {
      const ultimoPeriodo = ultimoPeriodoAprovadoPorUsuario.get(solicitacao.userId);
      const momentoSolicitacao = new Date(msg.timestamp || Date.now());
      momentoSolicitacao.setHours(0, 0, 0, 0);

      if (
        ultimoPeriodo &&
        momentoSolicitacao.getTime() < ultimoPeriodo.dataFim.getTime()
      ) {
        status = "reprovado";
        observacao =
          "Renovacao antecipada nao permitida. A nova solicitacao so pode ser feita quando chegar a data final das ferias atuais.";
      }
    }

    if (status === "aprovado" && membro && !membro.roles.includes(FERIAS_ROLE_ID)) {
      await fetchDiscord(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${solicitacao.userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "PUT", headers }
      );
    }

    if (status === "aprovado") {
      await fetchDiscord(
        `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages/${msg.id}/reactions/%E2%9C%85/@me`,
        { method: "PUT", headers }
      );
    }

    await appendLog({
      type: "ferias",
      org,
      sourceMessageId: msg.id,
      solicitante: {
        id: solicitacao.userId,
        nome: nomeSolicitante,
      },
      dataInicio: solicitacao.dataInicio
        ? solicitacao.dataInicio.toISOString()
        : null,
      dataFim: solicitacao.dataFim ? solicitacao.dataFim.toISOString() : null,
      periodoTotalDias: solicitacao.periodoDias,
      status,
      observacao,
    });

    if (status === "aprovado" && solicitacao.dataFim) {
      const dataFimNormalizada = new Date(solicitacao.dataFim);
      dataFimNormalizada.setHours(0, 0, 0, 0);
      ultimoPeriodoAprovadoPorUsuario.set(solicitacao.userId, {
        userId: solicitacao.userId,
        dataFim: dataFimNormalizada,
      });
    }

    processados += 1;
  }

  return { processados };
}

module.exports = {
  extrairSolicitacaoFerias,
  processarSolicitacoesFerias,
  parseDateBr,
  diffDiasRegraFerias,
};
