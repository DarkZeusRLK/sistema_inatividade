module.exports = async (req, res) => {
  const { Discord_Bot_Token, GUILD_ID, POLICE_ROLE_ID } = process.env;

  try {
    // 1. Busca canais (Texto: 0, Anúncios: 5, Threads: 11 e 12)
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      {
        headers: { Authorization: `Bot ${Discord_Bot_Token}` },
      }
    );
    const allChannels = await channelsRes.json();

    // Filtra canais onde mensagens costumam ser enviadas
    const validChannelTypes = [0, 5, 11, 12];
    const textChannels = allChannels.filter((c) =>
      validChannelTypes.includes(c.type)
    );

    // 2. Busca membros da Polícia
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      {
        headers: { Authorization: `Bot ${Discord_Bot_Token}` },
      }
    );
    const members = await membersRes.json();
    const police = members.filter((m) => m.roles.includes(POLICE_ROLE_ID));

    let activityMap = {};
    police.forEach((p) => {
      activityMap[p.user.id] = {
        id: p.user.id,
        name: p.nick || p.user.username,
        lastMsg: 0,
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // 3. Varredura Otimizada
    // Processamos os canais em paralelo para ganhar tempo
    await Promise.all(
      textChannels.map(async (channel) => {
        try {
          // Buscamos as 100 mais recentes (geralmente cobre "ontem")
          const msgRes = await fetch(
            `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100`,
            {
              headers: { Authorization: `Bot ${Discord_Bot_Token}` },
            }
          );

          if (msgRes.status === 200) {
            const msgs = await msgRes.json();
            if (Array.isArray(msgs)) {
              msgs.forEach((msg) => {
                const uId = msg.author.id;
                if (activityMap[uId]) {
                  const ts = new Date(msg.timestamp).getTime();
                  // Só atualiza se a mensagem encontrada for MAIS NOVA que a já registrada
                  if (ts > activityMap[uId].lastMsg) {
                    activityMap[uId].lastMsg = ts;
                  }
                }
              });
            }
          }
        } catch (e) {
          // Ignora erros de permissão em canais específicos
        }
      })
    );

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
