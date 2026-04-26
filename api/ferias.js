const fetch = global.fetch || require("node-fetch");
const {
  carregarMembrosGuild,
  processarSolicitacoesFerias,
  normalizarTextoFerias,
} = require("./_utils/ferias");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID,
  } = process.env;

  const query = req.query || {};
  const body = req.body || {};
  const action = query.action || body.action || "listar";
  const org = query.org || body.org;
  const userId = query.userId || body.userId;

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const getOfficerRole = (orgValue) => {
    if (orgValue === "PRF") return PRF_ROLE_ID;
    if (orgValue === "PMERJ") return PMERJ_ROLE_ID;
    if (orgValue === "PF") return PF_ROLE_ID;
    if (orgValue === "PCERJ") return POLICE_ROLE_ID;
    return "";
  };

  const OFFICER_ROLE_TO_CHECK = getOfficerRole(org);

  const buscarMensagensFerias = async (limitePaginas) => {
    let allMessages = [];
    let lastId = null;

    for (let i = 0; i < limitePaginas; i++) {
      const url = `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100${
        lastId ? `&before=${lastId}` : ""
      }`;
      const r = await fetch(url, { headers });
      const batch = await r.json();
      if (!batch || batch.length === 0) break;
      allMessages = allMessages.concat(batch);
      lastId = batch[batch.length - 1].id;
    }

    return allMessages;
  };

  const parseDateBrFlex = (value, endOfDay = false) => {
    if (!value) return null;
    const partes = String(value).split("/");
    if (partes.length < 2) return null;
    const [d, m, anoInformado] = partes;
    const ano = Number(anoInformado || new Date().getFullYear());
    const data = new Date(ano, Number(m) - 1, Number(d));
    if (Number.isNaN(data.getTime())) return null;
    if (endOfDay) data.setHours(23, 59, 59, 999);
    else data.setHours(0, 0, 0, 0);
    return data;
  };

  const extrairTexto = (msg) => {
    let textoTotal = msg.content || "";
    if (msg.embeds) {
      msg.embeds.forEach((e) => {
        textoTotal +=
          ` ${e.title} ${e.description} ` +
          (e.fields?.map((f) => `${f.name} ${f.value}`).join(" ") || "");
      });
    }
    return textoTotal;
  };

  try {
    const resultadoProcessamento = await processarSolicitacoesFerias(process.env);

    if (action === "sincronizar") {
      return res.status(200).json({
        ok: true,
        processados: resultadoProcessamento.processados || 0,
      });
    }

    if (req.method === "POST" && action === "remover") {
      await fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${userId}/roles/${FERIAS_ROLE_ID}`,
        { method: "DELETE", headers }
      );
      return res.status(200).json({ message: "Operacao processada com sucesso." });
    }

    if (action === "periodo") {
      if (!userId || !org) {
        return res.status(400).json({
          error:
            "Parametros obrigatorios nao fornecidos: userId e org sao necessarios para esta operacao.",
        });
      }

      const allMessages = await buscarMensagensFerias(5);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      const regexDataInicio =
        /(?:inicio(?: das ferias)?|comeco|data de inicio|solicitacao|saida).*?(\d{2}\/\d{2}(?:\/\d{4})?)/i;
      const regexDataFim =
        /(?:fim(?: das ferias)?|termino|data de fim|retorno).*?(\d{2}\/\d{2}(?:\/\d{4})?)/i;

      for (const msg of allMessages) {
        const textoTotal = extrairTexto(msg);
        const textoNormalizado = normalizarTextoFerias(textoTotal);
        const matchId = textoTotal.match(/<@!?(\d+)>/);
        if (matchId && matchId[1] === userId) {
          const matchInicio = textoNormalizado.match(regexDataInicio);
          const matchFim = textoNormalizado.match(regexDataFim);

          if (matchInicio || matchFim) {
            let dataInicio = null;
            let dataFim = null;

            if (matchInicio) {
              dataInicio = parseDateBrFlex(matchInicio[1], false);
            }

            if (matchFim) {
              dataFim = parseDateBrFlex(matchFim[1], true);
            }

            if (!dataInicio && dataFim && hoje <= dataFim) {
              dataInicio = new Date(hoje);
            }

            if (dataInicio && dataFim && hoje >= dataInicio && hoje <= dataFim) {
              return res.status(200).json({
                estaEmFerias: true,
                roleVerificada: OFFICER_ROLE_TO_CHECK || null,
              });
            }

            if (dataInicio && hoje >= dataInicio) {
              const diffDias = Math.floor(
                (hoje - dataInicio) / (1000 * 60 * 60 * 24)
              );
              if (diffDias >= 0 && diffDias <= 60) {
                return res.status(200).json({
                  estaEmFerias: true,
                  roleVerificada: OFFICER_ROLE_TO_CHECK || null,
                });
              }
            }

            if (dataFim && hoje <= dataFim) {
              const diffDias = Math.floor(
                (dataFim - hoje) / (1000 * 60 * 60 * 24)
              );
              if (diffDias >= 0 && diffDias <= 60) {
                return res.status(200).json({
                  estaEmFerias: true,
                  roleVerificada: OFFICER_ROLE_TO_CHECK || null,
                });
              }
            }
          }
        }
      }

      return res.status(200).json({
        estaEmFerias: false,
        roleVerificada: OFFICER_ROLE_TO_CHECK || null,
      });
    }

    const allGuildMembers = await carregarMembrosGuild({
      headers,
      guildId: GUILD_ID,
    });

    if (!Array.isArray(allGuildMembers) || allGuildMembers.length === 0) {
      throw new Error("Falha ao recuperar a lista de membros do servidor Discord.");
    }

    const membersMap = new Map();
    allGuildMembers.forEach((m) => membersMap.set(m.user.id, m));

    const allMessages = await buscarMensagensFerias(3);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const logsRemocao = [];
    const validosParaAntecipar = [];
    const processados = new Set();
    const regexDataFim = /fim(?: das ferias)?:.*?(\d{2}\/\d{2}(?:\/\d{4})?)/i;

    for (const msg of allMessages) {
      const textoTotal = extrairTexto(msg);
      const textoNormalizado = normalizarTextoFerias(textoTotal);
      const matchId = textoTotal.match(/<@!?(\d+)>/);
      const matchData = textoNormalizado.match(regexDataFim);

      if (matchId && matchData) {
        const currentUserId = matchId[1];
        if (processados.has(currentUserId)) continue;
        processados.add(currentUserId);

        const dataFim = parseDateBrFlex(matchData[1], false);
        const membro = membersMap.get(currentUserId);

        if (
          membro &&
          OFFICER_ROLE_TO_CHECK &&
          membro.roles.includes(OFFICER_ROLE_TO_CHECK)
        ) {
          const temTagFerias = membro.roles.includes(FERIAS_ROLE_ID);

          if (hoje >= dataFim) {
            if (temTagFerias) {
              try {
                await fetch(
                  `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${currentUserId}/roles/${FERIAS_ROLE_ID}`,
                  { method: "DELETE", headers }
                );
                logsRemocao.push(
                  `${membro.nick || membro.user.username} (Ferias encerradas em: ${
                    matchData[1]
                  } - Tag removida automaticamente)`
                );
              } catch (e) {
                console.error(`Erro ao remover tag de ferias de ${currentUserId}:`, e);
              }
            }
          } else if (temTagFerias) {
            validosParaAntecipar.push({
              id: currentUserId,
              nome: membro.nick || membro.user.username,
              dataRetorno: matchData[1],
            });
          }
        }
      }
    }

    return res.status(200).json({
      oficiais: validosParaAntecipar.sort((a, b) => a.nome.localeCompare(b.nome)),
      logs: logsRemocao,
    });
  } catch (error) {
    console.error("Erro no ferias:", error);
    return res.status(500).json({
      error:
        "Erro interno no servidor durante a verificacao de ferias. Por favor, tente novamente.",
    });
  }
};
