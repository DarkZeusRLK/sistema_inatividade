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

    // 1. Busca Banco de Dados de Admissão (Mapeia ID do Discord -> Nome no RP)
    let nomesRP = {};
    const admissaoRes = await fetch(
      `https://discord.com/api/v10/channels/${ADMISSAO_CHANNEL_ID}/messages?limit=100`,
      { headers }
    );
    if (admissaoRes.ok) {
      const msgsAdmissao = await admissaoRes.json();
      msgsAdmissao.forEach((msg) => {
        // Procura por uma menção de usuário na mensagem
        const mencao = msg.content.match(/<@!?(\d+)>/);
        // Procura pelo termo "NOME DO RP:" (ignora maiúsculas/minúsculas)
        const nomeMatch = msg.content.match(/NOME DO RP:\s*(.*)/i);

        if (mencao && nomeMatch) {
          const userId = mencao[1];
          const nomeExtraido = nomeMatch[1].split("\n")[0].trim(); // Pega apenas a linha do nome
          nomesRP[userId] = nomeExtraido;
        }
      });
    }

    // 2. Busca Canais e Membros (Filtro de Polícia e Férias)
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
        // Se achou no canal de admissão, usa. Se não, tenta pegar do apelido
        name: nomesRP[p.user.id] || p.nick || p.user.username,
        lastMsg: 0,
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
        fullNickname: p.nick || p.user.username, // Guardamos o apelido completo para extrair o ID (ex: 722)
      };
    });

    // 3. Varredura de Atividade
    for (const channel of textChannels) {
      try {
        const msgRes = await fetch(
          `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100`,
          { headers }
        );
        if (msgRes.ok) {
          (await msgRes.json()).forEach((msg) => {
            if (activityMap[msg.author.id]) {
              const ts = new Date(msg.timestamp).getTime();
              if (ts > activityMap[msg.author.id].lastMsg)
                activityMap[msg.author.id].lastMsg = ts;
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
