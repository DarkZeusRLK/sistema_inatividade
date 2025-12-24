module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    CORE_ROLE_ID,
    ENSINO_ROLE_ID,
    CGPC_ROLE_ID,
    AUDITOR_PERICIAL_ROLE_ID,
    AUDITOR_PRISIONAL_ROLE_ID,
    CH_ACOES_ID,
    CH_PERICIAL_ID,
    CH_PRISIONAL_ID,
    CH_RECRUTAMENTO_ID,
    CH_CURSO_ID,
  } = process.env;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };
    const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // 1. Buscar Membros da CORE
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const allMembers = await membersRes.json();
    const coreMembers = allMembers.filter((m) =>
      m.roles.includes(CORE_ROLE_ID)
    );

    let metaMap = {};
    coreMembers.forEach((m) => {
      metaMap[m.user.id] = {
        name: m.nick || m.user.username,
        roles: m.roles,
        acoes: 0,
        cgpc: 0,
        ensino_cursos: 0,
        ensino_recrut: 0,
      };
    });

    // Função auxiliar para buscar e processar mensagens
    async function processarCanal(channelId, tipo) {
      const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
      const r = await fetch(url, { headers });
      if (!r.ok) return;
      const msgs = await r.json();

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < seteDiasAtras) return;

        if (tipo === "ACOES") {
          // Conta menções nas ações
          Object.keys(metaMap).forEach((userId) => {
            if (msg.content.includes(userId)) metaMap[userId].acoes++;
          });
        } else if (tipo === "PERICIAL" || tipo === "PRISIONAL") {
          // Só conta se o autor tiver o cargo de auditor específico
          const auditorRole =
            tipo === "PERICIAL"
              ? AUDITOR_PERICIAL_ROLE_ID
              : AUDITOR_PRISIONAL_ROLE_ID;
          if (
            metaMap[msg.author.id] &&
            metaMap[msg.author.id].roles.includes(auditorRole)
          ) {
            metaMap[msg.author.id].cgpc++;
          }
        } else if (tipo === "CURSO" || tipo === "RECRUT") {
          // Ensino: Mensagem enviada ou menção
          Object.keys(metaMap).forEach((userId) => {
            if (metaMap[userId].roles.includes(ENSINO_ROLE_ID)) {
              if (msg.author.id === userId || msg.content.includes(userId)) {
                if (tipo === "CURSO") metaMap[userId].ensino_cursos++;
                else metaMap[userId].ensino_recrut++;
              }
            }
          });
        }
      });
    }

    // Executa a busca nos 5 canais
    await Promise.all([
      processarCanal(CH_ACOES_ID, "ACOES"),
      processarCanal(CH_PERICIAL_ID, "PERICIAL"),
      processarCanal(CH_PRISIONAL_ID, "PRISIONAL"),
      processarCanal(CH_RECRUTAMENTO_ID, "RECRUT"),
      processarCanal(CH_CURSO_ID, "CURSO"),
    ]);

    res.status(200).json(Object.values(metaMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
