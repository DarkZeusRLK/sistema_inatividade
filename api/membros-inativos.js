module.exports = async (req, res) => {
  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
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
  const TARGET_ROLE_ID =
    org === "PRF"
      ? PRF_ROLE_ID
      : org === "PMERJ"
      ? PMERJ_ROLE_ID
      : POLICE_ROLE_ID;
  const TARGET_ADMISSAO_CH =
    org === "PRF"
      ? PRF_ADMISSAO_CH
      : org === "PMERJ"
      ? PMERJ_ADMISSAO_CH
      : ADMISSAO_CHANNEL_ID;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

    // 1. Busca Banco de Dados de Admissão
    let dadosRP = {};
    let ultimoIdAdmissao = null;
    if (TARGET_ADMISSAO_CH) {
      for (let i = 0; i < 10; i++) {
        let url = `https://discord.com/api/v10/channels/${TARGET_ADMISSAO_CH}/messages?limit=100`;
        if (ultimoIdAdmissao) url += `&before=${ultimoIdAdmissao}`;
        const resAdm = await fetch(url, { headers });
        if (!resAdm.ok) break;
        const msgs = await resAdm.json();
        if (msgs.length === 0) break;

        msgs.forEach((msg) => {
          const mencao = msg.content.match(/<@!?(\d+)>/);
          if (mencao) {
            const userId = mencao[1];
            if (!dadosRP[userId]) {
              const nomeMatch = msg.content
                .replace(/\*/g, "")
                .match(/NOME\s*(?:DO\s*RP)?:\s*(.*)/i);
              const idMatch = msg.content.match(
                /ID(?:\s*DA\s*CIDADE)?:\s*(\d+)/i
              );
              dadosRP[userId] = {
                nome: nomeMatch ? nomeMatch[1].split("\n")[0].trim() : null,
                cidadeId: idMatch ? idMatch[1].trim() : null,
              };
            }
          }
        });
        ultimoIdAdmissao = msgs[msgs.length - 1].id;
      }
    }

    // 2. Busca Membros do Servidor
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();
    const oficiaisDaForca = members.filter(
      (m) =>
        m.roles.includes(TARGET_ROLE_ID) &&
        (!FERIAS_ROLE_ID || !m.roles.includes(FERIAS_ROLE_ID))
    );

    // 3. Montagem do Mapa de Atividade
    let activityMap = {};
    oficiaisDaForca.forEach((p) => {
      const infoRP = dadosRP[p.user.id];
      const nick = p.nick || p.user.username;
      activityMap[p.user.id] = {
        id: p.user.id,
        name: nick,
        rpName: infoRP?.nome || "Não consta em admissão",
        cidadeId: nick.match(/\|\s*(\d+)/)?.[1] || infoRP?.cidadeId || "---",
        lastMsg: 0, // Inicializa em 0
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // 4. Varredura PROFUNDA nos canais permitidos (PAGINAÇÃO)
    for (const channelId of canaisPermitidos) {
      let ultimoIdMensagemBusca = null;

      // Busca até 500 mensagens por canal (5 páginas de 100) para garantir encontrar a data
      for (let p = 0; p < 5; p++) {
        try {
          let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
          if (ultimoIdMensagemBusca) url += `&before=${ultimoIdMensagemBusca}`;

          const msgRes = await fetch(url, { headers });
          if (!msgRes.ok) break;

          const msgs = await msgRes.json();
          if (msgs.length === 0) break;

          msgs.forEach((msg) => {
            const ts = new Date(msg.timestamp).getTime();

            // A: Autor da mensagem
            if (
              activityMap[msg.author.id] &&
              ts > activityMap[msg.author.id].lastMsg
            ) {
              activityMap[msg.author.id].lastMsg = ts;
            }

            // B: Menções diretas
            if (msg.mentions && msg.mentions.length > 0) {
              msg.mentions.forEach((mencionado) => {
                if (
                  activityMap[mencionado.id] &&
                  ts > activityMap[mencionado.id].lastMsg
                ) {
                  activityMap[mencionado.id].lastMsg = ts;
                }
              });
            }
          });

          ultimoIdMensagemBusca = msgs[msgs.length - 1].id;
        } catch (e) {
          break;
        }
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
