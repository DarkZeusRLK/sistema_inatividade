const { appendLog, readLogs } = require("./logs");

const fetchImpl = global.fetch || require("node-fetch");
const MAX_FERIAS_DIAS = 15;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function parseDateBr(value, endOfDay = false) {
  if (!value) return null;
  const partes = String(value).split("/");
  if (partes.length < 2) return null;
  const [d, m, anoInformado] = partes;
  const anoAtual = new Date().getFullYear();
  const a = anoInformado || String(anoAtual);
  const date = new Date(Number(a), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) date.setHours(23, 59, 59, 999);
  else date.setHours(0, 0, 0, 0);
  return date;
}

function obterIndiceDia(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

function diffDiasRegraFerias(dataInicio, dataFim) {
  if (!dataInicio || !dataFim) return 0;
  const diaInicio = obterIndiceDia(new Date(dataInicio));
  const diaFim = obterIndiceDia(new Date(dataFim));
  if (diaInicio === null || diaFim === null) return 0;
  return diaFim - diaInicio;
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

function ehMensagemSolicitacaoFerias(msg) {
  const texto = normalizarTextoFerias(extrairTextoMensagem(msg));
  return texto.includes("solicitacao de ferias");
}

function normalizarTextoFerias(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extrairSolicitacaoFerias(msg) {
  const texto = extrairTextoMensagem(msg);
  const textoNormalizado = normalizarTextoFerias(texto);
  const textoBruto = String(msg?.content || texto || "");
  const regexDataInicio =
    /(?:inicio(?: das ferias)?|comeco|data de inicio|saida).*?(\d{2}\/\d{2}(?:\/\d{4})?)/i;
  const regexDataFim =
    /(?:fim(?: das ferias)?|termino|data de fim|retorno).*?(\d{2}\/\d{2}(?:\/\d{4})?)/i;
  const regexMention = /<@!?(\d{17,20})>/g;
  const regexMotivoLinha = /motivo\s*:\s*([^\n\r]+)/i;
  const regexMotivoFallback = /motivo\s*:?\s*(.+)$/i;

  const mentionIds = [];
  let matchMention;
  while ((matchMention = regexMention.exec(texto)) !== null) {
    mentionIds.push(matchMention[1]);
  }

  const userId =
    mentionIds[0] ||
    msg?.interaction_metadata?.user?.id ||
    msg?.author?.id ||
    (Array.isArray(msg?.mentions) && msg.mentions[0] ? msg.mentions[0].id : null);

  const matchInicio = textoNormalizado.match(regexDataInicio);
  const matchFim = textoNormalizado.match(regexDataFim);
  const matchMotivoBruto = textoBruto.match(regexMotivoLinha);
  const matchMotivoFallback = textoNormalizado.match(regexMotivoFallback);

  const dataInicio = parseDateBr(matchInicio?.[1] || null, false);
  const dataFim = parseDateBr(matchFim?.[1] || null, true);
  const motivoSolicitacao =
    (matchMotivoBruto?.[1] || matchMotivoFallback?.[1] || "")
      .replace(/<@!?(\d{17,20})>/g, "")
      .trim() || null;

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
    motivoSolicitacao,
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

async function carregarMembrosGuild({ headers, guildId, pages = 20 }) {
  const membros = [];
  let after = null;

  for (let i = 0; i < pages; i++) {
    const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${
      after ? `&after=${after}` : ""
    }`;
    const response = await fetchDiscord(url, { headers });
    if (!response.ok) break;

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;

    membros.push(...batch);
    after = batch[batch.length - 1]?.user?.id || null;
    if (!after || batch.length < 1000) break;
  }

  return membros;
}

function avaliarSolicitacaoFerias({
  msg,
  membersMap,
  ultimoPeriodoAprovadoPorUsuario,
  env,
}) {
  const solicitacao = extrairSolicitacaoFerias(msg);
  const membro = solicitacao.userId ? membersMap.get(solicitacao.userId) : null;
  const nomeSolicitante = membro
    ? membro.nick || membro.user.username
    : msg?.interaction_metadata?.user?.username ||
      msg?.author?.global_name ||
      msg?.author?.username ||
      "Nao identificado";
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

  return {
    solicitacao,
    membro,
    nomeSolicitante,
    org,
    status,
    observacao,
  };
}

async function listarLogsFerias(env, options = {}) {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
  } = env;
  const pages = Number(options.pages || 8);

  if (!Discord_Bot_Token || !GUILD_ID || !FERIAS_ROLE_ID || !FERIAS_CHANNEL_ID) {
    return [];
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const [membros, mensagens] = await Promise.all([
    carregarMembrosGuild({ headers, guildId: GUILD_ID }),
    buscarMensagensFerias({ headers, channelId: FERIAS_CHANNEL_ID, pages }),
  ]);

  if (!Array.isArray(membros) || membros.length === 0) {
    return [];
  }

  const membersMap = new Map();
  membros.forEach((member) => membersMap.set(member.user.id, member));

  const ultimoPeriodoAprovadoPorUsuario = new Map();
  const entries = [];

  for (const msg of mensagens.reverse()) {
    if (!msg?.id || !ehMensagemSolicitacaoFerias(msg)) continue;

    const avaliacao = avaliarSolicitacaoFerias({
      msg,
      membersMap,
      ultimoPeriodoAprovadoPorUsuario,
      env,
    });

    entries.unshift({
      id: msg.id,
      type: "ferias",
      org: avaliacao.org,
      sourceMessageId: msg.id,
      solicitante: {
        id: avaliacao.solicitacao.userId,
        nome: avaliacao.nomeSolicitante,
      },
      dataInicio: avaliacao.solicitacao.dataInicio
        ? avaliacao.solicitacao.dataInicio.toISOString()
        : null,
      dataFim: avaliacao.solicitacao.dataFim
        ? avaliacao.solicitacao.dataFim.toISOString()
        : null,
      periodoTotalDias: avaliacao.solicitacao.periodoDias,
      status: avaliacao.status,
      observacao: avaliacao.observacao,
      createdAt: msg.timestamp || new Date().toISOString(),
    });

    if (avaliacao.status === "aprovado" && avaliacao.solicitacao.dataFim) {
      const dataFimNormalizada = new Date(avaliacao.solicitacao.dataFim);
      dataFimNormalizada.setHours(0, 0, 0, 0);
      ultimoPeriodoAprovadoPorUsuario.set(avaliacao.solicitacao.userId, {
        userId: avaliacao.solicitacao.userId,
        dataFim: dataFimNormalizada,
      });
    }
  }

  return entries;
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

  const [logsStore, mensagens, membros] = await Promise.all([
    readLogs(),
    buscarMensagensFerias({ headers, channelId: FERIAS_CHANNEL_ID }),
    carregarMembrosGuild({ headers, guildId: GUILD_ID }),
  ]);

  if (!Array.isArray(membros) || membros.length === 0) {
    return { processados: 0 };
  }

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
    if (!msg?.id || !ehMensagemSolicitacaoFerias(msg)) continue;

    const avaliacao = avaliarSolicitacaoFerias({
      msg,
      membersMap,
      ultimoPeriodoAprovadoPorUsuario,
      env,
    });
    const { solicitacao, membro, nomeSolicitante, org, status, observacao } =
      avaliacao;

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

    if (messageIdsJaProcessados.has(msg.id)) continue;

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
      motivoSolicitacao: solicitacao.motivoSolicitacao,
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
  listarLogsFerias,
  carregarMembrosGuild,
  parseDateBr,
  diffDiasRegraFerias,
  normalizarTextoFerias,
};
