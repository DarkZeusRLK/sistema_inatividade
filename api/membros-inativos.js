module.exports = async (req, res) => {
  const { Discord_Bot_Token, GUILD_ID, POLICE_ROLE_ID } = process.env;

  try {
    const channelsRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/channels`,
      {
        headers: { Authorization: `Bot ${Discord_Bot_Token}` },
      }
    );
    const allChannels = await channelsRes.json();
    const textChannels = allChannels.filter((c) => c.type === 0);

    // 2. Busca os membros
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

    // 3. Varredura de mensagens (Limitado a 50 msgs por canal para velocidade)
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
              if (activityMap[msg.author.id] && msg.timestamp) {
                const ts = new Date(msg.timestamp).getTime();
                if (ts > activityMap[msg.author.id].lastMsg) {
                  activityMap[msg.author.id].lastMsg = ts;
                }
              }
            });
          }
        } catch (e) {
          /* Canal sem permissão */
        }
      })
    );

    res.status(200).json(Object.values(activityMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
