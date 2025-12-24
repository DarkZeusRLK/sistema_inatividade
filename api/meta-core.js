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

    // 1. CAPTURA E TRATAMENTO DE DATAS (Filtro Customizado)
    const { start, end } = req.query;

    // Se houver data de início, garante que comece às 00:00:00 do dia escolhido
    const dataInicioMs = start
      ? new Date(start + "T00:00:00").getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Se houver data de fim, garante que termine às 23:59:59 do dia escolhido
    const dataFimMs = end ? new Date(end + "T23:59:59").getTime() : Date.now();

    // 2. BUSCA DE MEMBROS DO SERVIDOR
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const allMembers = await membersRes.json();

    // Filtra apenas membros que possuem o cargo CORE
    const coreMembers = allMembers.filter((m) =>
      m.roles.includes(CORE_ROLE_ID)
    );

    // Inicializa o mapa de metas para cada oficial
    let metaMap = {};
    coreMembers.forEach((m) => {
      metaMap[m.user.id] = {
        id: m.user.id,
        name: m.nick || m.user.username,
        temCGPC: m.roles.includes(CGPC_ROLE_ID),
        temEnsino: m.roles.includes(ENSINO_ROLE_ID),
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        roles: m.roles, // Necessário para checar cargos de auditoria interna
        acoes: 0,
        cgpc: 0,
        ensino_cursos: 0,
        ensino_recrut: 0,
      };
    });

    // 3. FUNÇÃO DE VARREDURA DE MENSAGENS (Otimizada para o Período)
    async function processarCanal(channelId, tipo) {
      // Aumentamos o limite para 100 para cobrir períodos maiores escolhidos pelo Comandante
      const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
      const r = await fetch(url, { headers });
      if (!r.ok) return;
      const msgs = await r.json();

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();

        // FILTRO DE DATA: Ignora mensagens fora do range start/end
        if (ts < dataInicioMs || ts > dataFimMs) return;

        const autorId = msg.author.id;

        // Lógica de Ações: Conta menções ou texto contendo o ID do oficial CORE
        if (tipo === "ACOES") {
          Object.keys(metaMap).forEach((id) => {
            if (msg.content.includes(id)) metaMap[id].acoes++;
          });
        }

        // Lógica CGPC: Conta relatórios postados por auditores CORE (Pericial ou Prisional)
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

        // Lógica Ensino: Se o autor é do ensino ou foi citado no relatório de curso/recrutamento
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

    // 4. PROCESSAMENTO PARALELO DOS CANAIS
    await Promise.all([
      processarCanal(CH_ACOES_ID, "ACOES"),
      processarCanal(CH_PERICIAL_ID, "PERICIAL"),
      processarCanal(CH_PRISIONAL_ID, "PRISIONAL"),
      processarCanal(CH_RECRUTAMENTO_ID, "RECRUT"),
      processarCanal(CH_CURSO_ID, "CURSO"),
    ]);

    // Envia o resultado final
    res.status(200).json(Object.values(metaMap));
  } catch (err) {
    console.error("Erro ao processar Metas CORE:", err);
    res.status(500).json({ error: err.message });
  }
};
