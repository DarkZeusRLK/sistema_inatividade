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
    CARGOS_IMUNES,
  } = process.env;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };
    const { start, end } = req.query;

    const dataInicioMs = start
      ? new Date(start + "T00:00:00").getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const dataFimMs = end ? new Date(end + "T23:59:59").getTime() : Date.now();

    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];
    const listaCanaisAcoes = CH_ACOES_ID ? CH_ACOES_ID.split(",") : [];

    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers },
    );
    const allMembers = await membersRes.json();

    const coreMembers = allMembers.filter((m) => {
      const isCore = m.roles.includes(CORE_ROLE_ID);
      if (!isCore) return false;
      const isImmune = m.roles.some((roleId) => listaImunes.includes(roleId));
      return !isImmune;
    });

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
      const cleanId = channelId ? channelId.trim() : null;
      if (!cleanId) return;

      const r = await fetch(
        `https://discord.com/api/v10/channels/${cleanId}/messages?limit=100`,
        { headers },
      );

      if (!r.ok) return;
      const msgs = await r.json();

      if (!Array.isArray(msgs)) return;

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < dataInicioMs || ts > dataFimMs) return;

        if (tipo === "ACOES") {
          // --- NOVA LÓGICA DE PONTUAÇÃO ---
          // Divide a mensagem em linhas para analisar o contexto de cada usuário
          const lines = msg.content.split("\n");

          Object.keys(metaMap).forEach((id) => {
            // Otimização: se o ID nem está na mensagem, pula
            if (!msg.content.includes(id)) return;

            // Encontra a linha específica onde o ID do usuário aparece
            const userLine = lines.find((line) => line.includes(id));

            if (userLine) {
              // Verifica se NA LINHA do usuário existe a tag de comando (Maiúsculo ou minúsculo)
              if (userLine.toUpperCase().includes("(CMD AÇÃO)")) {
                metaMap[id].acoes += 2; // Comandante ganha 2
              } else {
                metaMap[id].acoes += 1; // Participante ganha 1
              }
            }
          });
          // --------------------------------
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
              if (cleanId === CH_CURSO_ID) metaMap[id].ensino_cursos++;
              else metaMap[id].ensino_recrut++;
            }
          });
        }
      });
    }

    await Promise.all([
      ...listaCanaisAcoes.map((id) => processarCanal(id, "ACOES")),
      processarCanal(CH_PERICIAL_ID, "CGPC"),
      processarCanal(CH_PRISIONAL_ID, "CGPC"),
      processarCanal(CH_RECRUTAMENTO_ID, "ENSINO"),
      processarCanal(CH_CURSO_ID, "ENSINO"),
    ]);

    res.status(200).json(Object.values(metaMap));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
