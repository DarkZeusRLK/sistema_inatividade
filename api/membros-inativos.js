// O Node.js na Vercel já possui fetch nativo.
module.exports = async (req, res) => {
  const { Discord_Bot_Token, GUILD_ID, POLICE_ROLE_ID } = process.env;

  try {
    // 1. Busca todos os canais do servidor
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      {
        headers: { Authorization: `Bot ${Discord_Bot_Token}` },
      }
    );
    const allChannels = await channelsRes.json();
    const textChannels = allChannels.filter((c) => c.type === 0);

    // 2. Busca os membros com cargo de polícia
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

    // 3. Varredura Profunda (200 mensagens por canal)
    await Promise.all(
      textChannels.map(async (channel) => {
        try {
          // Primeira busca (100 mensagens)
          let res1 = await fetch(
            `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100`,
            {
              headers: { Authorization: `Bot ${Discord_Bot_Token}` },
            }
          );
          let msgs = await res1.json();

          if (Array.isArray(msgs) && msgs.length > 0) {
            processMessages(msgs, activityMap);

            // Se retornou 100, vamos buscar as próximas 100 (totalizando 200)
            if (msgs.length === 100) {
              const lastId = msgs[msgs.length - 1].id;
              let res2 = await fetch(
                `https://discord.com/api/v10/channels/${channel.id}/messages?limit=100&before=${lastId}`,
                {
                  headers: { Authorization: `Bot ${Discord_Bot_Token}` },
                }
              );
              let msgs2 = await res2.json();
              if (Array.isArray(msgs2)) processMessages(msgs2, activityMap);
            }
          }
        } catch (e) {
          /* Ignora canais sem permissão */
        }
      })
    );

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Função auxiliar para processar as mensagens e atualizar o mapa
function processMessages(msgs, activityMap) {
  msgs.forEach((msg) => {
    if (activityMap[msg.author.id]) {
      const ts = new Date(msg.timestamp).getTime();
      if (ts > activityMap[msg.author.id].lastMsg) {
        activityMap[msg.author.id].lastMsg = ts;
      }
    }
  });
}
