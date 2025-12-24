module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    CORE_ROLE_ID,
    ENSINO_ROLE_ID,
    CGPC_ROLE_ID,
    FERIAS_ROLE_ID,
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
    const { start, end } = req.query;

    // Converte datas para timestamp (Início: 00:00:00 / Fim: 23:59:59)
    const dataInicioMs = start
      ? new Date(start + "T00:00:00").getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const dataFimMs = end ? new Date(end + "T23:59:59").getTime() : Date.now();

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
        id: m.user.id,
        name: m.nick || m.user.username,
        temCGPC: m.roles.includes(CGPC_ROLE_ID),
        temEnsino: m.roles.includes(ENSINO_ROLE_ID),
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        roles: m.roles,
        acoes: 0,
        cgpc: 0,
        ensino_cursos: 0,
        ensino_recrut: 0,
      };
    });

    async function processarCanal(channelId, tipo) {
      const r = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
        { headers }
      );
      if (!r.ok) return;
      const msgs = await r.json();

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < dataInicioMs || ts > dataFimMs) return;

        if (tipo === "ACOES") {
          Object.keys(metaMap).forEach((id) => {
            if (msg.content.includes(id)) metaMap[id].acoes++;
          });
        } else if (tipo === "CGPC") {
          const roleAudit = [
            AUDITOR_PERICIAL_ROLE_ID,
            AUDITOR_PRISIONAL_ROLE_ID,
          ];
          if (
            metaMap[msg.author.id] &&
            metaMap[msg.author.id].roles.some((r) => roleAudit.includes(r))
          )
            metaMap[msg.author.id].cgpc++;
        } else if (tipo === "ENSINO") {
          Object.keys(metaMap).forEach((id) => {
            if (
              metaMap[id].temEnsino &&
              (msg.author.id === id || msg.content.includes(id))
            ) {
              if (channelId === CH_CURSO_ID) metaMap[id].ensino_cursos++;
              else metaMap[id].ensino_recrut++;
            }
          });
        }
      });
    }

    await Promise.all([
      processarCanal(CH_ACOES_ID, "ACOES"),
      processarCanal(CH_PERICIAL_ID, "CGPC"),
      processarCanal(CH_PRISIONAL_ID, "CGPC"),
      processarCanal(CH_RECRUTAMENTO_ID, "ENSINO"),
      processarCanal(CH_CURSO_ID, "ENSINO"),
    ]);

    res.status(200).json(Object.values(metaMap));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
