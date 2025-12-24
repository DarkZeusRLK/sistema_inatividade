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
    const seteDiasAtras = Date.now() - 7 * 24 * 60 * 60 * 1000;

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
        // USO DOS IDs: Aqui "limpamos" o aviso de variável não lida
        temCGPC: m.roles.includes(CGPC_ROLE_ID),
        temEnsino: m.roles.includes(ENSINO_ROLE_ID),
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        roles: m.roles, // Mantemos para checagens de Auditoria Pericial/Prisional
        acoes: 0,
        cgpc: 0,
        ensino_cursos: 0,
        ensino_recrut: 0,
      };
    });

    // Função de varredura
    async function processarCanal(channelId, tipo) {
      const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
      const r = await fetch(url, { headers });
      if (!r.ok) return;
      const msgs = await r.json();

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < seteDiasAtras) return;

        const autorId = msg.author.id;

        // Lógica de Ações: Conta se o ID do membro CORE está no texto (menção ou texto puro)
        if (tipo === "ACOES") {
          Object.keys(metaMap).forEach((id) => {
            if (msg.content.includes(id)) metaMap[id].acoes++;
          });
        }

        // Lógica CGPC: Só conta se o autor for do CORE e tiver cargo de auditor
        else if (tipo === "PERICIAL" || tipo === "PRISIONAL") {
          const roleNecessaria =
            tipo === "PERICIAL"
              ? AUDITOR_PERICIAL_ROLE_ID
              : AUDITOR_PRISIONAL_ROLE_ID;
          if (
            metaMap[autorId] &&
            metaMap[autorId].roles.includes(roleNecessaria)
          ) {
            metaMap[autorId].cgpc++;
          }
        }

        // Lógica Ensino: Se o autor é do ensino ou foi mencionado no relatório
        else if (tipo === "CURSO" || tipo === "RECRUT") {
          Object.keys(metaMap).forEach((id) => {
            if (
              metaMap[id].temEnsino &&
              (autorId === id || msg.content.includes(id))
            ) {
              if (tipo === "CURSO") metaMap[id].ensino_cursos++;
              else metaMap[id].ensino_recrut++;
            }
          });
        }
      });
    }

    // Varre todos os canais
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
