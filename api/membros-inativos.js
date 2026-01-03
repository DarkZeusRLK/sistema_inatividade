// Importação compatível com Vercel (CommonJS e ES Modules)
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

module.exports = async (req, res) => {
  // Configuração de cabeçalhos para evitar erros de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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

  console.log("🚀 Iniciando verificação de inatividade...");

  // Validação básica
  if (!Discord_Bot_Token)
    return res.status(500).json({ error: "Token do Bot não configurado." });
  if (!CHAT_ID_BUSCAR)
    console.warn("⚠️ AVISO: CHAT_ID_BUSCAR não está configurado no .env!");

  const canaisPermitidos = CHAT_ID_BUSCAR
    ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
    : [];

  const headers = { Authorization: `Bot ${Discord_Bot_Token}` };

  try {
    // =================================================================================
    // 1. MAPEAMENTO DE FÉRIAS (Canal de Logs)
    // =================================================================================
    const mapaFerias = {}; // { idUsuario: timestampFimFerias }

    if (FERIAS_CHANNEL_ID) {
      console.log(`📅 Lendo canal de férias: ${FERIAS_CHANNEL_ID}`);
      try {
        const respFerias = await fetch(
          `https://discord.com/api/v10/channels/${FERIAS_CHANNEL_ID}/messages?limit=100`,
          { headers }
        );

        if (respFerias.ok) {
          const msgsFerias = await respFerias.json();
          msgsFerias.forEach((msg) => {
            let userId = null;

            // Tenta pegar ID pela menção ou regex no texto
            if (msg.mentions && msg.mentions.length > 0) {
              userId = msg.mentions[0].id;
            } else {
              const content = msg.content + JSON.stringify(msg.embeds || []);
              const matchID =
                content.match(/<@!?(\d+)>/) || content.match(/(\d{17,20})/);
              if (matchID) userId = matchID[1];
            }

            if (userId) {
              const texto = (
                msg.content +
                " " +
                JSON.stringify(msg.embeds || [])
              ).toLowerCase();

              // REGEX MELHORADA: Pega "até 04/01", "volta 04/01", "termina 04/01"
              const regexData =
                /(?:término|volta|retorno|até|fim|férias)[\s\S]*?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/;
              const matchData = texto.match(regexData);

              if (matchData) {
                const dia = parseInt(matchData[1]);
                const mes = parseInt(matchData[2]) - 1;
                // Se não tiver ano, assume o ano atual. Cuidado com virada de ano (ex: férias em dez/25 até jan/26)
                let ano = matchData[3]
                  ? parseInt(matchData[3])
                  : new Date().getFullYear();
                if (ano < 100) ano += 2000;

                // Lógica de virada de ano: Se estamos em Dezembro e a data lida é Janeiro, é ano que vem.
                const hoje = new Date();
                if (hoje.getMonth() === 11 && mes === 0 && !matchData[3]) {
                  ano = hoje.getFullYear() + 1;
                }

                // Define data para o FINAL DO DIA (23:59:59)
                const dataTermino = new Date(
                  ano,
                  mes,
                  dia,
                  23,
                  59,
                  59
                ).getTime();

                // Guarda a maior data encontrada
                if (!mapaFerias[userId] || dataTermino > mapaFerias[userId]) {
                  mapaFerias[userId] = dataTermino;
                }
              }
            }
          });
          console.log(
            `✅ Férias mapeadas: ${Object.keys(mapaFerias).length} registros.`
          );
        } else {
          console.error("❌ Erro ao ler canal de férias:", respFerias.status);
        }
      } catch (err) {
        console.error("❌ Erro fetch férias:", err);
      }
    }

    // =================================================================================
    // 2. BUSCA BANCO DE DADOS DE ADMISSÃO (Para Nomes e Passaportes)
    // =================================================================================
    let dadosRP = {};
    let targetAdm = ADMISSAO_CHANNEL_ID;
    if (org === "PRF") targetAdm = PRF_ADMISSAO_CH;
    if (org === "PMERJ") targetAdm = PMERJ_ADMISSAO_CH;

    if (org && targetAdm) {
      console.log(`📂 Lendo admissões em: ${targetAdm}`);
      let ultimoIdAdmissao = null;
      // Lê 5 páginas (500 msgs)
      for (let i = 0; i < 5; i++) {
        let url = `https://discord.com/api/v10/channels/${targetAdm}/messages?limit=100`;
        if (ultimoIdAdmissao) url += `&before=${ultimoIdAdmissao}`;

        try {
          const resAdm = await fetch(url, { headers });
          if (!resAdm.ok) break;
          const msgs = await resAdm.json();
          if (!msgs || msgs.length === 0) break;

          msgs.forEach((msg) => {
            const m = msg.content.match(/<@!?(\d+)>/); // Pega ID do discord
            if (m && !dadosRP[m[1]]) {
              // Tenta extrair Passaporte/ID da Cidade
              const passaporteMatch = msg.content.match(
                /(?:Passaporte|ID|Cidade)[:\s]*(\d+)/i
              );
              // Tenta extrair Nome
              const nomeMatch = msg.content.match(/(?:Nome|RP)[:\s]*([^\n]+)/i);

              dadosRP[m[1]] = {
                passaporte: passaporteMatch ? passaporteMatch[1] : "---",
                nome: nomeMatch
                  ? nomeMatch[1].replace(/\*/g, "").trim()
                  : "Desconhecido",
              };
            }
          });
          ultimoIdAdmissao = msgs[msgs.length - 1].id;
        } catch (e) {
          console.error("Erro leitura admissao:", e);
          break;
        }
      }
    }

    // =================================================================================
    // 3. MAPA DE ATIVIDADE DOS CHATS (PARALELO)
    // =================================================================================
    let chatActivity = {}; // { userId: timestamp }

    console.log(`💬 Lendo ${canaisPermitidos.length} canais de chat...`);

    // Busca em paralelo para não dar timeout
    const promisesChats = canaisPermitidos.map(async (channelId) => {
      let ultimoId = null;
      // Lê até 5 páginas por canal (500 msgs)
      for (let p = 0; p < 5; p++) {
        let url = `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`;
        if (ultimoId) url += `&before=${ultimoId}`;

        try {
          const r = await fetch(url, { headers });
          if (!r.ok) break; // Se canal não existe ou sem permissão
          const m = await r.json();
          if (!m || m.length === 0) break;

          m.forEach((msg) => {
            const ts = new Date(msg.timestamp).getTime();
            const userId = msg.author.id;

            if (!chatActivity[userId] || ts > chatActivity[userId]) {
              chatActivity[userId] = ts;
            }
          });
          ultimoId = m[m.length - 1].id;
        } catch (e) {
          break;
        }
      }
    });

    await Promise.all(promisesChats);
    console.log("✅ Leitura de chats concluída.");

    // =================================================================================
    // 4. PROCESSAMENTO FINAL (Membros + Férias + Atividade)
    // =================================================================================
    const membersRes = await fetch(
      `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
      { headers }
    );

    if (!membersRes.ok)
      throw new Error(`Erro ao buscar membros: ${membersRes.status}`);
    const members = await membersRes.json();

    const TARGET_ROLE =
      org === "PRF"
        ? PRF_ROLE_ID
        : org === "PMERJ"
        ? PMERJ_ROLE_ID
        : POLICE_ROLE_ID;

    // Filtra apenas policiais
    const oficiais = members.filter((m) => m.roles.includes(TARGET_ROLE));

    const resultado = [];
    const agora = Date.now();

    oficiais.forEach((p) => {
      const userId = p.user.id;
      const fimFerias = mapaFerias[userId];

      // 1. Pega data da última mensagem no chat
      let ultimaInteracao = chatActivity[userId] || 0;

      // 2. APLICA A CORREÇÃO DO LOBO:
      // Se a pessoa tem um registro de fim de férias (ex: 04/01) e essa data
      // é MAIS RECENTE que a última mensagem dela no chat (ex: 10/12),
      // o sistema assume que a atividade dela é a data de retorno das férias.
      if (fimFerias && fimFerias > ultimaInteracao) {
        ultimaInteracao = fimFerias;
      }

      // 3. Verifica proteção (Se data de férias é futura ou hoje)
      let protegido = false;
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) protegido = true;
      if (fimFerias && fimFerias >= agora) protegido = true;

      if (!protegido) {
        // Calcula dias inativo
        const diffMs = agora - ultimaInteracao;
        const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        // Filtro de Inatividade (Ex: > 3 dias)
        // Se ultimaInteracao for 0 (nunca falou), diffDias será gigante.
        if (diffDias >= 3) {
          const dados = dadosRP[userId] || {};

          resultado.push({
            id: userId,
            name: p.nick || p.user.username, // Nome no Discord
            rpName: dados.nome || p.nick || p.user.global_name, // Nome RP
            passaporte: dados.passaporte,
            cidadeId: dados.passaporte, // Legado
            dias: diffDias, // Dias inativo
            ultimaData:
              ultimaInteracao > 0
                ? new Date(ultimaInteracao).toLocaleDateString("pt-BR")
                : "Nunca",
            avatar: p.user.avatar
              ? `https://cdn.discordapp.com/avatars/${userId}/${p.user.avatar}.png`
              : "https://cdn.discordapp.com/embed/avatars/0.png",
          });
        }
      }
    });

    // Ordena do mais inativo para o menos
    resultado.sort((a, b) => b.dias - a.dias);

    console.log(`🏁 Finalizado. ${resultado.length} inativos encontrados.`);
    res.status(200).json(resultado);
  } catch (error) {
    console.error("🔥 ERRO FATAL NA API:", error);
    res.status(500).json({ error: error.message });
  }
};
