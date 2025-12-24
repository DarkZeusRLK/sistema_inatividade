module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    POLICE_ROLE_ID,
    FERIAS_ROLE_ID,
    ADMISSAO_CHANNEL_ID,
  } = process.env;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

    // 1. Busca Banco de Dados de Admissão (Aumentado para 500 mensagens)
    let nomesRP = {};
    let ultimoIdMsg = null;

    // Fazemos 5 buscas de 100 mensagens para pegar um histórico de 500 fichas
    for (let i = 0; i < 5; i++) {
      let url = `https://discord.com/api/v10/channels/${ADMISSAO_CHANNEL_ID}/messages?limit=100`;
      if (ultimoIdMsg) url += `&before=${ultimoIdMsg}`;

      const admissaoRes = await fetch(url, { headers });
      if (!admissaoRes.ok) break;

      const msgsAdmissao = await admissaoRes.json();
      if (msgsAdmissao.length === 0) break;

      msgsAdmissao.forEach((msg) => {
        // Limpamos asteriscos (negrito) para não atrapalhar a leitura
        const conteudoLimpo = msg.content.replace(/\*/g, "");

        const mencao = conteudoLimpo.match(/<@!?(\d+)>/);
        const nomeMatch = conteudoLimpo.match(/NOME\s*DO\s*RP:\s*(.*)/i);

        if (mencao && nomeMatch) {
          const userId = mencao[1];
          // Pega o nome, remove espaços extras e quebras de linha
          const nomeExtraido = nomeMatch[1].split("\n")[0].trim();

          // Só salva se ainda não existir (garante que pega a admissão mais recente)
          if (!nomesRP[userId]) {
            nomesRP[userId] = nomeExtraido;
          }
        }
      });

      ultimoIdMsg = msgsAdmissao[msgsAdmissao.length - 1].id;
    }

    // 2. Busca Canais e Membros
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

    const police = members.filter((m) => {
      return (
        m.roles.includes(POLICE_ROLE_ID) &&
        (!FERIAS_ROLE_ID || !m.roles.includes(FERIAS_ROLE_ID))
      );
    });

    let activityMap = {};
    police.forEach((p) => {
      activityMap[p.user.id] = {
        id: p.user.id,
        // Prioridade: 1. Nome da Admissão | 2. Apelido Discord | 3. Nome de Usuário
        name: nomesRP[p.user.id] || p.nick || p.user.username,
        lastMsg: 0,
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
        fullNickname: p.nick || p.user.username,
      };
    });

    // 3. Varredura de Atividade (Mensagens)
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
        await new Promise((r) => setTimeout(r, 40));
      } catch (e) {
        continue;
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
