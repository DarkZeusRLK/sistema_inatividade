const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = async (req, res) => {
  const { Discord_Bot_Token, GUILD_ID, POLICE_ROLE_ID } = process.env;

  try {
    // 1. BUSCAR TODOS OS CANAIS DO SERVIDOR
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      {
        headers: { Authorization: `Bot ${Discord_Bot_Token}` },
      }
    );
    const allChannels = await channelsRes.json();

    // Filtra apenas canais de TEXTO (type: 0) e ignora categorias ou canais de voz
    const textChannels = allChannels.filter((c) => c.type === 0);

    // 2. BUSCAR TODOS OS MEMBROS
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      {
        headers: { Authorization: `Bot ${Discord_Bot_Token}` },
      }
    );
    const members = await membersRes.json();

    // Filtra apenas quem tem o cargo de Polícia
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

    // 3. VASCULHAR TODOS OS CANAIS ENCONTRADOS
    // Usamos Promise.all para ganhar velocidade na consulta
    await Promise.all(
      textChannels.map(async (channel) => {
        try {
          const msgRes = await fetch(
            `https://discord.com/api/v10/channels/${channel.id}/messages?limit=50`,
            {
              headers: { Authorization: `Bot ${Discord_Bot_Token}` },
            }
          );
          const msgs = await msgRes.json();

          if (Array.isArray(msgs)) {
            msgs.forEach((msg) => {
              const uId = msg.author.id;
              const ts = new Date(msg.timestamp).getTime();
              if (activityMap[uId] && ts > activityMap[uId].lastMsg) {
                activityMap[uId].lastMsg = ts;
              }
            });
          }
        } catch (e) {
          // Silenciosamente ignora canais que o bot não tem permissão para ler
        }
      })
    );

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
