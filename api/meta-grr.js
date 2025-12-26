module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    GRR_ROLE_ID, // Cargo principal Operador GRR
    PRF_ENSINO_RECRUT_ROLE_ID, // Cargo Instrutor de Recrutamento
    PRF_ENSINO_CURSO_ROLE_ID, // Cargo Instrutor de Cursos
    FERIAS_ROLE_ID,
    CH_PRF_ACOES_ID, // Canal de Ações
    CH_PRF_RECRUTAMENTO_ID, // Canal de Recrutamentos
    CH_PRF_CURSO_ID, // Canal de Cursos
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
    const grrMembers = allMembers.filter((m) => m.roles.includes(GRR_ROLE_ID));

    let metaMap = {};
    grrMembers.forEach((m) => {
      metaMap[m.user.id] = {
        id: m.user.id,
        nome: m.nick || m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
          : null,
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        temEnsinoRecrut: m.roles.includes(PRF_ENSINO_RECRUT_ROLE_ID),
        temEnsinoCurso: m.roles.includes(PRF_ENSINO_CURSO_ROLE_ID),
        acoes: 0,
        ensino_recrut: 0,
        ensino_cursos: 0,
        ensino: 0, // Total (Soma de ambos)
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
        } else if (tipo === "RECRUT") {
          if (
            metaMap[msg.author.id] &&
            metaMap[msg.author.id].temEnsinoRecrut
          ) {
            metaMap[msg.author.id].ensino_recrut++;
            metaMap[msg.author.id].ensino++;
          }
        } else if (tipo === "CURSO") {
          if (metaMap[msg.author.id] && metaMap[msg.author.id].temEnsinoCurso) {
            metaMap[msg.author.id].ensino_cursos++;
            metaMap[msg.author.id].ensino++;
          }
        }
      });
    }

    await Promise.all([
      processarCanal(CH_PRF_ACOES_ID, "ACOES"),
      processarCanal(CH_PRF_RECRUTAMENTO_ID, "RECRUT"),
      processarCanal(CH_PRF_CURSO_ID, "CURSO"),
    ]);

    res.status(200).json({ dados: Object.values(metaMap) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
