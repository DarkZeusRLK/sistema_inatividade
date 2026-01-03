// Importação dinâmica para compatibilidade total na Vercel
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = async (req, res) => {
  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID, // <--- OBRIGATÓRIO TER NO .ENV
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

            // Tenta pegar ID pela menção ou pelo texto
            if (msg.mentions && msg.mentions.length > 0) {
              userId = msg.mentions[0].id;
            } else {
              const content = msg.content + JSON.stringify(msg.embeds || []);
              const matchID =
                content.match(/<@!?(\d+)>/) || content.match(/(\d{17,20})/);
              if (matchID) userId = matchID[1];
            }

            if (userId) {
              const texto = (
                msg.content +
                " " +
                JSON.stringify(msg.embeds || [])
              ).toLowerCase();
              // Regex: Procura "Volta", "Até", "Fim" seguido de data DD/MM
              const regexData =
                /(?:término|volta|retorno|até|fim)[\s\S]*?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
              const matchData = texto.match(regexData);

              if (matchData) {
                const dia = parseInt(matchData[1]);
                const mes = parseInt(matchData[2]) - 1;
                let ano = matchData[3]
                  ? parseInt(matchData[3])
                  : new Date().getFullYear();
                if (ano < 100) ano += 2000;

                // Define a data para o FIM do dia (23:59:59)
                const dataTermino = new Date(
                  ano,
                  mes,
                  dia,
                  23,
                  59,
                  59
                ).getTime();

                // Guarda a data mais futura encontrada para o usuário
                if (!mapaFerias[userId] || dataTermino > mapaFerias[userId]) {
                  mapaFerias[userId] = dataTermino;
                }
              }
            }
          });
        }
      } catch (err) {
        console.error("Erro ao ler férias:", err);
      }
    }

    // =================================================================================
    // 2. BUSCA BANCO DE DADOS DE ADMISSÃO
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
        let ultimoIdAdmissao = null;
        // Limita a 5 páginas para não estourar tempo
        for (let i = 0; i < 5; i++) {
          let url = `https://discord.com/api/v10/channels/${targetAdm}/messages?limit=100`;
          if (ultimoIdAdmissao) url += `&before=${ultimoIdAdmissao}`;

          const resAdm = await fetch(url, { headers });
          if (!resAdm.ok) break;
          const msgs = await resAdm.json();
          if (!msgs || msgs.length === 0) break;

          msgs.forEach((msg) => {
            const m = msg.content.match(/<@!?(\d+)>/);
            if (m && !dadosRP[m[1]]) {
              const nome = msg.content
                .replace(/\*/g, "")
                .match(/NOME\s*(?:DO\s*RP)?:\s*(.*)/i);
              const idCid = msg.content.match(
                /ID(?:\s*DA\s*CIDADE)?:\s*(\d+)/i
              );
              dadosRP[m[1]] = {
                nome: nome
                  ? nome[1].split("\n")[0].trim()
                  : "Nome não identificado",
                cidadeId: idCid ? idCid[1].trim() : "---",
              };
            }
          });
          ultimoIdAdmissao = msgs[msgs.length - 1].id;
        }
      }
    }

    // =================================================================================
    // 3. BUSCA MEMBROS E FILTRA POR CARGO
    // =================================================================================
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );

    if (!membersRes.ok) throw new Error("Erro ao buscar membros do Discord");
    const members = await membersRes.json();

    const TARGET_ROLE =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Filtra membros da polícia
    const oficiaisDaForca = members.filter((m) =>
      m.roles.includes(TARGET_ROLE)
    );

    // =================================================================================
    // 4. VARREDURA DE CHATS (PARALELA PARA EVITAR TIMEOUT)
    // =================================================================================
    let chatActivity = {}; // { userId: timestamp }

    // Cria array de promessas para buscar todos canais ao mesmo tempo
    const promises = canaisPermitidos.map(async (channelId) => {
      let ultimoId = null;
      // Busca até 10 páginas (1000 mensagens) por canal
      for (let p = 0; p < 10; p++) {
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
        if (ultimoId) url += `&before=${ultimoId}`;

        try {
          const r = await fetch(url, { headers });
          if (!r.ok) break;
          const m = await r.json();
          if (!m || m.length === 0) break;

          m.forEach((msg) => {
            const ts = new Date(msg.timestamp).getTime();
            const userId = msg.author.id;

            // Atualiza ultima msg do autor
            if (!chatActivity[userId] || ts > chatActivity[userId]) {
              chatActivity[userId] = ts;
            }
          });
          ultimoId = m[m.length - 1].id;
        } catch (e) {
          break;
        }
      }
    });

    await Promise.all(promises);

    // =================================================================================
    // 5. MONTAGEM FINAL DO OBJETO (COM LÓGICA DO LOBO/DATAS)
    // =================================================================================
    let resultadoFinal = {};
    const agora = Date.now();

    oficiaisDaForca.forEach((p) => {
      const userId = p.user.id;
      const nick = p.nick || p.user.username;

      // Verifica datas
      const fimFerias = mapaFerias[userId];
      let ultimaMensagem = chatActivity[userId] || 0;

      // LÓGICA DO LOBO:
      // Se a data de fim das férias for MAIOR que a data da última mensagem,
      // consideramos que a atividade dele foi no dia que acabou as férias.
      // Isso impede que ele fique inativo logo após voltar.
      if (fimFerias && fimFerias > ultimaMensagem) {
        ultimaMensagem = fimFerias;
      }

      // Se a data de fim das férias é HOJE ou FUTURA, ele está protegido (Data no futuro)
      // Ajustamos a data para agora para o diff ser 0.
      if (fimFerias && fimFerias >= agora) {
        ultimaMensagem = agora;
      }

      const estaDeFeriasCargo =
        FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);

      resultadoFinal[userId] = {
        id: userId,
        name: nick,
        rpName: dadosRP[userId]?.nome || "Não consta em admissão",
        cidadeId:
          nick.match(/\|\s*(\d+)/)?.[1] || dadosRP[userId]?.cidadeId || "---",

        // Aqui enviamos a data "ajustada". Se ele voltou ontem, a data será ontem.
        lastMsg: ultimaMensagem,

        isFerias: estaDeFeriasCargo || (fimFerias && fimFerias >= agora),
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${userId}/${p.user.avatar}.png`
          : "https://cdn.discordapp.com/embed/avatars/0.png",
      };
    });

    res.status(200).json(Object.values(resultadoFinal));
  } catch (err) {
    console.error("Erro API:", err);
    res.status(500).json({ error: err.message });
  }
};
