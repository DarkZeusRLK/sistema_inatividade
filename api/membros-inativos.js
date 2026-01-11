// api/membros-inativos.js
// VERSÃO FINAL: PRIORIDADE ADMISSÃO (PARA CORE/BOPE)
module.exports = async (req, res) => {
  // Configuração de CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { org } = req.query;

  // Extrai todas as variáveis de ambiente necessárias
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,

    // Canais de Admissão
    ADMISSAO_CHANNEL_ID, // PCERJ (Padrão)
    PRF_ADMISSAO_CH, // PRF
    PMERJ_ADMISSAO_CH, // PMERJ
    PF_ADMISSAO_CH, // PF

    // Cargos Base (Quem é da org)
    POLICE_ROLE_ID, // PCERJ
    PRF_ROLE_ID, // PRF
    PMERJ_ROLE_ID, // PMERJ
    PF_ROLE_ID, // PF

    // Outros
    CARGOS_IMUNES,
    POLICE_ROLE_IDS, // IDs dos cargos de patente
    CHAT_ID_BUSCAR, // Canais para ler atividade
  } = process.env;

  if (!Discord_Bot_Token) {
    return res.status(500).json({ error: "Token do Bot não configurado." });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    const fetch = global.fetch || require("node-fetch");

    // 1. DEFINIÇÕES DE ORG (Lógica de Seleção)
    let canalAdmissaoId = ADMISSAO_CHANNEL_ID;
    let cargoBaseOrg = POLICE_ROLE_ID;

    if (org === "PRF") {
      canalAdmissaoId = PRF_ADMISSAO_CH;
      cargoBaseOrg = PRF_ROLE_ID;
    } else if (org === "PMERJ") {
      canalAdmissaoId = PMERJ_ADMISSAO_CH;
      cargoBaseOrg = PMERJ_ROLE_ID;
    } else if (org === "PF") {
      canalAdmissaoId = PF_ADMISSAO_CH;
      cargoBaseOrg = PF_ROLE_ID;
    }

    // 2. PREPARAR LISTA DE CANAIS DE ATIVIDADE
    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
      : [];

    // 3. FETCHS EM PARALELO
    const promisesAtividade = canaisAtividadeIds.map((id) =>
      fetch(`https://discord.com/api/v10/channels/${id}/messages?limit=100`, {
        headers,
      })
        .then((res) => (res.ok ? res.json() : []))
        .catch(() => [])
    );

    const [membersRes, admissaoRes, rolesRes, ...mensagensAtividadeArrays] =
      await Promise.all([
        // A. Busca Membros
        fetch(
          `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
          { headers }
        ),
        // B. Busca Mensagens de Admissão
        canalAdmissaoId
          ? fetch(
              `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
              { headers }
            )
          : Promise.resolve(null),
        // C. Busca Cargos
        fetch(`https://discord.com/api/v10/guilds/${GUILD_ID}/roles`, {
          headers,
        }),
        // D. Busca Mensagens de Atividade
        ...promisesAtividade,
      ]);

    if (!membersRes.ok)
      throw new Error(`Erro Discord Membros: ${membersRes.status}`);

    const oficiais = await membersRes.json();
    const serverRoles = rolesRes.ok ? await rolesRes.json() : [];

    // 4. MAPEAR CARGOS E NOMES
    const idsPatentes = POLICE_ROLE_IDS
      ? POLICE_ROLE_IDS.split(",").map((i) => i.trim())
      : [];
    const mapRolesNames = {};
    serverRoles.forEach((r) => (mapRolesNames[r.id] = r.name));

    // 5. MAPEAR NOMES RP E PASSAPORTES (ADMISSÃO)
    const mapaNomesRP = {};
    const mapaPassaporteRP = {}; // Novo mapa só para IDs

    if (admissaoRes && admissaoRes.ok) {
      const mensagens = await admissaoRes.json();
      if (Array.isArray(mensagens)) {
        mensagens.forEach((msg) => {
          let userIdEncontrado = null;

          // Tenta pegar pela menção (@Usuario)
          if (msg.mentions && msg.mentions.length > 0)
            userIdEncontrado = msg.mentions[0].id;
          else {
            const matchId = msg.content.match(/(\d{17,20})/);
            if (matchId) userIdEncontrado = matchId[0];
          }

          if (userIdEncontrado) {
            // Regex para pegar NOME
            const matchNome = msg.content.match(
              /(?:\n|^|\*|•|➤)(?:\s*)(?:Nome|Nome\s+RP|Nome\s+Civil|Identidade|Membro)[\s]*:[\s]*(.+?)(?:\n|$)/i
            );

            // Regex para pegar ID/PASSAPORTE
            const matchPassaporte = msg.content.match(
              /(?:\n|^|\*|•|➤)(?:\s*)(?:Passaporte|ID|Identidade|Rg)[\s]*:[\s]*(\d+)/i
            );

            if (matchNome) {
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            }

            if (matchPassaporte) {
              mapaPassaporteRP[userIdEncontrado] = matchPassaporte[1].trim();
            }
          }
        });
      }
    }

    // 6. MAPEAR ATIVIDADE REAL
    const mapaUltimaAtividade = {};
    const atualizarAtividade = (userId, timestamp) => {
      const time = new Date(timestamp).getTime();
      if (!mapaUltimaAtividade[userId] || time > mapaUltimaAtividade[userId]) {
        mapaUltimaAtividade[userId] = time;
      }
    };

    mensagensAtividadeArrays.forEach((listaMensagens) => {
      if (Array.isArray(listaMensagens)) {
        listaMensagens.forEach((msg) => {
          atualizarAtividade(msg.author.id, msg.timestamp);
          if (msg.mentions && msg.mentions.length > 0) {
            msg.mentions.forEach((usuarioMarcado) => {
              atualizarAtividade(usuarioMarcado.id, msg.timestamp);
            });
          }
        });
      }
    });

    // 7. PROCESSAMENTO FINAL DOS DADOS
    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      // Ignora Bots
      if (p.user.bot) return;

      // Verifica cargo da Org
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;

      const uid = p.user.id;

      // Ignora Imunes
      if (p.roles.some((roleId) => listaImunes.includes(roleId))) return;

      // Ignora Férias
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) return;

      // Data base
      let baseData;
      if (mapaUltimaAtividade[uid]) {
        baseData = mapaUltimaAtividade[uid];
      } else {
        baseData = new Date(p.joined_at).getTime();
      }

      const diffMs = agora - baseData;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDias >= 7) {
        const apelido = p.nick || p.user.username;
        let passaporte = "---";

        // --- LÓGICA DE ID (PRIORIDADE: ADMISSÃO) ---

        // 1. Verifica se achamos o ID na mensagem de admissão
        if (mapaPassaporteRP[uid]) {
          passaporte = mapaPassaporteRP[uid];
        }
        // 2. Se não achou na admissão, tenta pegar do Nickname (Fallback)
        else {
          if (apelido.includes("|")) {
            const partes = apelido.split("|");
            const ultimaParte = partes[partes.length - 1].trim();
            // Verifica se o que veio depois da barra é número mesmo
            const match = ultimaParte.match(/^(\d+)$/);
            if (match) passaporte = match[0];
          } else {
            // Tenta pegar último número da string
            const matches = apelido.match(/(\d+)/g);
            if (matches && matches.length > 0) {
              passaporte = matches[matches.length - 1];
            }
          }
        }

        // --- LÓGICA DE NOME ---
        let nomeRpFinal = mapaNomesRP[uid];

        if (!nomeRpFinal) {
          // Limpeza do apelido caso não ache na admissão
          let nomeLimpo = apelido
            .replace(/\[.*?\]/g, "")
            .replace(/\(.*?\)/g, "")
            .split("|")[0]
            .replace(/[0-9]/g, "")
            .replace(/[^\w\s\u00C0-\u00FF]/g, "") // Remove emojis/símbolos
            .trim();

          nomeRpFinal = nomeLimpo || "Não id. na Admissão";
        }

        // Patente
        const idPatenteEncontrada = idsPatentes.find((id) =>
          p.roles.includes(id)
        );
        const nomePatente = idPatenteEncontrada
          ? mapRolesNames[idPatenteEncontrada]
          : "Oficial";

        resultado.push({
          id: uid,
          name: p.nick || p.user.username,
          rpName: nomeRpFinal,
          passaporte: passaporte,
          cargo: nomePatente,
          dias: diffDias,
          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
          joined_at: p.joined_at,
        });
      }
    });

    resultado.sort((a, b) => b.dias - a.dias);

    res.status(200).json(resultado);
  } catch (error) {
    console.error("Erro Inativos:", error);
    res.status(500).json({ error: "Erro interno no servidor API" });
  }
};
