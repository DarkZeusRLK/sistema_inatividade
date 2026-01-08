// =========================================================
// API DE METAS OPERACIONAIS - COT (POLÍCIA FEDERAL)
// =========================================================
const fetch = global.fetch || require("node-fetch");

module.exports = async (req, res) => {
  const {
    Discord_Bot_Token,
    GUILD_ID,
    PF_COT_ROLE_ID, // Cargo principal do COT
    PF_ENSINO_ACOES_ROLE_ID, // Cargo Instrutor Cursos Básicos/Investigação
    PF_ENSINO_RECRUT_ROLE_ID, // Cargo Instrutor Recrutamento (ANP)
    FERIAS_ROLE_ID,
    CH_PF_ACOES_ID, // Canal de Operações/Missões
    CH_PF_CURSO_ACOES_ID, // Canal de Instruções Básicas
    CH_PF_RECRUTAMENTO_ID, // Canal de Recrutamento (Formação)
  } = process.env;

  try {
    const headers = { Authorization: `Bot ${Discord_Bot_Token}` };
    const { start, end } = req.query;

    // Configuração de período (Default: última semana)
    const dataInicioMs = start
      ? new Date(start + "T00:00:00").getTime()
      : Date.now() - 7 * 24 * 60 * 60 * 1000;
    const dataFimMs = end ? new Date(end + "T23:59:59").getTime() : Date.now();

    // 1. Busca membros do servidor
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    const allMembers = await membersRes.json();

    if (!Array.isArray(allMembers))
      throw new Error("Falha ao listar membros do servidor.");

    // 2. Filtra apenas membros do COT
    const cotMembers = allMembers.filter((m) =>
      m.roles.includes(PF_COT_ROLE_ID)
    );

    let metaMap = {};
    cotMembers.forEach((m) => {
      metaMap[m.user.id] = {
        id: m.user.id,
        nome: m.nick || m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
          : null,
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        // Verificação de cargos de instrutor
        temAcoes: m.roles.includes(PF_ENSINO_ACOES_ROLE_ID),
        temRecrut: m.roles.includes(PF_ENSINO_RECRUT_ROLE_ID),
        acoes: 0,
        ensino_basico: 0,
        ensino_acoes_curso: 0,
        ensino_recrut: 0,
        ensino: 0,
      };
    });

    // 3. Função para processar mensagens dos canais
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
          // Nas ações, verificamos quem foi mencionado no log
          Object.keys(metaMap).forEach((id) => {
            if (msg.content.includes(id)) metaMap[id].acoes++;
          });
        } else {
          // No ensino, verificamos o AUTOR da mensagem (o instrutor)
          const user = metaMap[msg.author.id];
          if (!user) return;

          if (tipo === "ENSINO_ACOES" && user.temBasico) {
            user.ensino_basico++;
            user.ensino++;
          } else if (tipo === "ENSINO_RECRUT" && user.temRecrut) {
            user.ensino_recrut++;
            user.ensino++;
          }
        }
      });
    }

    // 4. Executa a varredura em paralelo
    await Promise.all([
      processarCanal(CH_PF_ACOES_ID, "ACOES"),
      processarCanal(CH_PF_CURSO_ACOES_ID, "ENSINO_ACOES"),
      processarCanal(CH_PF_RECRUTAMENTO_ID, "ENSINO_RECRUT"),
    ]);

    res.status(200).json({ dados: Object.values(metaMap) });
  } catch (err) {
    console.error("Erro Meta COT:", err);
    res.status(500).json({ error: err.message });
  }
};
