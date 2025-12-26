module.exports = async (req, res) => {
  const { org } = req.query; // Recebe 'PRF', 'PMERJ' ou 'PCERJ'
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    // IDs PCERJ
    POLICE_ROLE_ID,
    ADMISSAO_CHANNEL_ID,
    // IDs PRF
    PRF_ROLE_ID,
    PRF_ADMISSAO_CH,
    // IDs PMERJ
    PMERJ_ROLE_ID,
    PMERJ_ADMISSAO_CH,
  } = process.env;

  // 1. Definição dinâmica de alvos baseada na organização logada
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

    // 2. Busca Banco de Dados de Admissão Específico da Org
    let nomesRP = {};
    let ultimoIdMsg = null;

    // Busca até 500 mensagens no canal/tópico de admissão da força selecionada
    if (TARGET_ADMISSAO_CH) {
      for (let i = 0; i < 5; i++) {
        let url = `https://discord.com/api/v10/channels/${TARGET_ADMISSAO_CH}/messages?limit=100`;
        if (ultimoIdMsg) url += `&before=${ultimoIdMsg}`;

        const admissaoRes = await fetch(url, { headers });
        if (!admissaoRes.ok) break;

        const msgsAdmissao = await admissaoRes.json();
        if (msgsAdmissao.length === 0) break;

        msgsAdmissao.forEach((msg) => {
          const conteudoLimpo = msg.content.replace(/\*/g, "");
          const mencao = conteudoLimpo.match(/<@!?(\d+)>/);
          const nomeMatch = conteudoLimpo.match(/NOME\s*DO\s*RP:\s*(.*)/i);

          if (mencao && nomeMatch) {
            const userId = mencao[1];
            const nomeExtraido = nomeMatch[1].split("\n")[0].trim();
            if (!nomesRP[userId]) nomesRP[userId] = nomeExtraido;
          }
        });
        ultimoIdMsg = msgsAdmissao[msgsAdmissao.length - 1].id;
      }
    }

    // 3. Busca Canais e Membros do Servidor
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      { headers }
    );
    const textChannels = (await channelsRes.json()).filter((c) =>
      [0, 5, 11, 12].includes(c.type)
    );

    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    // Filtra apenas membros da organização logada que NÃO estão de férias
    const oficiaisDaForca = members.filter((m) => {
      return (
        m.roles.includes(TARGET_ROLE_ID) &&
        (!FERIAS_ROLE_ID || !m.roles.includes(FERIAS_ROLE_ID))
      );
    });

    let activityMap = {};
    oficiaisDaForca.forEach((p) => {
      activityMap[p.user.id] = {
        id: p.user.id,
        name: p.nick || p.user.username,
        rpName: nomesRP[p.user.id] || p.nick || p.user.username,
        lastMsg: 0,
        joinedAt: new Date(p.joined_at).getTime(),
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
        fullNickname: p.nick || p.user.username,
      };
    });

    // 4. Varredura de Atividade em Canais de Texto e Tópicos
    for (const channel of textChannels) {
      try {
        const msgRes = await fetch(
          `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100`,
          { headers }
        );
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          msgs.forEach((msg) => {
            if (activityMap[msg.author.id]) {
              const ts = new Date(msg.timestamp).getTime();
              if (ts > activityMap[msg.author.id].lastMsg) {
                activityMap[msg.author.id].lastMsg = ts;
              }
            }
          });
        }
        await new Promise((r) => setTimeout(r, 30)); // Delay para evitar rate limit
      } catch (e) {
        continue;
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
