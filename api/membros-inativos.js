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
    CHAT_ID_BUSCAR, // IDs permitidos separados por vírgula no .env
  } = process.env;

  // Transforma a string do .env em um Array de IDs limpos
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
    let ultimoIdMsg = null;
    if (TARGET_ADMISSAO_CH) {
      for (let i = 0; i < 10; i++) {
        let url = `https://discord.com/api/v10/channels/${TARGET_ADMISSAO_CH}/messages?limit=100`;
        if (ultimoIdMsg) url += `&before=${ultimoIdMsg}`;
        const admissaoRes = await fetch(url, { headers });
        if (!admissaoRes.ok) break;
        const msgsAdmissao = await admissaoRes.json();
        if (msgsAdmissao.length === 0) break;

        msgsAdmissao.forEach((msg) => {
          const conteudoLimpo = msg.content.replace(/\*/g, "");
          const mencao = conteudoLimpo.match(/<@!?(\d+)>/);
          const nomeMatch = conteudoLimpo.match(/NOME\s*(?:DO\s*RP)?:\s*(.*)/i);
          const idMatch = conteudoLimpo.match(
            /ID(?:\s*DA\s*CIDADE)?:\s*(\d+)/i
          );
          if (mencao) {
            const userId = mencao[1];
            if (!dadosRP[userId]) {
              dadosRP[userId] = {
                nome: nomeMatch ? nomeMatch[1].split("\n")[0].trim() : null,
                cidadeId: idMatch ? idMatch[1].trim() : null,
              };
            }
          }
        });
        ultimoIdMsg = msgsAdmissao[msgsAdmissao.length - 1].id;
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
      const nicknameDiscord = p.nick || p.user.username;
      let idFinal =
        nicknameDiscord.match(/\|\s*(\d+)/)?.[1] || infoRP?.cidadeId || "---";

      activityMap[p.user.id] = {
        id: p.user.id,
        name: nicknameDiscord,
        rpName: infoRP?.nome || "Não consta em admissão",
        cidadeId: idFinal,
        lastMsg: 0,
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // 4. Varredura APENAS nos canais definidos no CHAT_ID_BUSCAR
    // Isso ignora canais de hierarquia, logs automáticos e chats gerais inúteis.
    for (const channelId of canaisPermitidos) {
      try {
        const msgRes = await fetch(
          `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
          { headers }
        );
        if (!msgRes.ok) continue;

        const msgs = await msgRes.json();
        msgs.forEach((msg) => {
          const ts = new Date(msg.timestamp).getTime();

          // Checa se o AUTOR da mensagem é um oficial monitorado
          if (activityMap[msg.author.id]) {
            if (ts > activityMap[msg.author.id].lastMsg) {
              activityMap[msg.author.id].lastMsg = ts;
            }
          }

          // Checa se oficiais monitorados foram MENCIONADOS (ex: Relatórios de Patrulha)
          if (msg.mentions && msg.mentions.length > 0) {
            msg.mentions.forEach((mencionado) => {
              if (activityMap[mencionado.id]) {
                if (ts > activityMap[mencionado.id].lastMsg) {
                  activityMap[mencionado.id].lastMsg = ts;
                }
              }
            });
          }
        });
      } catch (e) {
        console.error(`Erro ao ler canal ${channelId}:`, e.message);
        continue;
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
