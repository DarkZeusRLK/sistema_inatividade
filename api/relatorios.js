const fetch = global.fetch || require("node-fetch");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const tipo = (req.query.tipo || "").toLowerCase();
  const headers = { Authorization: `Bot ${process.env.Discord_Bot_Token}` };

  const getMembers = async () => {
    const response = await fetch(
      `https://discord.com/api/v10/guilds/${process.env.GUILD_ID}/members?limit=1000`,
      { headers }
    );
    return response.json();
  };

  const getRange = () => {
    const { start, end, dataInicio, dataFim } = req.query;
    const startValue = start || dataInicio;
    const endValue = end || dataFim;
    return {
      inicio: startValue
        ? new Date(`${startValue}T00:00:00`).getTime()
        : Date.now() - 7 * 24 * 60 * 60 * 1000,
      fim: endValue
        ? new Date(`${endValue}T23:59:59`).getTime()
        : Date.now(),
    };
  };

  async function relatorioCore() {
    const {
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

    const { inicio, fim } = getRange();
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];
    const listaCanaisAcoes = CH_ACOES_ID ? CH_ACOES_ID.split(",") : [];
    const allMembers = await getMembers();

    const coreMembers = allMembers.filter((m) => {
      const isCore = m.roles.includes(CORE_ROLE_ID);
      if (!isCore) return false;
      const isImmune = m.roles.some((roleId) => listaImunes.includes(roleId));
      return !isImmune;
    });

    const metaMap = {};
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

    async function processarCanal(channelId, tipoCanal) {
      const cleanId = channelId ? channelId.trim() : null;
      if (!cleanId) return;
      const r = await fetch(
        `https://discord.com/api/v10/channels/${cleanId}/messages?limit=100`,
        { headers }
      );
      if (!r.ok) return;
      const msgs = await r.json();
      if (!Array.isArray(msgs)) return;

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < inicio || ts > fim) return;

        if (tipoCanal === "ACOES") {
          const lines = msg.content.split("\n");
          Object.keys(metaMap).forEach((id) => {
            if (!msg.content.includes(id)) return;
            const userLine = lines.find((line) => line.includes(id));
            if (userLine) {
              if (userLine.toUpperCase().includes("(CMD AÇÃO)")) metaMap[id].acoes += 2;
              else metaMap[id].acoes += 1;
            }
          });
        } else if (tipoCanal === "CGPC") {
          const roleAudit = [AUDITOR_PERICIAL_ROLE_ID, AUDITOR_PRISIONAL_ROLE_ID];
          if (
            metaMap[msg.author.id] &&
            metaMap[msg.author.id].roles.some((r) => roleAudit.includes(r))
          ) {
            metaMap[msg.author.id].cgpc++;
          }
        } else if (tipoCanal === "ENSINO") {
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

    return Object.values(metaMap);
  }

  async function relatorioGRR() {
    const {
      GRR_ROLE_ID,
      PRF_ENSINO_RECRUT_ROLE_ID,
      PRF_ENSINO_CURSO_ROLE_ID,
      FERIAS_ROLE_ID,
      CH_PRF_ACOES_ID,
      CH_PRF_RECRUTAMENTO_ID,
      CH_PRF_CURSO_ID,
    } = process.env;

    const { inicio, fim } = getRange();
    const allMembers = await getMembers();
    const grrMembers = allMembers.filter((m) => m.roles.includes(GRR_ROLE_ID));
    const metaMap = {};

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
        ensino: 0,
      };
    });

    async function processarCanal(channelId, tipoCanal) {
      if (!channelId) return;
      const r = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
        { headers }
      );
      if (!r.ok) return;
      const msgs = await r.json();

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < inicio || ts > fim) return;

        if (tipoCanal === "ACOES") {
          Object.keys(metaMap).forEach((id) => {
            if (msg.content.includes(id)) metaMap[id].acoes++;
          });
        } else if (tipoCanal === "RECRUT") {
          if (metaMap[msg.author.id] && metaMap[msg.author.id].temEnsinoRecrut) {
            metaMap[msg.author.id].ensino_recrut++;
            metaMap[msg.author.id].ensino++;
          }
        } else if (tipoCanal === "CURSO") {
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

    return { dados: Object.values(metaMap) };
  }

  async function relatorioBOPE() {
    const {
      PMERJ_BOPE_ROLE_ID,
      PMERJ_ENSINO_BASICO_ROLE_ID,
      PMERJ_ENSINO_ACOES_ROLE_ID,
      PMERJ_ENSINO_RECRUT_ROLE_ID,
      FERIAS_ROLE_ID,
      CH_PMERJ_ACOES_ID,
      CH_PMERJ_CURSO_BASICO_ID,
      CH_PMERJ_CURSO_ACOES_ID,
      CH_PMERJ_RECRUTAMENTO_ID,
    } = process.env;

    const { inicio, fim } = getRange();
    const allMembers = await getMembers();
    const bopeMembers = allMembers.filter((m) =>
      m.roles.includes(PMERJ_BOPE_ROLE_ID)
    );
    const metaMap = {};

    bopeMembers.forEach((m) => {
      metaMap[m.user.id] = {
        id: m.user.id,
        nome: m.nick || m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
          : null,
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        temBasico: m.roles.includes(PMERJ_ENSINO_BASICO_ROLE_ID),
        temAcoesEnsino: m.roles.includes(PMERJ_ENSINO_ACOES_ROLE_ID),
        temRecrut: m.roles.includes(PMERJ_ENSINO_RECRUT_ROLE_ID),
        acoes: 0,
        ensino_basico: 0,
        ensino_acoes_curso: 0,
        ensino_recrut: 0,
        ensino: 0,
      };
    });

    async function processarCanal(channelId, tipoCanal) {
      if (!channelId) return;
      const r = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
        { headers }
      );
      if (!r.ok) return;
      const msgs = await r.json();

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < inicio || ts > fim) return;

        if (tipoCanal === "ACOES") {
          Object.keys(metaMap).forEach((id) => {
            if (msg.content.includes(id)) metaMap[id].acoes++;
          });
        } else {
          const user = metaMap[msg.author.id];
          if (!user) return;
          if (tipoCanal === "ENSINO_BASICO" && user.temBasico) {
            user.ensino_basico++;
            user.ensino++;
          } else if (tipoCanal === "ENSINO_ACOES" && user.temAcoesEnsino) {
            user.ensino_acoes_curso++;
            user.ensino++;
          } else if (tipoCanal === "ENSINO_RECRUT" && user.temRecrut) {
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

    return { dados: Object.values(metaMap) };
  }

  async function relatorioCOT() {
    const {
      PF_COT_ROLE_ID,
      PF_ENSINO_ACOES_ROLE_ID,
      PF_ENSINO_RECRUT_ROLE_ID,
      FERIAS_ROLE_ID,
      CH_PF_ACOES_ID,
      CH_PF_CURSO_ACOES_ID,
      CH_PF_RECRUTAMENTO_ID,
    } = process.env;

    const { inicio, fim } = getRange();
    const allMembers = await getMembers();
    if (!Array.isArray(allMembers)) {
      throw new Error("Falha ao listar membros do servidor.");
    }

    const cotMembers = allMembers.filter((m) =>
      m.roles.includes(PF_COT_ROLE_ID)
    );
    const metaMap = {};

    cotMembers.forEach((m) => {
      metaMap[m.user.id] = {
        id: m.user.id,
        nome: m.nick || m.user.username,
        avatar: m.user.avatar
          ? `https://cdn.discordapp.com/avatars/${m.user.id}/${m.user.avatar}.png`
          : null,
        isFerias: m.roles.includes(FERIAS_ROLE_ID),
        temBasico: m.roles.includes(PF_ENSINO_ACOES_ROLE_ID),
        temRecrut: m.roles.includes(PF_ENSINO_RECRUT_ROLE_ID),
        acoes: 0,
        ensino_basico: 0,
        ensino_acoes_curso: 0,
        ensino_recrut: 0,
        ensino: 0,
      };
    });

    async function processarCanal(channelId, tipoCanal) {
      if (!channelId) return;
      const r = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
        { headers }
      );
      if (!r.ok) return;
      const msgs = await r.json();

      msgs.forEach((msg) => {
        const ts = new Date(msg.timestamp).getTime();
        if (ts < inicio || ts > fim) return;

        if (tipoCanal === "ACOES") {
          Object.keys(metaMap).forEach((id) => {
            if (msg.content.includes(id)) metaMap[id].acoes++;
          });
        } else {
          const user = metaMap[msg.author.id];
          if (!user) return;
          if (tipoCanal === "ENSINO_ACOES" && user.temBasico) {
            user.ensino_basico++;
            user.ensino++;
          } else if (tipoCanal === "ENSINO_RECRUT" && user.temRecrut) {
            user.ensino_recrut++;
            user.ensino++;
          }
        }
      });
    }

    await Promise.all([
      processarCanal(CH_PF_ACOES_ID, "ACOES"),
      processarCanal(CH_PF_CURSO_ACOES_ID, "ENSINO_ACOES"),
      processarCanal(CH_PF_RECRUTAMENTO_ID, "ENSINO_RECRUT"),
    ]);

    return { dados: Object.values(metaMap) };
  }

  async function relatorioEnsino() {
    const { org, dataInicio, dataFim } = req.query;
    const {
      ENSINO_ROLES_MATRIZES_ID,
      POLICE_ROLE_ID,
      PRF_ROLE_ID,
      PMERJ_ROLE_ID,
      PF_ROLE_ID,
      PF_ENSINO_ROLE_ID,
    } = process.env;

    let anchorRoleId = "";
    if (org === "PCERJ") anchorRoleId = POLICE_ROLE_ID;
    else if (org === "PRF") anchorRoleId = PRF_ROLE_ID;
    else if (org === "PMERJ") anchorRoleId = PMERJ_ROLE_ID;
    else if (org === "PF") anchorRoleId = PF_ROLE_ID;

    const CHANNELS_ENV = process.env[`${org}_ENSINO_CH`];
    if (!CHANNELS_ENV) {
      throw new Error(`Variavel ${org}_ENSINO_CH nao encontrada no .env`);
    }

    const canaisEnsino = CHANNELS_ENV.split(",").map((id) => id.trim());
    let instructorRoles = ENSINO_ROLES_MATRIZES_ID
      ? ENSINO_ROLES_MATRIZES_ID.split(",").map((id) => id.trim())
      : [];
    if (org === "PF" && PF_ENSINO_ROLE_ID) {
      instructorRoles.push(PF_ENSINO_ROLE_ID.trim());
    }

    const startTs = dataInicio ? new Date(`${dataInicio}T00:00:00`).getTime() : 0;
    const endTs = dataFim ? new Date(`${dataFim}T23:59:59`).getTime() : Date.now();
    const members = await getMembers();
    const ensinoMap = {};

    const instrutores = members.filter(
      (m) =>
        m.roles.includes(anchorRoleId) &&
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

    for (let i = 0; i < canaisEnsino.length; i++) {
      const channelId = canaisEnsino[i];
      const isRecrutamento =
        (org === "PMERJ" && i === 2) || (org !== "PMERJ" && i === 1);

      let ultimoId = null;
      let stopLoop = false;

      for (let p = 0; p < 5; p++) {
        if (stopLoop) break;
        const url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100${
          ultimoId ? `&before=${ultimoId}` : ""
        }`;
        const msgRes = await fetch(url, { headers });
        if (!msgRes.ok) break;
        const msgs = await msgRes.json();
        if (!Array.isArray(msgs) || msgs.length === 0) break;

        msgs.forEach((msg) => {
          const msgTs = new Date(msg.timestamp).getTime();
          if (msgTs < startTs) {
            stopLoop = true;
            return;
          }
          if (msgTs > endTs) return;

          const idsMencionados = new Set();
          if (msg.mentions) msg.mentions.forEach((m) => idsMencionados.add(m.id));
          const contentStr = msg.content + JSON.stringify(msg.embeds || {});
          const matches = contentStr.match(/<@!?(\d+)>/g);
          if (matches) {
            matches.forEach((m) => idsMencionados.add(m.replace(/\D/g, "")));
          }

          idsMencionados.forEach((id) => {
            if (ensinoMap[id]) {
              if (isRecrutamento) {
                ensinoMap[id].recs++;
                ensinoMap[id].total += 2;
              } else {
                ensinoMap[id].cursos++;
                ensinoMap[id].total += 1;
              }
            }
          });
        });

        ultimoId = msgs[msgs.length - 1].id;
      }
    }

    return Object.values(ensinoMap);
  }

  try {
    let data;
    if (tipo === "core") data = await relatorioCore();
    else if (tipo === "grr") data = await relatorioGRR();
    else if (tipo === "bope") data = await relatorioBOPE();
    else if (tipo === "cot") data = await relatorioCOT();
    else if (tipo === "ensino") data = await relatorioEnsino();
    else {
      return res.status(400).json({ error: "Tipo de relatorio invalido." });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro em relatorios:", err);
    return res.status(500).json({ error: err.message });
  }
};
