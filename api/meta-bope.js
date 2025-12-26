module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    PMERJ_BOPE_ROLE_ID, // Cargo principal do BOPE
    PMERJ_ENSINO_BASICO_ROLE_ID, // Cargo Instrutor Cursos Básicos
    PMERJ_ENSINO_ACOES_ROLE_ID, // Cargo Instrutor Cursos de Ações
    PMERJ_ENSINO_RECRUT_ROLE_ID, // Cargo Instrutor Recrutamento
    FERIAS_ROLE_ID,
    CH_PMERJ_ACOES_ID, // Canal de Ações de Campo
    CH_PMERJ_CURSO_BASICO_ID, // Canal de Cursos Básicos
    CH_PMERJ_CURSO_ACOES_ID, // Canal de Cursos de Ações
    CH_PMERJ_RECRUTAMENTO_ID, // Canal de Recrutamento
  } = process.env;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };
    const { start, end } = req.query;

    const dataInicioMs = start
      ? new Date(start + "T00:00:00").getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const dataFimMs = end ? new Date(end + "T23:59:59").getTime() : Date.now();

    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const allMembers = await membersRes.json();

    const bopeMembers = allMembers.filter((m) =>
      m.roles.includes(PMERJ_BOPE_ROLE_ID)
    );

    let metaMap = {};
    bopeMembers.forEach((m) => {
      metaMap[m.user.id] = {
        id: m.user.id,
        nome: m.nick || m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
          : null,
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        // Mapeamento dos 3 cargos de ensino
        temBasico: m.roles.includes(PMERJ_ENSINO_BASICO_ROLE_ID),
        temAcoesEnsino: m.roles.includes(PMERJ_ENSINO_ACOES_ROLE_ID),
        temRecrut: m.roles.includes(PMERJ_ENSINO_RECRUT_ROLE_ID),
        acoes: 0,
        ensino_basico: 0,
        ensino_acoes_curso: 0,
        ensino_recrut: 0,
        ensino: 0, // Soma total de todos os ensinos
      };
    });

    async function processarCanal(channelId, tipo) {
      if (!channelId) return;
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
        } else {
          const user = metaMap[msg.author.id];
          if (!user) return;

          // Validação específica: Autor deve ter o cargo correspondente ao canal
          if (tipo === "ENSINO_BASICO" && user.temBasico) {
            user.ensino_basico++;
            user.ensino++;
          } else if (tipo === "ENSINO_ACOES" && user.temAcoesEnsino) {
            user.ensino_acoes_curso++;
            user.ensino++;
          } else if (tipo === "ENSINO_RECRUT" && user.temRecrut) {
            user.ensino_recrut++;
            user.ensino++;
          }
        }
      });
    }

    await Promise.all([
      processarCanal(CH_PMERJ_ACOES_ID, "ACOES"),
      processarCanal(CH_PMERJ_CURSO_BASICO_ID, "ENSINO_BASICO"),
      processarCanal(CH_PMERJ_CURSO_ACOES_ID, "ENSINO_ACOES"),
      processarCanal(CH_PMERJ_RECRUTAMENTO_ID, "ENSINO_RECRUT"),
    ]);

    res.status(200).json({ dados: Object.values(metaMap) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
