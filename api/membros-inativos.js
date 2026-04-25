// api/membros-inativos.js
const { processarSolicitacoesFerias } = require("./_utils/ferias");
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    ADMISSAO_CHANNEL_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ADMISSAO_CH,
    PF_ADMISSAO_CH,
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID,
    CARGOS_IMUNES,
    POLICE_ROLE_IDS,
    CHAT_ID_BUSCAR,
  } = process.env;

  if (!Discord_Bot_Token) {
    return res
      .status(500)
      .json({ error: "Configuracao incompleta: Token do Bot ausente." });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    await processarSolicitacoesFerias(process.env);

    const fetch = global.fetch || require("node-fetch");
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    const fetchDiscord = async (url, options = {}, maxRetries = 5) => {
      for (let tentativa = 0; tentativa <= maxRetries; tentativa++) {
        const response = await fetch(url, options);
        if (response.status !== 429) return response;

        let retryAfter = 1;
        try {
          const data429 = await response.json();
          if (
            data429 &&
            typeof data429.retry_after === "number" &&
            data429.retry_after > 0
          ) {
            retryAfter = data429.retry_after;
          }
        } catch (_) {}

        await sleep(Math.ceil(retryAfter * 1000) + 250);
      }
      throw new Error("Discord API rate limit persistente (429).");
    };

    const lerBodyJson = async () => {
      if (req.method !== "POST") return {};
      if (req.body && typeof req.body === "object") return req.body;
      if (typeof req.body === "string") {
        try {
          return JSON.parse(req.body);
        } catch (_) {
          return {};
        }
      }

      return await new Promise((resolve) => {
        let raw = "";
        req.on("data", (chunk) => {
          raw += chunk;
        });
        req.on("end", () => {
          if (!raw) return resolve({});
          try {
            resolve(JSON.parse(raw));
          } catch (_) {
            resolve({});
          }
        });
        req.on("error", () => resolve({}));
      });
    };

    const body = await lerBodyJson();
    const orgRaw =
      (req.query && req.query.org) ||
      (body && typeof body.org === "string" && body.org);
    const org = typeof orgRaw === "string" ? orgRaw.trim() : "";

    let canalAdmissaoId = ADMISSAO_CHANNEL_ID;
    let cargoBaseOrg = POLICE_ROLE_ID;

    if (org === "PRF") {
      canalAdmissaoId = PRF_ADMISSAO_CH;
      cargoBaseOrg = PRF_ROLE_ID;
    } else if (org === "PMERJ") {
      canalAdmissaoId = PMERJ_ADMISSAO_CH;
      cargoBaseOrg = PMERJ_ROLE_ID;
    } else if (org === "PF") {
      canalAdmissaoId = PF_ADMISSAO_CH;
      cargoBaseOrg = PF_ROLE_ID;
    }

    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? Array.from(
          new Set(
            CHAT_ID_BUSCAR.split(/[,\n;]+/)
              .map((entrada) => {
                const match = (entrada || "").match(/\d{17,20}/);
                return match ? match[0] : "";
              })
              .filter((id) => id)
          )
        )
      : [];

    const SEARCH_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
    const TIME_LIMIT = Date.now() - SEARCH_DAYS_MS;
    const DATA_BASE_AUDITORIA = new Date("2025-12-08T00:00:00").getTime();

    const startRequestTime = Date.now();
    const maxExecRaw =
      (body && body.maxExecMs) || (req.query && req.query.maxExecMs);
    const maxPagesRaw =
      (body && body.maxPagesPerBatch) ||
      (req.query && req.query.maxPagesPerBatch);

    const MAX_EXECUTION_MS = Math.max(
      2500,
      Math.min(9000, Number(maxExecRaw) || 7000)
    );
    const MAX_PAGES_PER_BATCH = Math.max(
      2,
      Math.min(60, Number(maxPagesRaw) || 18)
    );

    const cursorEntrada =
      body && body.cursor && typeof body.cursor === "object" ? body.cursor : null;
    const cursorValido =
      cursorEntrada &&
      cursorEntrada.version === 1 &&
      cursorEntrada.org === org &&
      !Array.isArray(cursorEntrada);

    const estadoCanais = cursorValido && cursorEntrada.channelState
      ? { ...cursorEntrada.channelState }
      : {};
    const mapaUltimaAtividade = cursorValido && cursorEntrada.activityMap
      ? { ...cursorEntrada.activityMap }
      : {};
    const paginasProcessadasTotalInicial = cursorValido
      ? Number(cursorEntrada.pagesProcessedTotal || 0)
      : 0;

    const [membersRes, admissaoRes, rolesRes] = await Promise.all([
      fetchDiscord(`https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`, {
        headers,
      }),
      canalAdmissaoId
        ? fetchDiscord(
            `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
            { headers }
          )
        : Promise.resolve(null),
      fetchDiscord(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
        headers,
      }),
    ]);

    if (!membersRes.ok) throw new Error(`Erro Membros: ${membersRes.status}`);

    const oficiais = await membersRes.json();
    const serverRoles = rolesRes.ok ? await rolesRes.json() : [];

    const idsPatentes = POLICE_ROLE_IDS
      ? POLICE_ROLE_IDS.split(",")
          .map((id) => id.trim())
          .filter((id) => id)
      : [];
    const mapRolesNames = {};
    const mapRolesPosition = {};
    serverRoles.forEach((r) => {
      mapRolesNames[r.id] = r.name;
      mapRolesPosition[r.id] = r.position || 0;
    });

    const mapaPassaporteParaID = {};
    oficiais.forEach((m) => {
      if (m.user.bot) return;
      const apelido = m.nick || m.user.username;
      const matchNick = apelido.match(/\|?\s*(\d{3,6})\s*$/);
      if (matchNick) {
        mapaPassaporteParaID[matchNick[1]] = m.user.id;
      }
    });

    const mapaNomesRP = {};
    const mapaPassaporteRP = {};

    if (admissaoRes && admissaoRes.ok) {
      const mensagens = await admissaoRes.json();
      if (Array.isArray(mensagens)) {
        mensagens.forEach((msg) => {
          let userIdEncontrado = null;
          if (msg.mentions && msg.mentions.length > 0) {
            userIdEncontrado = msg.mentions[0].id;
          } else {
            const matchId = JSON.stringify(msg).match(/(\d{17,20})/);
            if (matchId) userIdEncontrado = matchId[0];
          }

          if (!userIdEncontrado) return;

          let textoAnalise = msg.content || "";
          if (msg.embeds && msg.embeds.length > 0) {
            msg.embeds.forEach((embed) => {
              textoAnalise += `\n ${embed.title || ""}\n ${embed.description || ""}`;
              if (embed.fields) {
                embed.fields.forEach((f) => {
                  textoAnalise += `\n ${f.name}: ${f.value}`;
                });
              }
            });
          }

          const matchNomeRP = textoAnalise.match(
            /(?:Nome\s*(?:do\s*)?RP)(?:[\s\W]*):\s*([^|]+)/i
          );
          const matchNomeCivil = textoAnalise.match(
            /(?:Nome(?:\s+Civil)?|Identidade|Membro)(?:[\s\W]*):\s*([^|]+)/i
          );
          const matchPassaporte = textoAnalise.match(
            /(?:Passaporte|ID|Identidade|Rg|Registro)(?:[\s\W]*):\s*(\d+)/i
          );

          if (matchNomeRP) {
            mapaNomesRP[userIdEncontrado] = matchNomeRP[1]
              .split("\n")[0]
              .replace(/[*_`]/g, "")
              .trim();
          } else if (matchNomeCivil) {
            mapaNomesRP[userIdEncontrado] = matchNomeCivil[1]
              .split("\n")[0]
              .replace(/[*_`]/g, "")
              .trim();
          }

          if (matchPassaporte) {
            const pass = matchPassaporte[1].trim();
            mapaPassaporteRP[userIdEncontrado] = pass;
            if (pass.length >= 3) mapaPassaporteParaID[pass] = userIdEncontrado;
          }
        });
      }
    }

    const atualizarAtividade = (userId, timestamp) => {
      if (!userId) return;
      const time = new Date(timestamp).getTime();
      if (!Number.isFinite(time)) return;
      if (!mapaUltimaAtividade[userId] || time > mapaUltimaAtividade[userId]) {
        mapaUltimaAtividade[userId] = time;
      }
    };

    const processarMensagemAtividade = (msg) => {
      if (!msg || !msg.timestamp) return;

      if (msg.author && !msg.author.bot) {
        atualizarAtividade(msg.author.id, msg.timestamp);
      }

      if (msg.mentions && Array.isArray(msg.mentions)) {
        msg.mentions.forEach((u) => {
          if (u.id) atualizarAtividade(u.id, msg.timestamp);
        });
      }

      let textoCompleto = msg.content || "";
      if (msg.embeds && Array.isArray(msg.embeds)) {
        msg.embeds.forEach((embed) => {
          const partesTexto = [
            embed.title,
            embed.description,
            embed.author?.name,
            embed.footer?.text,
          ];
          if (embed.fields && Array.isArray(embed.fields)) {
            embed.fields.forEach((f) => {
              partesTexto.push(f.name);
              partesTexto.push(f.value);
            });
          }
          textoCompleto += " " + partesTexto.filter(Boolean).join(" ");
        });
      }

      const regexRawIds = /\b(\d{17,20})\b/g;
      let matchRaw;
      while ((matchRaw = regexRawIds.exec(textoCompleto)) !== null) {
        atualizarAtividade(matchRaw[1], msg.timestamp);
      }

      const regexPassaportes = /\b(\d{3,6})\b/g;
      let matchPass;
      while ((matchPass = regexPassaportes.exec(textoCompleto)) !== null) {
        const passaporteEncontrado = matchPass[1];
        const donoDoID = mapaPassaporteParaID[passaporteEncontrado];
        if (donoDoID) atualizarAtividade(donoDoID, msg.timestamp);
      }
    };

    canaisAtividadeIds.forEach((channelId) => {
      const estadoAnterior =
        estadoCanais[channelId] && typeof estadoCanais[channelId] === "object"
          ? estadoCanais[channelId]
          : {};
      estadoCanais[channelId] = {
        before:
          typeof estadoAnterior.before === "string" && estadoAnterior.before
            ? estadoAnterior.before
            : null,
        done: Boolean(estadoAnterior.done),
        pages: Number(estadoAnterior.pages || 0),
        errorCount: Number(estadoAnterior.errorCount || 0),
      };
    });

    let paginasProcessadasLote = 0;
    const estourouTempo = () =>
      Date.now() - startRequestTime >= MAX_EXECUTION_MS;

    for (const channelId of canaisAtividadeIds) {
      if (paginasProcessadasLote >= MAX_PAGES_PER_BATCH || estourouTempo()) {
        break;
      }

      const estado = estadoCanais[channelId];
      if (!estado || estado.done) continue;

      while (!estado.done) {
        if (paginasProcessadasLote >= MAX_PAGES_PER_BATCH || estourouTempo()) {
          break;
        }

        const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          estado.before ? `&before=${estado.before}` : ""
        }`;

        let resCanal = null;
        try {
          resCanal = await fetchDiscord(url, { headers });
        } catch (erroCanal) {
          console.error(`Erro fetch canal ${channelId}:`, erroCanal);
          estado.errorCount = Number(estado.errorCount || 0) + 1;
          if (estado.errorCount >= 3) estado.done = true;
          break;
        }

        if (!resCanal.ok) {
          console.error(`Erro status ${resCanal.status} no canal ${channelId}`);
          if (resCanal.status === 403 || resCanal.status === 404) {
            estado.done = true;
          } else {
            estado.errorCount = Number(estado.errorCount || 0) + 1;
            if (estado.errorCount >= 3) estado.done = true;
          }
          break;
        }

        const batch = await resCanal.json();
        if (!Array.isArray(batch) || batch.length === 0) {
          estado.done = true;
          break;
        }

        batch.forEach((msg) => processarMensagemAtividade(msg));

        estado.before = batch[batch.length - 1].id;
        estado.pages = Number(estado.pages || 0) + 1;
        estado.errorCount = 0;
        paginasProcessadasLote += 1;

        const lastMsgDate = new Date(batch[batch.length - 1].timestamp).getTime();
        if (!Number.isFinite(lastMsgDate) || lastMsgDate < TIME_LIMIT) {
          estado.done = true;
          break;
        }
      }
    }

    const totalCanais = canaisAtividadeIds.length;
    const canaisConcluidos = canaisAtividadeIds.filter(
      (channelId) => estadoCanais[channelId] && estadoCanais[channelId].done
    ).length;
    const paginasProcessadasTotal =
      paginasProcessadasTotalInicial + paginasProcessadasLote;
    const percentualConclusao =
      totalCanais > 0
        ? Math.floor((canaisConcluidos / totalCanais) * 100)
        : 100;

    if (canaisConcluidos < totalCanais) {
      return res.status(200).json({
        partial: true,
        progresso: {
          canaisConcluidos,
          totalCanais,
          paginasProcessadasLote,
          paginasProcessadasTotal,
          percentualConclusao,
        },
        cursor: {
          version: 1,
          org,
          channelState: estadoCanais,
          activityMap: mapaUltimaAtividade,
          pagesProcessedTotal: paginasProcessadasTotal,
        },
      });
    }

    const mapaFerias = {};
    if (FERIAS_CHANNEL_ID) {
      try {
        let allMessagesFerias = [];
        let lastIdFerias = null;
        for (let i = 0; i < 10; i++) {
          const url = `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100${
            lastIdFerias ? `&before=${lastIdFerias}` : ""
          }`;
          const r = await fetchDiscord(url, { headers });
          if (!r.ok) break;
          const batch = await r.json();
          if (!batch || batch.length === 0) break;
          allMessagesFerias = allMessagesFerias.concat(batch);
          lastIdFerias = batch[batch.length - 1].id;
        }

        const regexDataInicio =
          /(?:In[ií]cio|Come[cç]o|Data de in[ií]cio|Solicita[cç][aã]o|Sa[ií]da).*?(\d{2}\/\d{2}\/\d{4})/i;
        const regexDataFim =
          /(?:Fim|T[eé]rmino|Data de fim|Fim das f[eé]rias|Retorno).*?(\d{2}\/\d{2}\/\d{4})/i;

        for (const msg of allMessagesFerias) {
          let textoTotal = msg.content || "";
          if (msg.embeds) {
            msg.embeds.forEach((e) => {
              textoTotal +=
                ` ${e.title} ${e.description} ` +
                (e.fields?.map((f) => `${f.name} ${f.value}`).join(" ") || "");
            });
          }

          const idsEncontrados = new Set();
          const regexMentionF = /<@!?(\d{17,20})>/g;
          let mF;
          while ((mF = regexMentionF.exec(textoTotal)) !== null) {
            idsEncontrados.add(mF[1]);
          }

          idsEncontrados.forEach((userId) => {
            if (mapaFerias[userId]) return;

            const matchInicio = textoTotal.match(regexDataInicio);
            const matchFim = textoTotal.match(regexDataFim);
            if (!matchInicio && !matchFim) return;

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

            if (dataFim) {
              mapaFerias[userId] = {
                dataInicio: dataInicio ? dataInicio.getTime() : null,
                dataFim: dataFim.getTime(),
              };
            } else if (dataInicio) {
              mapaFerias[userId] = {
                dataInicio: dataInicio.getTime(),
                dataFim: null,
              };
            }
          });
        }
      } catch (e) {
        console.error("Erro ao processar ferias:", e);
      }
    }

    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      if (p.user.bot) return;
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;
      const uid = p.user.id;
      if (p.roles.some((r) => listaImunes.includes(r))) return;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) return;

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeTimestamp = hoje.getTime();

      let dataInicioInatividade = null;
      const feriasInfo = mapaFerias[uid];
      const temTagFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);

      if (feriasInfo) {
        if (feriasInfo.dataFim) {
          const dataFimFerias = feriasInfo.dataFim;
          if (hojeTimestamp <= dataFimFerias) return;
          if (hojeTimestamp > dataFimFerias) {
            dataInicioInatividade = dataFimFerias;
          }
        } else if (feriasInfo.dataInicio) {
          const dataInicioFerias = feriasInfo.dataInicio;
          if (hojeTimestamp < dataInicioFerias) {
            // ainda nao iniciou
          } else if (temTagFerias) {
            return;
          }
        }
      }

      const baseData = mapaUltimaAtividade[uid];
      const joinedAtTimestamp = p.joined_at
        ? new Date(p.joined_at).getTime()
        : null;

      let dataBaseCalculo = DATA_BASE_AUDITORIA;
      if (dataInicioInatividade) {
        const dataMinima = Math.max(
          dataInicioInatividade,
          DATA_BASE_AUDITORIA,
          joinedAtTimestamp || 0
        );
        dataBaseCalculo = baseData && baseData > dataMinima ? baseData : dataMinima;
      } else if (baseData) {
        dataBaseCalculo = Math.max(
          baseData,
          DATA_BASE_AUDITORIA,
          joinedAtTimestamp || 0
        );
      } else if (joinedAtTimestamp) {
        dataBaseCalculo = Math.max(joinedAtTimestamp, DATA_BASE_AUDITORIA);
      }

      const diffDias = Math.floor((agora - dataBaseCalculo) / (1000 * 60 * 60 * 24));
      if (diffDias < 7) return;

      const dataObj = new Date(dataBaseCalculo);
      const textoData = `${String(dataObj.getDate()).padStart(2, "0")}/${String(
        dataObj.getMonth() + 1
      ).padStart(2, "0")}/${dataObj.getFullYear()}`;

      const apelido = p.nick || p.user.username;
      let passaporte = "---";
      if (mapaPassaporteRP[uid]) {
        passaporte = mapaPassaporteRP[uid];
      } else {
        const achouPass = Object.keys(mapaPassaporteParaID).find(
          (key) => mapaPassaporteParaID[key] === uid
        );
        if (achouPass) passaporte = achouPass;

        if (passaporte === "---") {
          if (apelido.includes("|")) {
            const partes = apelido.split("|");
            const ultima = partes[partes.length - 1].trim();
            if (/^\d+$/.test(ultima)) passaporte = ultima;
          } else {
            const nums = apelido.match(/(\d+)/g);
            if (nums) passaporte = nums[nums.length - 1];
          }
        }
      }

      let nomeRp = mapaNomesRP[uid];
      if (!nomeRp) {
        nomeRp = apelido
          .replace(/\[.*?\]/g, "")
          .replace(/\(.*?\)/g, "")
          .split("|")[0]
          .replace(/[0-9]/g, "")
          .replace(/[^\w\s\u00C0-\u00FF]/g, "")
          .trim();
        if (!nomeRp) nomeRp = "Nao identificado";
      }

      let idPatente = null;
      let nomePatente = "Oficial";
      let maiorPosicao = -1;
      if (idsPatentes.length > 0 && p.roles && p.roles.length > 0) {
        p.roles.forEach((roleId) => {
          if (idsPatentes.includes(roleId)) {
            const posicao = mapRolesPosition[roleId] || 0;
            if (posicao > maiorPosicao) {
              maiorPosicao = posicao;
              idPatente = roleId;
            }
          }
        });
        if (idPatente && mapRolesNames[idPatente]) {
          nomePatente = mapRolesNames[idPatente];
        }
      }

      resultado.push({
        id: uid,
        name: apelido,
        rpName: nomeRp,
        passaporte,
        cargo: nomePatente,
        dataUltimaMsg: textoData,
        dias: `${diffDias} dias`,
        diasNumber: diffDias,
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
          : null,
        joined_at: p.joined_at,
      });
    });

    resultado.sort((a, b) => b.diasNumber - a.diasNumber);
    const final = resultado.map((item) => {
      const { diasNumber, ...resto } = item;
      return resto;
    });

    return res.status(200).json({
      partial: false,
      progresso: {
        canaisConcluidos: totalCanais,
        totalCanais,
        paginasProcessadasLote,
        paginasProcessadasTotal,
        percentualConclusao: 100,
      },
      data: final,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno no servidor." });
  }
};
