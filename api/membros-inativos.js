// api/membros-inativos.js
// Lógica: Verifica inatividade (msg enviada ou menção recebida) em canais específicos.

module.exports = async (req, res) => {
  // 1. Configuração CORS (Para o site conseguir ler os dados)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // 2. Captura variáveis de ambiente
  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    FERIAS_CHANNEL_ID,
    POLICE_ROLE_ID,
    ADMISSAO_CHANNEL_ID,
    PRF_ROLE_ID,
    PRF_ADMISSAO_CH,
    PMERJ_ROLE_ID,
    PMERJ_ADMISSAO_CH,
    CHAT_ID_BUSCAR,
    CARGOS_IMUNES,
  } = process.env;

  if (!Discord_Bot_Token) {
    return res.status(500).json({ error: "Token do Bot ausente." });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  // 3. Prepara listas de exclusão e canais
  const listaImunes = (CARGOS_IMUNES || "").split(",").map((id) => id.trim());

  const canaisScan = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 10)
    : [];

  try {
    console.log(`🚀 Iniciando auditoria para ${org || "GERAL"}...`);

    // =====================================================================
    // ETAPA 1: MAPEAR FÉRIAS (Quem está de folga não é inativo)
    // =====================================================================
    const mapaFerias = {};
    if (FERIAS_CHANNEL_ID) {
      try {
        const r = await fetch(
          `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
          { headers }
        );
        if (r.ok) {
          const msgs = await r.json();
          msgs.forEach((msg) => {
            // Tenta achar ID na menção ou no texto
            let userId = msg.mentions?.[0]?.id;
            if (!userId) {
              const match = msg.content.match(/<@!?(\d+)>/);
              if (match) userId = match[1];
            }

            if (userId) {
              // Procura datas no formato DD/MM
              const texto = (
                msg.content +
                " " +
                JSON.stringify(msg.embeds)
              ).toLowerCase();
              const matchData = texto.match(
                /(?:volta|retorno|até|fim)[\s\S]*?(\d{1,2})\/(\d{1,2})/
              );

              if (matchData) {
                const dia = parseInt(matchData[1]);
                const mes = parseInt(matchData[2]) - 1;
                let ano = new Date().getFullYear();
                // Ajuste de virada de ano (ex: férias em dez voltando em jan)
                if (new Date().getMonth() === 11 && mes === 0) ano++;

                const dataVolta = new Date(ano, mes, dia, 23, 59, 59).getTime();
                // Salva a maior data encontrada para o usuário
                if (!mapaFerias[userId] || dataVolta > mapaFerias[userId]) {
                  mapaFerias[userId] = dataVolta;
                }
              }
            }
          });
        }
      } catch (e) {
        console.error("Erro ao ler canal de férias:", e.message);
      }
    }

    // =====================================================================
    // ETAPA 2: MAPEAR ADMISSÃO (Para pegar Nome RP e Passaporte)
    // =====================================================================
    const dadosRP = {};
    let canalAdm = ADMISSAO_CHANNEL_ID;
    if (org === "PRF") canalAdm = PRF_ADMISSAO_CH;
    if (org === "PMERJ") canalAdm = PMERJ_ADMISSAO_CH;

    if (canalAdm) {
      let lastId = null;
      // Lê até 300 mensagens antigas de admissão
      for (let i = 0; i < 3; i++) {
        try {
          let url = `https://discord.com/api/v10/channels/${canalAdm}/messages?limit=100`;
          if (lastId) url += `&before=${lastId}`;

          const r = await fetch(url, { headers });
          if (!r.ok) break;

          const msgs = await r.json();
          if (msgs.length === 0) break;

          msgs.forEach((msg) => {
            const uidMatch = msg.content.match(/<@!?(\d+)>/);
            if (uidMatch) {
              const uid = uidMatch[1];
              if (!dadosRP[uid]) {
                const pass = msg.content.match(/(?:Passaporte|ID)[:\s]*(\d+)/i);
                const nome = msg.content.match(/(?:Nome|RP)[:\s]*([^\n]+)/i);
                dadosRP[uid] = {
                  passaporte: pass ? pass[1] : "---",
                  nome: nome
                    ? nome[1].replace(/\*/g, "").trim()
                    : "Desconhecido",
                };
              }
            }
          });
          lastId = msgs[msgs.length - 1].id;
        } catch (e) {
          break;
        }
      }
    }

    // =====================================================================
    // ETAPA 3: VARREDURA DE ATIVIDADE (O CORAÇÃO DO SISTEMA)
    // =====================================================================
    const mapaAtividade = {};

    if (canaisScan.length > 0) {
      // Processa todos os canais de chat em paralelo
      await Promise.all(
        canaisScan.map(async (canalId) => {
          let lastId = null;
          // Lê as últimas 300 mensagens de cada canal
          for (let p = 0; p < 3; p++) {
            try {
              let url = `https://discord.com/api/v10/channels/${canalId}/messages?limit=100`;
              if (lastId) url += `&before=${lastId}`;

              const r = await fetch(url, { headers });
              if (!r.ok) break;

              const msgs = await r.json();
              if (!msgs || msgs.length === 0) break;

              msgs.forEach((msg) => {
                const timestamp = new Date(msg.timestamp).getTime();
                const usuariosAtivos = new Set();

                // 1. O autor da mensagem estava ativo
                usuariosAtivos.add(msg.author.id);

                // 2. Quem foi mencionado na mensagem estava ativo (check de inatividade)
                if (msg.mentions) {
                  msg.mentions.forEach((u) => usuariosAtivos.add(u.id));
                }

                // Atualiza a última vez que cada um foi visto
                usuariosAtivos.forEach((uid) => {
                  if (!mapaAtividade[uid] || timestamp > mapaAtividade[uid]) {
                    mapaAtividade[uid] = timestamp;
                  }
                });
              });

              lastId = msgs[msgs.length - 1].id;
            } catch (err) {
              break;
            }
          }
        })
      );
    }

    // =====================================================================
    // ETAPA 4: PROCESSAMENTO E FILTRAGEM FINAL
    // =====================================================================
    // Pega os membros do Discord (Limitado a 1000 pela API REST)
    const rGuild = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    if (!rGuild.ok)
      throw new Error(`Erro ao buscar membros (${rGuild.status})`);

    const members = await rGuild.json();

    // Define qual cargo base estamos procurando (Civil, PRF ou PM)
    const roleTarget =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Filtra: Tem o cargo da policia E NÃO tem cargo imune
    const oficiais = members.filter((m) => {
      const temCargoPolicia = m.roles.includes(roleTarget);
      const ehImune = m.roles.some((roleId) => listaImunes.includes(roleId));
      return temCargoPolicia && !ehImune;
    });

    const resultado = [];
    const agora = Date.now();

    oficiais.forEach((p) => {
      const uid = p.user.id;

      // Data da última atividade (Chat ou Férias)
      let ultimaMsg = mapaAtividade[uid] || 0;
      const fimFerias = mapaFerias[uid];

      // Se a data de férias for mais recente que a mensagem, usa ela
      if (fimFerias && fimFerias > ultimaMsg) ultimaMsg = fimFerias;

      // Verifica se está "protegido" atualmente (ainda em férias)
      let protegido = false;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) protegido = true;
      if (fimFerias && fimFerias >= agora) {
        protegido = true;
        ultimaMsg = agora; // Zera o contador se ainda estiver de férias
      }

      if (!protegido) {
        // Se nunca falou, considera a data de entrada no servidor
        let baseCalc = ultimaMsg;
        if (baseCalc === 0 && p.joined_at) {
          baseCalc = new Date(p.joined_at).getTime();
        }

        const diffMs = agora - baseCalc;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // CRITÉRIO FINAL: 7 dias ou mais
        if (diffDias >= 7) {
          const dRP = dadosRP[uid] || {};
          resultado.push({
            id: uid,
            name: p.nick || p.user.username,
            rpName: dRP.nome || p.nick || p.user.global_name,
            passaporte: dRP.passaporte || "---",
            dias: diffDias,
            lastMsg: ultimaMsg,
            cargo: "Oficial", // Pode ser melhorado se quiser pegar o cargo mais alto
            avatar: p.user.avatar
              ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
              : null,
          });
        }
      }
    });

    // Ordena por quem está inativo há mais tempo
    resultado.sort((a, b) => b.dias - a.dias);

    res.status(200).json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno ao processar inatividade." });
  }
};
