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
    return res.status(500).json({
      error: "Configuração incompleta: Token do Bot ausente.",
    });
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

    // 2. CANAIS DE ATIVIDADE
    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
      : [];

    // --- SEGURANÇA DE DATA (AUMENTADA PARA 15 DIAS) ---
    // A regra de inatividade continua 7 dias.
    // Mas aumentamos a busca para 15 dias para garantir que logs atrasados ou spamados sejam lidos.
    const SEARCH_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
    const TIME_LIMIT = Date.now() - SEARCH_DAYS_MS;

    const buscarMensagensCanal = async (channelId) => {
      let allMessages = [];
      let lastId = null;

      // --- PAGINAÇÃO (MANTIDA FORTE: 400 requests) ---
      for (let i = 0; i < 400; i++) {
        const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          lastId ? `&before=${lastId}` : ""
        }`;

        try {
          const res = await fetch(url, { headers });
          if (!res.ok) {
            console.error(`Erro status ${res.status} no canal ${channelId}`);
            break;
          }

          const batch = await res.json();
          if (!batch || batch.length === 0) break;

          allMessages = allMessages.concat(batch);
          lastId = batch[batch.length - 1].id;

          const lastMsgDate = new Date(
            batch[batch.length - 1].timestamp
          ).getTime();

          if (lastMsgDate < TIME_LIMIT) {
            break;
          }
        } catch (e) {
          console.error(`Erro fetch canal ${channelId}:`, e);
          break;
        }
      }
      return allMessages;
    };
    // -------------------------------

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

    // =================================================================================
    // [NOVO] 4.5. MAPEAMENTO INTELIGENTE (RESOLVE O PROBLEMA DO RICARDO)
    // Antes de ler as mensagens, vamos descobrir qual passaporte pertence a quem
    // olhando os apelidos (Ex: "Ricardo | 7087" -> 7087 é o Ricardo)
    // =================================================================================
    const mapaPassaporteParaID = {}; // { '7087': '112298...' }

    oficiais.forEach((m) => {
      if (m.user.bot) return;
      const apelido = m.nick || m.user.username;
      // Pega numeros no final do nick, geralmente depois de uma barra vertical
      // Ex: "Nome | 7087" ou "Nome 7087"
      const matchNick = apelido.match(/\|?\s*(\d{3,6})\s*$/);
      if (matchNick) {
        const passaporte = matchNick[1];
        mapaPassaporteParaID[passaporte] = m.user.id;
      }
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
            if (msg.embeds && msg.embeds.length > 0) {
              msg.embeds.forEach((embed) => {
                textoAnalise += `\n ${embed.title || ""} \n ${
                  embed.description || ""
                }`;
                if (embed.fields) {
                  embed.fields.forEach((f) => {
                    textoAnalise += `\n ${f.name}: ${f.value}`;
                  });
                }
              });
            }
            const matchNome = textoAnalise.match(
              /(?:Nome(?:\s+RP|\s+Civil)?|Identidade|Membro)(?:[\s\W]*):(?:\s*)(.*?)(?:\n|$|\||•)/i
            );
            const matchPassaporte = textoAnalise.match(
              /(?:Passaporte|ID|Identidade|Rg|Registro)(?:[\s\W]*):(?:\s*)(\d+)/i
            );

            if (matchNome) {
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            }
            if (matchPassaporte) {
              const pass = matchPassaporte[1].trim();
              mapaPassaporteRP[userIdEncontrado] = pass;
              // Reforça o mapa inverso com dados da admissão
              if (pass.length >= 3)
                mapaPassaporteParaID[pass] = userIdEncontrado;
            }
          }
        });
      }
    }

    // 6. MAPEAR ATIVIDADE (Scan Profundo nos Embeds + Passaporte)
    const mapaUltimaAtividade = {};
    const atualizarAtividade = (userId, timestamp) => {
      if (!userId) return;
      const time = new Date(timestamp).getTime();
      if (!mapaUltimaAtividade[userId] || time > mapaUltimaAtividade[userId]) {
        mapaUltimaAtividade[userId] = time;
      }
    };

    mensagensAtividadeArrays.forEach((lista) => {
      if (Array.isArray(lista)) {
        lista.forEach((msg) => {
          // 1. Autor humano
          if (msg.author && !msg.author.bot) {
            atualizarAtividade(msg.author.id, msg.timestamp);
          }

          // 2. Menções explícitas (Discord Blue Links)
          if (msg.mentions && Array.isArray(msg.mentions)) {
            msg.mentions.forEach((u) => {
              if (u.id) atualizarAtividade(u.id, msg.timestamp);
            });
          }

          // Preparar Texto Completo (Content + Embeds)
          let textoCompleto = msg.content || "";
          if (msg.embeds && Array.isArray(msg.embeds)) {
            msg.embeds.forEach((embed) => {
              let partesTexto = [
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

          // 3. Regex: Discord User IDs (17-20 digitos)
          const regexRawIds = /\b(\d{17,20})\b/g;
          let matchRaw;
          while ((matchRaw = regexRawIds.exec(textoCompleto)) !== null) {
            atualizarAtividade(matchRaw[1], msg.timestamp);
          }

          // 4. [NOVO] Regex: Passaportes (3-6 digitos)
          // Se encontrar "7087" no texto, verifica de quem é esse número
          const regexPassaportes = /\b(\d{3,6})\b/g;
          let matchPass;
          while ((matchPass = regexPassaportes.exec(textoCompleto)) !== null) {
            const passaporteEncontrado = matchPass[1];
            const donoDoID = mapaPassaporteParaID[passaporteEncontrado];
            if (donoDoID) {
              // SUCESSO: Log sem menção atribuído corretamente ao Ricardo
              atualizarAtividade(donoDoID, msg.timestamp);
            }
          }
        });
      }
    });

    // 6.5. MAPEAR FÉRIAS
    const mapaFerias = {};
    const DATA_BASE_AUDITORIA = new Date("2025-12-08T00:00:00").getTime();

    if (FERIAS_CHANNEL_ID) {
      try {
        let allMessagesFerias = [];
        let lastIdFerias = null;
        for (let i = 0; i < 10; i++) {
          const url = `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100${
            lastIdFerias ? `&before=${lastIdFerias}` : ""
          }`;
          const r = await fetch(url, { headers });
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

              if (dataFim) {
                mapaFerias[userId] = {
                  dataInicio: dataInicio || null,
                  dataFim: dataFim.getTime(),
                };
              } else if (dataInicio) {
                mapaFerias[userId] = {
                  dataInicio: dataInicio.getTime(),
                  dataFim: null,
                };
              }
            }
          });
        }
      } catch (e) {
        console.error("Erro ao processar férias:", e);
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

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeTimestamp = hoje.getTime();

      let dataInicioInatividade = null;
      const feriasInfo = mapaFerias[uid];
      const temTagFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);

      if (feriasInfo) {
        if (feriasInfo.dataFim) {
          const dataFimFerias = feriasInfo.dataFim;
          if (hojeTimestamp <= dataFimFerias && temTagFerias) return;
          if (!temTagFerias || hojeTimestamp > dataFimFerias) {
            dataInicioInatividade = dataFimFerias;
          }
        } else if (feriasInfo.dataInicio) {
          const dataInicioFerias = feriasInfo.dataInicio;
          if (hojeTimestamp < dataInicioFerias) {
            // Ainda vai sair
          } else if (temTagFerias) {
            return;
          }
        }
      }

      let baseData = mapaUltimaAtividade[uid];
      let diffDias;
      let dataBaseCalculo;
      let textoData = "Sem registro";
      let textoDias = "---";

      const joinedAtTimestamp = p.joined_at
        ? new Date(p.joined_at).getTime()
        : null;

      if (dataInicioInatividade) {
        const dataFimFerias = dataInicioInatividade;
        const dataMinima = Math.max(
          dataFimFerias,
          DATA_BASE_AUDITORIA,
          joinedAtTimestamp || 0
        );
        if (baseData && baseData > dataMinima) {
          dataBaseCalculo = baseData;
        } else {
          dataBaseCalculo = dataMinima;
        }
      } else if (baseData) {
        const dataMinima = Math.max(
          DATA_BASE_AUDITORIA,
          joinedAtTimestamp || 0
        );
        dataBaseCalculo = Math.max(baseData, dataMinima);
      } else {
        if (joinedAtTimestamp) {
          dataBaseCalculo = Math.max(joinedAtTimestamp, DATA_BASE_AUDITORIA);
        } else {
          dataBaseCalculo = DATA_BASE_AUDITORIA;
        }
      }

      diffDias = Math.floor((agora - dataBaseCalculo) / (1000 * 60 * 60 * 24));

      const dataObj = new Date(dataBaseCalculo);
      const dia = String(dataObj.getDate()).padStart(2, "0");
      const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
      const ano = dataObj.getFullYear();
      textoData = `${dia}/${mes}/${ano}`;
      textoDias = `${diffDias} dias`;

      // REGRA FINAL: Só retorna quem tem 7 dias ou mais
      if (diffDias >= 7) {
        const apelido = p.nick || p.user.username;
        let passaporte = "---";

        if (mapaPassaporteRP[uid]) {
          passaporte = mapaPassaporteRP[uid];
        } else {
          // Tenta pegar de novo se não veio da admissão (agora temos o mapa inteligente)
          if (mapaPassaporteParaID) {
            // Procura se esse ID tem um passaporte associado no inverso
            const achouPass = Object.keys(mapaPassaporteParaID).find(
              (key) => mapaPassaporteParaID[key] === uid
            );
            if (achouPass) passaporte = achouPass;
          }

          // Fallback antigo
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
          if (!nomeRp) nomeRp = "Não identificado";
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
          passaporte: passaporte,
          cargo: nomePatente,
          dataUltimaMsg: textoData,
          dias: textoDias,
          diasNumber: diffDias,
          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
          joined_at: p.joined_at,
        });
      }
    });

    resultado.sort((a, b) => b.diasNumber - a.diasNumber);

    const final = resultado.map((item) => {
      const { diasNumber, ...resto } = item;
      return resto;
    });

    res.status(200).json(final);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro interno no servidor.",
    });
  }
};
