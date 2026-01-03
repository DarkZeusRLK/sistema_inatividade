// Usa importação dinâmica para evitar erro de "ESM vs CommonJS"
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = async (req, res) => {
  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID, // ID do canal de logs de férias
    POLICE_ROLE_ID,
    ADMISSAO_CHANNEL_ID,
    PRF_ROLE_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ROLE_ID,
    PMERJ_ADMISSAO_CH,
    CHAT_ID_BUSCAR,
  } = process.env;

  const canaisPermitidos = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
    : [];

  const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

  try {
    // =================================================================================
    // 1. MAPEAMENTO DE FÉRIAS (Lógica de Datas)
    // =================================================================================
    const mapaFerias = {}; // { idUsuario: timestampFimFerias }

    if (FERIAS_CHANNEL_ID) {
      try {
        const respFerias = await fetch(
          `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
          { headers }
        );

        if (respFerias.ok) {
          const msgsFerias = await respFerias.json();

          msgsFerias.forEach((msg) => {
            let userId = null;

            // Prioridade 1: Menção
            if (msg.mentions && msg.mentions.length > 0) {
              userId = msg.mentions[0].id;
            }
            // Prioridade 2: Regex no texto
            else {
              const content = msg.content + JSON.stringify(msg.embeds || []);
              const matchID =
                content.match(/<@!?(\d+)>/) || content.match(/(\d{17,20})/);
              if (matchID) userId = matchID[1];
            }

            if (userId) {
              const textoCompleto = (
                msg.content +
                " " +
                JSON.stringify(msg.embeds || [])
              ).toLowerCase();

              // Regex busca datas (dd/mm ou dd/mm/aaaa)
              const regexData =
                /(?:término|volta|retorno|até|fim)[\s\S]*?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
              const matchData = textoCompleto.match(regexData);

              if (matchData) {
                const dia = parseInt(matchData[1]);
                const mes = parseInt(matchData[2]) - 1;
                let ano = matchData[3]
                  ? parseInt(matchData[3])
                  : new Date().getFullYear();
                if (ano < 100) ano += 2000;

                // Define data para o FIM do dia (23:59:59)
                const dataTermino = new Date(
                  ano,
                  mes,
                  dia,
                  23,
                  59,
                  59
                ).getTime();

                if (!mapaFerias[userId] || dataTermino > mapaFerias[userId]) {
                  mapaFerias[userId] = dataTermino;
                }
              }
            }
          });
        } else {
          console.error(`Erro ao ler férias: Status ${respFerias.status}`);
        }
      } catch (errFerias) {
        console.error("Erro ao ler canal de férias:", errFerias);
      }
    }

    // =================================================================================
    // 2. BUSCA DADOS DE ADMISSÃO
    // =================================================================================
    let dadosRP = {};
    const targetAdm =
      org === "PRF"
        ? PRF_ADMISSAO_CH
        : org === "PMERJ"
        ? PMERJ_ADMISSAO_CH
        : ADMISSAO_CHANNEL_ID;

    if (org && targetAdm) {
      // Loop sequencial aqui é aceitável pois são poucas páginas (5)
      let ultimoIdAdmissao = null;
      for (let i = 0; i < 5; i++) {
        let url = `https://discord.com/api/v10/channels/${targetAdm}/messages?limit=100`;
        if (ultimoIdAdmissao) url += `&before=${ultimoIdAdmissao}`;

        const r = await fetch(url, { headers });
        if (!r.ok) break;

        const msgs = await r.json();
        if (!msgs || msgs.length === 0) break;

        msgs.forEach((m) => {
          const content = m.content;
          const matchId =
            content.match(/Passaporte:?\s*(\d+)/i) ||
            content.match(/ID:?\s*(\d+)/i);
          const matchNome = content.match(/Nome:?\s*(.+?)(\n|$)/i);
          const mention = m.mentions && m.mentions[0] ? m.mentions[0].id : null;

          if (mention && (matchId || matchNome)) {
            if (!dadosRP[mention]) {
              dadosRP[mention] = {
                passaporte: matchId ? matchId[1] : "N/A",
                nome: matchNome ? matchNome[1].trim() : "Sem Nome",
              };
            }
          }
        });
        ultimoIdAdmissao = msgs[msgs.length - 1].id;
      }
    }

    // =================================================================================
    // 3. MAPA DE ATIVIDADE (Chat) - OTIMIZADO (PARALELO)
    // =================================================================================
    let activityMap = {};

    // Cria uma promessa para cada canal para buscar em paralelo e evitar TIMEOUT
    const promisesChats = canaisPermitidos.map(async (channelId) => {
      if (!channelId) return;
      let ultimoIdBusca = null;

      // Busca 3 páginas (300 msgs)
      for (let i = 0; i < 3; i++) {
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
        if (ultimoIdBusca) url += `&before=${ultimoIdBusca}`;

        try {
          const resp = await fetch(url, { headers });
          if (!resp.ok) break;

          const msgs = await resp.json();
          if (!msgs || msgs.length === 0) break;

          msgs.forEach((msg) => {
            const userId = msg.author.id;
            const ts = new Date(msg.timestamp).getTime();

            if (!activityMap[userId]) {
              activityMap[userId] = {
                lastMsg: ts,
                username: msg.author.username,
              };
            } else if (ts > activityMap[userId].lastMsg) {
              activityMap[userId].lastMsg = ts;
            }
            activityMap[userId].username = msg.author.username;
          });
          ultimoIdBusca = msgs[msgs.length - 1].id;
        } catch (e) {
          console.error(`Erro ao ler chat ${channelId}:`, e);
          break;
        }
      }
    });

    // Espera todos os chats serem lidos ao mesmo tempo
    await Promise.all(promisesChats);

    // =================================================================================
    // 4. LISTAR MEMBROS E CALCULAR
    // =================================================================================
    const targetRole =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Busca membros
    const membersResp = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );

    if (!membersResp.ok) {
      const errText = await membersResp.text();
      throw new Error(
        `Falha Discord (Status ${membersResp.status}): ${errText}`
      );
    }

    const members = await membersResp.json();
    const inativos = [];
    const agora = Date.now();

    for (const member of members) {
      if (member.user.bot) continue;
      if (!member.roles.includes(targetRole)) continue;

      // --- LÓGICA DE FÉRIAS ---
      const temCargoFerias = member.roles.includes(FERIAS_ROLE_ID);
      const fimFeriasTimestamp = mapaFerias[member.user.id];
      let protegidoPorFerias = false;

      // 1. Cargo protege
      if (temCargoFerias) protegidoPorFerias = true;

      // 2. Data protege (Se ainda não passou a data de fim)
      if (fimFeriasTimestamp && agora <= fimFeriasTimestamp) {
        protegidoPorFerias = true;
      }

      if (protegidoPorFerias) continue;

      // --- CÁLCULO ---
      let lastActivity = activityMap[member.user.id]?.lastMsg || 0;

      // CORREÇÃO: Se a volta das férias é MAIS RECENTE que a última msg, usa a data das férias
      if (fimFeriasTimestamp && fimFeriasTimestamp > lastActivity) {
        lastActivity = fimFeriasTimestamp;
      }

      const diffMs = agora - lastActivity;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Se > 3 dias (ajuste conforme necessidade)
      if (diffDays >= 3) {
        const dadosUser = dadosRP[member.user.id] || {};
        inativos.push({
          id: member.user.id,
          username: dadosUser.nome || member.user.username || "Desconhecido",
          nickname: member.nick || member.user.global_name,
          passaporte: dadosUser.passaporte || "N/A",
          dias: diffDays,
          avatar: member.user.avatar
            ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png`
            : "https://cdn.discordapp.com/embed/avatars/0.png",
          ultimaData:
            lastActivity > 0
              ? new Date(lastActivity).toLocaleDateString("pt-BR")
              : "Nunca",
        });
      }
    }

    inativos.sort((a, b) => b.dias - a.dias);
    res.status(200).json(inativos);
  } catch (error) {
    console.error("Erro Crítico na API:", error);
    res.status(500).json({ error: error.message });
  }
};
