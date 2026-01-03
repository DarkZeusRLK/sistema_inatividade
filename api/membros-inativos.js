const fetch = require("node-fetch");

module.exports = async (req, res) => {
  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID, // <--- NOVO: ID do canal de logs de férias
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
        // Busca as últimas 100 mensagens do canal de férias
        const respFerias = await fetch(
          `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
          { headers }
        );

        if (respFerias.ok) {
          const msgsFerias = await respFerias.json();

          msgsFerias.forEach((msg) => {
            // Tenta achar o ID do usuário (Mentions ou Conteúdo)
            let userId = null;

            // Prioridade 1: Menção direta no bot
            if (msg.mentions && msg.mentions.length > 0) {
              userId = msg.mentions[0].id;
            }
            // Prioridade 2: Procura ID no texto/embed
            else {
              const content = msg.content + JSON.stringify(msg.embeds || []);
              const matchID =
                content.match(/<@!?(\d+)>/) || content.match(/(\d{17,20})/);
              if (matchID) userId = matchID[1];
            }

            if (userId) {
              // Procura datas no formato DD/MM ou DD/MM/AAAA
              // Palavras chave: Término, Volta, Retorno, Até
              const textoCompleto = (
                msg.content +
                " " +
                JSON.stringify(msg.embeds || [])
              ).toLowerCase();

              // Regex para pegar data após palavras chaves
              const regexData =
                /(?:término|volta|retorno|até|fim)[\s\S]*?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
              const matchData = textoCompleto.match(regexData);

              if (matchData) {
                const dia = parseInt(matchData[1]);
                const mes = parseInt(matchData[2]) - 1; // JS conta meses de 0 a 11
                let ano = matchData[3]
                  ? parseInt(matchData[3])
                  : new Date().getFullYear();

                // Se o ano for 2 dígitos (ex: 25), vira 2025
                if (ano < 100) ano += 2000;

                // Cria data de término (definindo hora para o final do dia 23:59)
                const dataTermino = new Date(
                  ano,
                  mes,
                  dia,
                  23,
                  59,
                  59
                ).getTime();

                // Salva apenas se for a data mais futura encontrada para esse usuário
                if (!mapaFerias[userId] || dataTermino > mapaFerias[userId]) {
                  mapaFerias[userId] = dataTermino;
                }
              }
            }
          });
        }
      } catch (errFerias) {
        console.error("Erro ao ler canal de férias:", errFerias);
      }
    }

    // =================================================================================
    // 2. BUSCA DADOS DE ADMISSÃO (Para pegar Nome e ID)
    // =================================================================================
    let dadosRP = {};
    if (org) {
      const targetAdm =
        org === "PRF"
          ? PRF_ADMISSAO_CH
          : org === "PMERJ"
          ? PMERJ_ADMISSAO_CH
          : ADMISSAO_CHANNEL_ID;

      if (targetAdm) {
        // ... (Mesma lógica de busca de admissão do seu código original) ...
        // Vou resumir para não estourar o limite, mas a lógica de admissão permanece a mesma
        // buscando 5 páginas de histórico
        let ultimoIdAdmissao = null;
        for (let i = 0; i < 5; i++) {
          let url = `https://discord.com/api/v10/channels/${targetAdm}/messages?limit=100`;
          if (ultimoIdAdmissao) url += `&before=${ultimoIdAdmissao}`;
          const r = await fetch(url, { headers });
          if (!r.ok) break;
          const msgs = await r.json();
          if (msgs.length === 0) break;

          msgs.forEach((m) => {
            const content = m.content;
            // Regex simples para capturar ID e Nome (ajuste conforme seu padrão)
            const matchId =
              content.match(/Passaporte:?\s*(\d+)/i) ||
              content.match(/ID:?\s*(\d+)/i);
            const matchNome = content.match(/Nome:?\s*(.+?)(\n|$)/i);
            const mention =
              m.mentions && m.mentions[0] ? m.mentions[0].id : null;

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
    }

    // =================================================================================
    // 3. MAPA DE ATIVIDADE (Chat)
    // =================================================================================
    let activityMap = {}; // { userId: { lastMsg: timestamp, username: string } }

    // Varre os canais de chat configurados
    for (const channelId of canaisPermitidos) {
      if (!channelId) continue;
      let ultimoIdBusca = null;

      // Busca 3 páginas de mensagens (300 msgs) por canal para garantir
      for (let i = 0; i < 3; i++) {
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
        if (ultimoIdBusca) url += `&before=${ultimoIdBusca}`;

        const resp = await fetch(url, { headers });
        if (!resp.ok) break;
        const msgs = await resp.json();
        if (msgs.length === 0) break;

        msgs.forEach((msg) => {
          const userId = msg.author.id;
          const ts = new Date(msg.timestamp).getTime();

          // Registra atividade do autor
          if (!activityMap[userId]) {
            activityMap[userId] = {
              lastMsg: ts,
              username: msg.author.username,
            };
          } else if (ts > activityMap[userId].lastMsg) {
            activityMap[userId].lastMsg = ts;
          }
          activityMap[userId].username = msg.author.username; // Atualiza nome se necessário

          // (Opcional) Verifica menções para atualizar atividade de quem foi mencionado?
          // Geralmente inatividade conta só se a pessoa FALOU, não se foi mencionada.
          // Removi a lógica de menção para ser mais rigoroso (tem que falar pra contar).
        });

        ultimoIdBusca = msgs[msgs.length - 1].id;
      }
    }

    // =================================================================================
    // 4. LISTAR MEMBROS E CALCULAR INATIVIDADE
    // =================================================================================
    const targetRole =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Busca membros do Discord (limitado a 1000)
    const membersResp = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );

    if (!membersResp.ok) {
      throw new Error("Falha ao buscar membros da guilda.");
    }

    const members = await membersResp.json();
    const inativos = [];
    const agora = Date.now();

    for (const member of members) {
      // Ignora bots
      if (member.user.bot) continue;

      // Verifica se tem o cargo da polícia selecionada
      if (!member.roles.includes(targetRole)) continue;

      // --- LÓGICA DE FÉRIAS (VACATION LOGIC) ---
      const temCargoFerias = member.roles.includes(FERIAS_ROLE_ID);
      const fimFeriasTimestamp = mapaFerias[member.user.id];

      let protegidoPorFerias = false;

      // Cenário 1: Tem cargo de férias
      if (temCargoFerias) {
        protegidoPorFerias = true;
      }

      // Cenário 2: Tem registro de data no canal
      if (fimFeriasTimestamp) {
        // Se a data de término é HOJE ou no FUTURO, está protegido
        if (agora <= fimFeriasTimestamp) {
          protegidoPorFerias = true;
        }
      }

      if (protegidoPorFerias) continue; // PULA ESTE MEMBRO, NÃO É INATIVO

      // --- CÁLCULO DE DIAS ---

      // Data da última mensagem real
      let lastActivity = activityMap[member.user.id]?.lastMsg || 0;

      // CORREÇÃO CRÍTICA DO "LOBO":
      // Se ele voltou de férias ontem, a última mensagem dele pode ser de 30 dias atrás.
      // Mas ele não deve ser punido por isso.
      // Se existe uma data de fim de férias, e ela é mais recente que a última mensagem,
      // usamos o FIM DAS FÉRIAS como base para contar a inatividade.
      if (fimFeriasTimestamp && fimFeriasTimestamp > lastActivity) {
        lastActivity = fimFeriasTimestamp;
      }

      const diffMs = agora - lastActivity;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Considera inativo se > 3 dias (ajuste conforme sua regra)
      if (diffDays >= 3) {
        const dadosUser = dadosRP[member.user.id] || {};

        inativos.push({
          id: member.user.id,
          username: dadosUser.nome || member.user.username || "Desconhecido", // Prioriza nome do RP
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

    // Ordena por quem está inativo há mais tempo
    inativos.sort((a, b) => b.dias - a.dias);

    res.status(200).json(inativos);
  } catch (error) {
    console.error("Erro API Inativos:", error);
    res.status(500).json({ error: "Erro interno ao processar inatividade." });
  }
};
