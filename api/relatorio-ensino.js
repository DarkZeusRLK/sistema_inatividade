module.exports = async (req, res) => {
  const { org } = req.query;
  const { Discord_Bot_Token, GUILD_ID, ENSINO_ROLES_MATRIZES_ID } = process.env;

  const CHANNELS_ENV = process.env[`${org}_ENSINO_CH`];
  const canaisEnsino = CHANNELS_ENV
    ? CHANNELS_ENV.split(",").map((id) => id.trim())
    : [];
  const instructorRoles = ENSINO_ROLES_MATRIZES_ID
    ? ENSINO_ROLES_MATRIZES_ID.split(",").map((id) => id.trim())
    : [];

  const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

  try {
    // 1. Busca membros para identificar quem são os instrutores ativos
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const members = await membersRes.json();

    let ensinoMap = {};
    const instrutores = members.filter((m) =>
      m.roles.some((r) => instructorRoles.includes(r))
    );

    instrutores.forEach((p) => {
      ensinoMap[p.user.id] = {
        id: p.user.id,
        name: p.nick || p.user.username,
        cursos: 0,
        recs: 0,
        total: 0,
        avatar: p.user.avatar
          ? `https://cdn.discordapp.com/avatars/${p.user.id}/${p.user.avatar}.png`
          : null,
      };
    });

    // 2. Varredura por MENÇÕES nos canais
    for (let i = 0; i < canaisEnsino.length; i++) {
      const channelId = canaisEnsino[i];

      // Lógica de abas: Na PMERJ o index 2 é Recrutamento. Nas outras, o index 1 é Recrutamento.
      const isRecrutamento =
        (org === "PMERJ" && i === 2) || (org !== "PMERJ" && i === 1);

      let ultimoId = null;
      for (let p = 0; p < 15; p++) {
        // Varredura de 1500 mensagens por canal
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          ultimoId ? `&before=${ultimoId}` : ""
        }`;
        const msgRes = await fetch(url, { headers });
        const msgs = await msgRes.json();
        if (!msgs || msgs.length === 0) break;

        msgs.forEach((msg) => {
          // Extrai todas as menções da mensagem (texto e embeds)
          const idsMencionados = new Set();

          // Menções nativas do Discord
          if (msg.mentions)
            msg.mentions.forEach((m) => idsMencionados.add(m.id));

          // Menções em texto bruto ou embeds (ex: <@ID>)
          const conteudoCompleto =
            msg.content + JSON.stringify(msg.embeds || {});
          const matches = conteudoCompleto.match(/<@!?(\d+)>/g);
          if (matches)
            matches.forEach((m) => idsMencionados.add(m.replace(/\D/g, "")));

          // Para cada instrutor mencionado nesta mensagem, conta +1 na meta
          idsMencionados.forEach((id) => {
            if (ensinoMap[id]) {
              if (isRecrutamento) ensinoMap[id].recs++;
              else ensinoMap[id].cursos++;
              ensinoMap[id].total++;
            }
          });
        });
        ultimoId = msgs[msgs.length - 1].id;
      }
    }

    res.status(200).json(Object.values(ensinoMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
