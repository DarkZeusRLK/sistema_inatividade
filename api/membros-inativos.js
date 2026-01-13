// api/membros-inativos.js
// VERSÃO FINAL: DATA FORMATADA + DIAS CORRIDOS (SEPARADOS)
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
    // Canais
    ADMISSAO_CHANNEL_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ADMISSAO_CH,
    PF_ADMISSAO_CH,
    // Cargos
    POLICE_ROLE_ID,
    PRF_ROLE_ID,
    PMERJ_ROLE_ID,
    PF_ROLE_ID,
    // Configs
    CARGOS_IMUNES,
    POLICE_ROLE_IDS,
    CHAT_ID_BUSCAR,
  } = process.env;

  if (!Discord_Bot_Token) {
    return res.status(500).json({ error: "Configuração do sistema incompleta: Token do Bot não configurado no servidor." });
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

    // 2. CANAIS DE ATIVIDADE (apenas CHAT_ID_BUSCAR)
    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
      : [];

    // 3. BUSCAR MENSAGENS DOS CANAIS DE ATIVIDADE (paginando para buscar histórico completo)
    const buscarMensagensCanal = async (channelId) => {
      let allMessages = [];
      let lastId = null;
      // Buscar até 50 lotes (5000 mensagens) para garantir histórico completo
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
        } catch (e) {
          console.error(`Erro ao buscar mensagens do canal ${channelId}:`, e);
          break;
        }
      }
      return allMessages;
    };

    // Buscar mensagens de todos os canais de atividade em paralelo
    const promisesAtividade = canaisAtividadeIds.map((id) =>
      buscarMensagensCanal(id).catch(() => [])
    );

    const [membersRes, admissaoRes, rolesRes, ...mensagensAtividadeArrays] =
      await Promise.all([
        // A. Membros
        fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
          { headers }
        ),
        // B. Admissão
        canalAdmissaoId
          ? fetch(
              `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
              { headers }
            )
          : Promise.resolve(null),
        // C. Cargos
        fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
          headers,
        }),
        // D. Atividade
        ...promisesAtividade,
      ]);

    if (!membersRes.ok) throw new Error(`Erro Membros: ${membersRes.status}`);

    const oficiais = await membersRes.json();
    const serverRoles = rolesRes.ok ? await rolesRes.json() : [];

    // 4. MAPEAR PATENTES
    const idsPatentes = POLICE_ROLE_IDS ? POLICE_ROLE_IDS.split(",") : [];
    const mapRolesNames = {};
    serverRoles.forEach((r) => (mapRolesNames[r.id] = r.name));

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
            const tudoJunto = JSON.stringify(msg);
            const matchId = tudoJunto.match(/(\d{17,20})/);
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
              let nomeBruto = matchNome[1];
              mapaNomesRP[userIdEncontrado] = nomeBruto
                .replace(/[*_`]/g, "")
                .trim();
            }

            if (matchPassaporte) {
              mapaPassaporteRP[userIdEncontrado] = matchPassaporte[1].trim();
            }
          }
        });
      }
    }

    // 6. MAPEAR ATIVIDADE (Apenas canais de CHAT_ID_BUSCAR)
    // A contagem reseta a cada mensagem ou menção nos canais de atividade
    const mapaUltimaAtividade = {};
    
    // Função para atualizar última atividade (sempre pega a mais recente)
    const atualizarAtividade = (userId, timestamp) => {
      const time = new Date(timestamp).getTime();
      // Sempre atualiza para a data mais recente (reseta a contagem)
      if (!mapaUltimaAtividade[userId] || time > mapaUltimaAtividade[userId]) {
        mapaUltimaAtividade[userId] = time;
      }
    };

    // Processar todas as mensagens dos canais de atividade
    mensagensAtividadeArrays.forEach((lista) => {
      if (Array.isArray(lista)) {
        lista.forEach((msg) => {
          // Atualizar atividade do autor da mensagem
          if (msg.author && msg.author.id) {
            atualizarAtividade(msg.author.id, msg.timestamp);
          }
          
          // Atualizar atividade de todos os mencionados
          if (msg.mentions && Array.isArray(msg.mentions)) {
            msg.mentions.forEach((u) => {
              if (u.id) {
                atualizarAtividade(u.id, msg.timestamp);
              }
            });
          }
        });
      }
    });

    // 6.5. MAPEAR FÉRIAS (Armazenar data de fim para calcular inatividade após remoção da tag)
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
          const batch = await r.json();
          if (!batch || batch.length === 0) break;
          allMessagesFerias = allMessagesFerias.concat(batch);
          lastIdFerias = batch[batch.length - 1].id;
        }

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const regexDataInicio = /(?:In[ií]cio|Come[cç]o|Data de in[ií]cio|Solicita[cç][aã]o|Sa[ií]da).*?(\d{2}\/\d{2}\/\d{4})/i;
        const regexDataFim = /(?:Fim|T[eé]rmino|Data de fim|Fim das f[eé]rias|Retorno).*?(\d{2}\/\d{2}\/\d{4})/i;

        // Processar mensagens mais recentes primeiro
        for (const msg of allMessagesFerias) {
          let textoTotal = msg.content || "";
          if (msg.embeds) {
            msg.embeds.forEach((e) => {
              textoTotal +=
                ` ${e.title} ${e.description} ` +
                (e.fields?.map((f) => `${f.name} ${f.value}`).join(" ") || "");
            });
          }

          const matchId = textoTotal.match(/<@!?(\d+)>/);
          if (matchId) {
            const userId = matchId[1];
            
            // Se já processamos este usuário, pular (manter a mensagem mais recente)
            if (mapaFerias[userId]) continue;
            
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

              // Armazenar informações de férias (sempre a mais recente)
              if (dataFim) {
                mapaFerias[userId] = { 
                  dataInicio: dataInicio || null, 
                  dataFim: dataFim.getTime(),
                  timestampMsg: new Date(msg.timestamp).getTime()
                };
              } else if (dataInicio) {
                // Se só tem data de início, considerar como férias em andamento
                mapaFerias[userId] = { 
                  dataInicio: dataInicio.getTime(), 
                  dataFim: null,
                  timestampMsg: new Date(msg.timestamp).getTime()
                };
              }
            }
          }
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
      
      // Se tem tag de férias, não considerar inativo
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) return;
      
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const hojeTimestamp = hoje.getTime();
      
      // Verificar se estava de férias e calcular inatividade a partir da remoção da tag
      let dataInicioInatividade = null;
      const feriasInfo = mapaFerias[uid];
      const temTagFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);
      
      if (feriasInfo) {
        // Se tem data de fim das férias
        if (feriasInfo.dataFim) {
          const dataFimFerias = feriasInfo.dataFim;
          
          // Se ainda está dentro do período de férias E tem a tag, não considerar inativo
          if (hojeTimestamp <= dataFimFerias && temTagFerias) {
            return; // Ainda está em férias com tag
          }
          
          // Se não tem mais a tag (foi removida), a inatividade conta a partir da data de fim
          // OU se passou da data de fim (bot remove automaticamente)
          // Usar a data de fim como base mínima para cálculo de inatividade
          if (!temTagFerias || hojeTimestamp > dataFimFerias) {
            // A tag foi removida (manualmente ou automaticamente)
            // Contar inatividade a partir da data de fim das férias
            dataInicioInatividade = dataFimFerias;
          }
        } else if (feriasInfo.dataInicio) {
          // Se só tem data de início
          const dataInicioFerias = feriasInfo.dataInicio;
          
          // Se ainda não começou as férias, não considerar inativo por férias
          if (hojeTimestamp < dataInicioFerias) {
            // Não está em férias ainda
          } else if (temTagFerias) {
            // Se tem tag e já passou da data de início, considerar como em férias
            return; // Ainda está em férias
          }
          // Se não tem mais a tag mas tinha data de início, não vamos contar inatividade por férias
          // (pode ter sido removida manualmente antes do fim)
        }
      }

      // --- CÁLCULO DE DATAS E FORMATOS ---
      // A contagem começa a partir do joined_at (data de entrada no Discord)
      // E reseta a cada mensagem ou menção nos canais de CHAT_ID_BUSCAR
      
      let baseData = mapaUltimaAtividade[uid]; // Última atividade nos canais de CHAT_ID_BUSCAR
      let diffDias;
      let dataBaseCalculo;

      // Strings que serão exibidas
      let textoData = "Sem registro";
      let textoDias = "---";

      // Data de entrada no Discord (joined_at) - base inicial para contagem
      const joinedAtTimestamp = p.joined_at 
        ? new Date(p.joined_at).getTime() 
        : null;

      // Se estava de férias, usar a data de fim das férias como base mínima
      if (dataInicioInatividade) {
        // A inatividade só conta a partir da data de fim das férias
        // Mas também precisa respeitar DATA_BASE_AUDITORIA e joined_at
        const dataFimFerias = dataInicioInatividade;
        const dataMinima = Math.max(
          dataFimFerias,
          DATA_BASE_AUDITORIA,
          joinedAtTimestamp || 0
        );
        
        // Se tem atividade registrada após a data de fim das férias, usar essa
        if (baseData && baseData > dataMinima) {
          // Tem atividade nos canais de CHAT_ID_BUSCAR após as férias
          dataBaseCalculo = baseData;
        } else {
          // Não tem atividade após o fim das férias, contar a partir da data de fim
          dataBaseCalculo = dataMinima;
        }
      } else if (baseData) {
        // Não estava de férias, usar a última atividade nos canais de CHAT_ID_BUSCAR
        // Mas respeitar DATA_BASE_AUDITORIA e joined_at como mínimo
        const dataMinima = Math.max(
          DATA_BASE_AUDITORIA,
          joinedAtTimestamp || 0
        );
        dataBaseCalculo = Math.max(baseData, dataMinima);
        diffDias = Math.floor((agora - dataBaseCalculo) / (1000 * 60 * 60 * 24));

        // 2. Formata Data (DD/MM/AAAA)
        const dataObj = new Date(dataBaseCalculo);
        const dia = String(dataObj.getDate()).padStart(2, "0");
        const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
        const ano = dataObj.getFullYear();
        textoData = `${dia}/${mes}/${ano}`;

        // 3. Formata Dias Corridos
        textoDias = `${diffDias} dias`;
      } else {
        // Sem atividade registrada nos canais de CHAT_ID_BUSCAR
        // Usar joined_at como base, ou DATA_BASE_AUDITORIA se não tiver joined_at
        if (joinedAtTimestamp) {
          dataBaseCalculo = Math.max(joinedAtTimestamp, DATA_BASE_AUDITORIA);
        } else {
          dataBaseCalculo = DATA_BASE_AUDITORIA;
        }
      }

      // Calcular diferença em dias (unificado para todos os casos)
      diffDias = Math.floor((agora - dataBaseCalculo) / (1000 * 60 * 60 * 24));

      // Formatar data (DD/MM/AAAA)
      const dataObj = new Date(dataBaseCalculo);
      const dia = String(dataObj.getDate()).padStart(2, "0");
      const mes = String(dataObj.getMonth() + 1).padStart(2, "0");
      const ano = dataObj.getFullYear();
      textoData = `${dia}/${mes}/${ano}`;
      textoDias = `${diffDias} dias`;

      // Filtra apenas quem tem 7 dias ou mais (ou sem registro)
      if (diffDias >= 7) {
        const apelido = p.nick || p.user.username;
        let passaporte = "---";

        // Passaporte
        if (mapaPassaporteRP[uid]) {
          passaporte = mapaPassaporteRP[uid];
        } else {
          if (apelido.includes("|")) {
            const partes = apelido.split("|");
            const ultima = partes[partes.length - 1].trim();
            if (/^\d+$/.test(ultima)) passaporte = ultima;
          } else {
            const nums = apelido.match(/(\d+)/g);
            if (nums) passaporte = nums[nums.length - 1];
          }
        }

        // Nome RP
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

        // Patente
        const idPatente = idsPatentes.find((id) => p.roles.includes(id));
        const nomePatente = idPatente ? mapRolesNames[idPatente] : "Oficial";

        resultado.push({
          id: uid,
          name: apelido,
          rpName: nomeRp,
          passaporte: passaporte,
          cargo: nomePatente,

          // --- CAMPOS FORMATADOS PARA O FRONTEND ---
          dataUltimaMsg: textoData, // Ex: "14/12/2025"
          dias: textoDias, // Ex: "10 dias"
          diasNumber: diffDias, // Numérico (para ordenação)

          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
          joined_at: p.joined_at,
        });
      }
    });

    // Ordena pelo número de dias (invisível)
    resultado.sort((a, b) => b.diasNumber - a.diasNumber);

    // Remove o auxiliar antes de enviar
    const final = resultado.map((item) => {
      const { diasNumber, ...resto } = item;
      return resto;
    });

    res.status(200).json(final);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno no servidor durante o processamento da auditoria. Por favor, tente novamente." });
  }
};
