// api/membros-inativos.js
// ----------------------------------------------------------------------
// VERSÃO NATIVA (NODE 18+) - NÃO PRECISA DE 'npm install node-fetch'
// ----------------------------------------------------------------------

module.exports = async (req, res) => {
  // Cabeçalhos CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

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
  } = process.env;

  // Validação Crítica
  if (!Discord_Bot_Token) {
    return res
      .status(500)
      .json({ error: "ERRO DE CONFIG: Token do Bot faltando no .env" });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  const canaisChat = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",").map((c) => c.trim())
    : [];

  try {
    console.log("🚀 Iniciando varredura...");

    // =====================================================================
    // 1. MAPEAMENTO DE FÉRIAS (Canal de Logs)
    // =====================================================================
    const mapaFerias = {}; // { idUsuario: timestampRetorno }

    if (FERIAS_CHANNEL_ID) {
      try {
        const resp = await fetch(
          `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
          { headers }
        );

        if (resp.ok) {
          const msgs = await resp.json();
          msgs.forEach((msg) => {
            // Regex para pegar data: "até 10/01", "volta 10/01", "termina 10/01"
            const texto = (
              msg.content +
              " " +
              JSON.stringify(msg.embeds || [])
            ).toLowerCase();
            const regexData =
              /(?:término|volta|retorno|até|fim|férias)[\s\S]*?(\d{1,2})\/(\d{1,2})/;
            const matchData = texto.match(regexData);

            if (matchData) {
              // Tenta achar o ID do usuário
              let userId = null;
              if (msg.mentions && msg.mentions.length > 0)
                userId = msg.mentions[0].id;
              else {
                const matchID =
                  texto.match(/<@!?(\d+)>/) || texto.match(/(\d{17,20})/);
                if (matchID) userId = matchID[1];
              }

              if (userId) {
                const dia = parseInt(matchData[1]);
                const mes = parseInt(matchData[2]) - 1;
                let ano = new Date().getFullYear();

                // Lógica de virada de ano (ex: Estamos em Dez, férias até Jan)
                const mesAtual = new Date().getMonth();
                if (mesAtual === 11 && mes === 0) ano++;

                const dataRetorno = new Date(
                  ano,
                  mes,
                  dia,
                  23,
                  59,
                  59
                ).getTime();

                // Salva a maior data encontrada
                if (!mapaFerias[userId] || dataRetorno > mapaFerias[userId]) {
                  mapaFerias[userId] = dataRetorno;
                }
              }
            }
          });
        }
      } catch (e) {
        console.error("Erro ao ler férias (não crítico):", e.message);
      }
    }

    // =====================================================================
    // 2. BUSCA NOMES/PASSAPORTES (Admissão)
    // =====================================================================
    const dadosRP = {};
    let canalAdmissao = ADMISSAO_CHANNEL_ID;
    if (org === "PRF") canalAdmissao = PRF_ADMISSAO_CH;
    if (org === "PMERJ") canalAdmissao = PMERJ_ADMISSAO_CH;

    if (canalAdmissao) {
      // Ler apenas 3 páginas para evitar TIMEOUT
      let lastId = null;
      for (let i = 0; i < 3; i++) {
        try {
          let url = `https://discord.com/api/v10/channels/${canalAdmissao}/messages?limit=100`;
          if (lastId) url += `&before=${lastId}`;

          const r = await fetch(url, { headers });
          if (!r.ok) break;
          const m = await r.json();
          if (m.length === 0) break;

          m.forEach((msg) => {
            const userIdMatch = msg.content.match(/<@!?(\d+)>/);
            if (userIdMatch) {
              const uid = userIdMatch[1];
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
          lastId = m[m.length - 1].id;
        } catch (e) {
          break;
        }
      }
    }

    // =====================================================================
    // 3. ATIVIDADE NO CHAT (Paralelo)
    // =====================================================================
    const chatActivity = {}; // { userId: timestamp }

    if (canaisChat.length > 0) {
      // Cria promessas para ler canais simultaneamente
      const promessas = canaisChat.map(async (cid) => {
        let lastId = null;
        // Limite de 4 páginas (400 msgs) por canal para não estourar a memória/tempo
        for (let i = 0; i < 4; i++) {
          try {
            let url = `https://discord.com/api/v10/channels/${cid}/messages?limit=100`;
            if (lastId) url += `&before=${lastId}`;

            const r = await fetch(url, { headers });
            if (!r.ok) break;
            const msgs = await r.json();
            if (msgs.length === 0) break;

            msgs.forEach((m) => {
              const ts = new Date(m.timestamp).getTime();
              if (
                !chatActivity[m.author.id] ||
                ts > chatActivity[m.author.id]
              ) {
                chatActivity[m.author.id] = ts;
              }
            });
            lastId = msgs[msgs.length - 1].id;
          } catch (e) {
            break;
          }
        }
      });

      await Promise.all(promessas);
    }

    // =====================================================================
    // 4. PROCESSAMENTO DOS MEMBROS
    // =====================================================================
    const respMembers = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );
    if (!respMembers.ok) {
      const errTxt = await respMembers.text();
      throw new Error(
        `Erro Discord Members (${respMembers.status}): ${errTxt}`
      );
    }
    const allMembers = await respMembers.json();

    const roleAlvo =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Filtra policiais
    const policiais = allMembers.filter((m) => m.roles.includes(roleAlvo));
    const agora = Date.now();
    const resultado = [];

    policiais.forEach((p) => {
      const uid = p.user.id;
      const fimFerias = mapaFerias[uid];

      // Data da última mensagem no chat
      let ultimaInteracao = chatActivity[uid] || 0;

      // --- LÓGICA DO LOBO ---
      // Se tem registro de volta de férias, e essa data é MAIOR que a última msg no chat,
      // a atividade dele passa a ser a data de volta das férias.
      if (fimFerias && fimFerias > ultimaInteracao) {
        ultimaInteracao = fimFerias;
      }

      // Proteção: Se a data de férias é HOJE ou FUTURO, conta como ativo (data atual)
      if (fimFerias && fimFerias >= agora) {
        ultimaInteracao = agora;
      }

      // Proteção por Cargo de Férias
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) {
        ultimaInteracao = agora;
      }

      // Calcula dias
      // Se nunca falou (0), usa data de entrada no discord ou uma data base muito antiga
      const baseCalculo = ultimaInteracao > 0 ? ultimaInteracao : 0;

      let diffDias = 999;
      if (baseCalculo > 0) {
        diffDias = Math.floor((agora - baseCalculo) / (1000 * 60 * 60 * 24));
      }

      // Só adiciona na lista quem tem > 3 dias inativo
      if (diffDias >= 7) {
        const dados = dadosRP[uid] || {};
        resultado.push({
          id: uid,
          name: p.nick || p.user.username,
          rpName: dados.nome || p.nick || p.user.global_name,
          passaporte: dados.passaporte || "---",
          cidadeId: dados.passaporte || "---",
          dias: diffDias,
          lastMsg: baseCalculo,
          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
        });
      }
    });

    // Ordena
    resultado.sort((a, b) => b.dias - a.dias);

    console.log("✅ Varredura concluída com sucesso.");
    res.status(200).json(resultado);
  } catch (err) {
    console.error("🔥 ERRO FATAL:", err);
    // Retorna o erro como JSON para o frontend ler e mostrar o alerta, em vez de tela branca
    res.status(500).json({
      error: "Falha Interna no Servidor",
      details: err.message,
      stack: err.stack,
    });
  }
};
