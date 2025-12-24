module.exports = async (req, res) => {
  const { Discord_Bot_Token, GUILD_ID, POLICE_ROLE_ID } = process.env;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

    // 1. Busca Canais
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      { headers }
    );
    const allChannels = await channelsRes.json();
    const textChannels = allChannels.filter((c) =>
      [0, 5, 11, 12].includes(c.type)
    );

    // 2. Busca Membros
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
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

    // 3. Varredura Sequencial (Evita Rate Limit e perda de dados)
    // Buscamos 100 msgs por canal, o que é suficiente para cobrir os últimos dias na maioria dos canais
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
        // Pequena pausa para não ser bloqueado pelo Discord
        await new Promise((r) => setTimeout(r, 50));
      } catch (e) {
        continue;
      }
    }

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
