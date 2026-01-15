// api/membros-inativos.js
module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { org } = req.query;

  // Variáveis de Ambiente
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
    return res.status(500).json({ error: "Token do Bot não configurado." });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    const fetch = global.fetch || require("node-fetch");

    // 1. SELEÇÃO DE ORG
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

    // 2. BUSCAR MENSAGENS COM SMART FETCH
    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
      : [];

    // Limite de segurança: 8 dias atrás
    const LIMIT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
    const TIME_LIMIT = Date.now() - LIMIT_DAYS_MS;

    const buscarMensagensCanal = async (channelId) => {
      let allMessages = [];
      let lastId = null;

      // Busca até 50 lotes (5000 msg) OU até atingir a data limite
      for (let i = 0; i < 50; i++) {
        const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          lastId ? `&before=${lastId}` : ""
        }`;

        try {
          const res = await fetch(url, { headers });
          if (!res.ok) break;
          const batch = await res.json();
          if (!batch || batch.length === 0) break;

          allMessages = allMessages.concat(batch);
          lastId = batch[batch.length - 1].id;

          // Se a última mensagem do lote for mais velha que 8 dias, PARAR.
          const lastMsgDate = new Date(
            batch[batch.length - 1].timestamp
          ).getTime();
          if (lastMsgDate < TIME_LIMIT) break;
        } catch (e) {
          console.error(`Erro canal ${channelId}:`, e);
          break;
        }
      }
      return allMessages;
    };

    const promisesAtividade = canaisAtividadeIds.map((id) =>
      buscarMensagensCanal(id).catch(() => [])
    );

    const [membersRes, admissaoRes, rolesRes, ...mensagensAtividadeArrays] =
      await Promise.all([
        fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
          { headers }
        ),
        canalAdmissaoId
          ? fetch(
              `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
              { headers }
            )
          : Promise.resolve(null),
        fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
          headers,
        }),
        ...promisesAtividade,
      ]);

    if (!membersRes.ok) throw new Error(`Erro Membros: ${membersRes.status}`);

    const oficiais = await membersRes.json();
    const serverRoles = rolesRes.ok ? await rolesRes.json() : [];

    // 4. MAPEAR PATENTES
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

    // 5. PROCESSAR ADMISSÃO
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

          if (userIdEncontrado) {
            let textoAnalise = msg.content || "";
            if (msg.embeds) {
              msg.embeds.forEach((embed) => {
                textoAnalise += `\n ${embed.title || ""} \n ${
                  embed.description || ""
                }`;
                if (embed.fields) {
                  embed.fields.forEach(
                    (f) => (textoAnalise += `\n ${f.name}: ${f.value}`)
                  );
                }
              });
            }
            const matchNome = textoAnalise.match(
              /(?:Nome(?:\s+RP|\s+Civil)?|Identidade|Membro)(?:[\s\W]*):(?:\s*)(.*?)(?:\n|$|\||•)/i
            );
            const matchPassaporte = textoAnalise.match(
              /(?:Passaporte|ID|Identidade|Rg|Registro)(?:[\s\W]*):(?:\s*)(\d+)/i
            );

            if (matchNome)
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            if (matchPassaporte)
              mapaPassaporteRP[userIdEncontrado] = matchPassaporte[1].trim();
          }
        });
      }
    }

    // 6. MAPEAR ATIVIDADE (CORREÇÃO DE EMBEDS AQUI)
    const mapaUltimaAtividade = {};

    const atualizarAtividade = (userId, timestamp) => {
      const time = new Date(timestamp).getTime();
      if (!mapaUltimaAtividade[userId] || time > mapaUltimaAtividade[userId]) {
        mapaUltimaAtividade[userId] = time;
      }
    };

    mensagensAtividadeArrays.forEach((lista) => {
      if (Array.isArray(lista)) {
        lista.forEach((msg) => {
          // 1. O Autor da mensagem conta como atividade
          if (msg.author && msg.author.id) {
            atualizarAtividade(msg.author.id, msg.timestamp);
          }

          // 2. Menções explícitas (padrão Discord)
          if (msg.mentions && Array.isArray(msg.mentions)) {
            msg.mentions.forEach((u) => {
              if (u.id) atualizarAtividade(u.id, msg.timestamp);
            });
          }

          // 3. NOVO: Varredura dentro de EMBEDS (para pegar logs de bot)
          if (msg.embeds && msg.embeds.length > 0) {
            msg.embeds.forEach((embed) => {
              // Concatena Título, Descrição e Campos
              let conteudoEmbed =
                (embed.title || "") + " " + (embed.description || "");
              if (embed.fields) {
                embed.fields.forEach((f) => (conteudoEmbed += " " + f.value));
              }

              // Regex para encontrar <@123456789> ou <@!123456789>
              const regexMention = /<@!?(\d{17,20})>/g;
              let match;
              while ((match = regexMention.exec(conteudoEmbed)) !== null) {
                // match[1] é o ID do usuário
                atualizarAtividade(match[1], msg.timestamp);
              }
            });
          }
        });
      }
    });

    // 6.5. MAPEAR FÉRIAS
    const mapaFerias = {};
    const DATA_BASE_AUDITORIA = new Date("2025-12-08T00:00:00").getTime(); // Ajustado para sua data base

    if (FERIAS_CHANNEL_ID) {
      // ... (Mesma lógica de férias do código anterior) ...
      // Vou resumir para economizar caracteres, mas mantenha a lógica original de férias
      try {
        let allMessagesFerias = [];
        let lastIdFerias = null;
        for (let i = 0; i < 5; i++) {
          const url = `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100${
            lastIdFerias ? `&before=${lastIdFerias}` : ""
          }`;
          const r = await fetch(url, { headers });
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
          if (msg.embeds)
            msg.embeds.forEach(
              (e) => (textoTotal += ` ${e.title} ${e.description}`)
            );
          const matchId = textoTotal.match(/<@!?(\d+)>/);
          if (matchId && !mapaFerias[matchId[1]]) {
            const matchInicio = textoTotal.match(regexDataInicio);
            const matchFim = textoTotal.match(regexDataFim);
            let dInicio, dFim;
            if (matchInicio) {
              const [d, m, a] = matchInicio[1].split("/");
              dInicio = new Date(a, m - 1, d).getTime();
            }
            if (matchFim) {
              const [d, m, a] = matchFim[1].split("/");
              dFim = new Date(a, m - 1, d);
              dFim.setHours(23, 59, 59);
              dFim = dFim.getTime();
            }
            if (dInicio || dFim)
              mapaFerias[matchId[1]] = { dataInicio: dInicio, dataFim: dFim };
          }
        }
      } catch (e) {
        console.error("Erro férias", e);
      }
    }

    // 7. GERAÇÃO DO RELATÓRIO
    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      if (p.user.bot) return;
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;
      const uid = p.user.id;
      if (p.roles.some((r) => listaImunes.includes(r))) return;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) return;

      const hojeTimestamp = new Date().setHours(0, 0, 0, 0);
      let dataInicioInatividade = null;
      const feriasInfo = mapaFerias[uid];
      const temTagFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);

      if (feriasInfo) {
        if (feriasInfo.dataFim) {
          if (hojeTimestamp <= feriasInfo.dataFim && temTagFerias) return;
          if (!temTagFerias || hojeTimestamp > feriasInfo.dataFim)
            dataInicioInatividade = feriasInfo.dataFim;
        } else if (
          feriasInfo.dataInicio &&
          temTagFerias &&
          hojeTimestamp >= feriasInfo.dataInicio
        ) {
          return;
        }
      }

      let baseData = mapaUltimaAtividade[uid];
      let diffDias, dataBaseCalculo;
      const joinedAtTimestamp = p.joined_at
        ? new Date(p.joined_at).getTime()
        : null;

      if (dataInicioInatividade) {
        dataBaseCalculo = Math.max(
          dataInicioInatividade,
          DATA_BASE_AUDITORIA,
          joinedAtTimestamp || 0
        );
        if (baseData && baseData > dataBaseCalculo) dataBaseCalculo = baseData;
      } else if (baseData) {
        dataBaseCalculo = Math.max(
          baseData,
          Math.max(DATA_BASE_AUDITORIA, joinedAtTimestamp || 0)
        );
      } else {
        dataBaseCalculo = Math.max(DATA_BASE_AUDITORIA, joinedAtTimestamp || 0);
      }

      diffDias = Math.floor((agora - dataBaseCalculo) / (1000 * 60 * 60 * 24));

      if (diffDias >= 7) {
        const dataObj = new Date(dataBaseCalculo);
        const textoData = `${String(dataObj.getDate()).padStart(
          2,
          "0"
        )}/${String(dataObj.getMonth() + 1).padStart(
          2,
          "0"
        )}/${dataObj.getFullYear()}`;

        // Lógica de nome/passaporte/patente mantida
        const apelido = p.nick || p.user.username;
        let passaporte = "---";
        if (mapaPassaporteRP[uid]) passaporte = mapaPassaporteRP[uid];
        else {
          const nums = apelido.match(/(\d+)/g);
          if (nums) passaporte = nums[nums.length - 1];
        }

        let nomeRp =
          mapaNomesRP[uid] ||
          apelido.split("|")[0].replace(/[0-9]/g, "").trim() ||
          "Não identificado";

        let nomePatente = "Oficial";
        let maiorPosicao = -1;
        if (idsPatentes.length > 0 && p.roles) {
          p.roles.forEach((rid) => {
            if (idsPatentes.includes(rid)) {
              const pos = mapRolesPosition[rid] || 0;
              if (pos > maiorPosicao) {
                maiorPosicao = pos;
                nomePatente = mapRolesNames[rid];
              }
            }
          });
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
      }
    });

    resultado.sort((a, b) => b.diasNumber - a.diasNumber);
    const final = resultado.map(({ diasNumber, ...resto }) => resto);
    res.status(200).json(final);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
};
