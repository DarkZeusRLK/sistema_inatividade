// api/membros-inativos.js
// VERSÃO FINAL ADAPTADA (COM PF)
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
    PF_ADMISSAO_CH, // PF (NOVO)

    // Cargos Base (Quem é da org)
    POLICE_ROLE_ID, // PCERJ
    PRF_ROLE_ID, // PRF
    PMERJ_ROLE_ID, // PMERJ
    PF_ROLE_ID, // PF (NOVO)

    // Outros
    CARGOS_IMUNES,
    POLICE_ROLE_IDS, // IDs dos cargos de patente (Soldado, Cabo, etc)
    CHAT_ID_BUSCAR, // Canais para ler atividade (Bate-ponto, Chat geral)
  } = process.env;

  if (!Discord_Bot_Token) {
    return res.status(500).json({ error: "Token do Bot não configurado." });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    // Garante compatibilidade do fetch
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
      // --- ADAPTAÇÃO PF ---
      canalAdmissaoId = PF_ADMISSAO_CH;
      cargoBaseOrg = PF_ROLE_ID;
    }

    // 2. PREPARAR LISTA DE CANAIS DE ATIVIDADE
    const canaisAtividadeIds = CHAT_ID_BUSCAR
      ? CHAT_ID_BUSCAR.split(",").map((id) => id.trim())
      : [];

    // 3. FETCHS EM PARALELO (Busca tudo ao mesmo tempo para ser rápido)
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
        // B. Busca Mensagens de Admissão (se houver canal configurado)
        canalAdmissaoId
          ? fetch(
              `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
              { headers }
            )
          : Promise.resolve(null),
        // C. Busca Cargos do Servidor (para saber nome das patentes)
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

    // 5. MAPEAR NOMES RP (ADMISSÃO)
    const mapaNomesRP = {};
    if (admissaoRes && admissaoRes.ok) {
      const mensagens = await admissaoRes.json();
      if (Array.isArray(mensagens)) {
        mensagens.forEach((msg) => {
          let userIdEncontrado = null;

          // Tenta pegar pela menção (@Usuario)
          if (msg.mentions && msg.mentions.length > 0)
            userIdEncontrado = msg.mentions[0].id;
          else {
            // Tenta pegar se tiver ID escrito no texto
            const matchId = msg.content.match(/(\d{17,20})/);
            if (matchId) userIdEncontrado = matchId[0];
          }

          if (userIdEncontrado) {
            // Regex robusto para pegar "Nome:", "Nome RP:", etc
            const matchNome = msg.content.match(
              /(?:\n|^|\*)(?:Nome|Nome\s+RP|Nome\s+Civil|Identidade)[\s]*:[\s]*(.+?)(?:\n|$)/i
            );

            if (matchNome) {
              // Limpa formatação markdown (**_`)
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            }
          }
        });
      }
    }

    // 6. MAPEAR ATIVIDADE REAL (AUTOR + MENÇÕES NOS CHATS DE OPERAÇÃO)
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
          // Se o oficial mandou mensagem
          atualizarAtividade(msg.author.id, msg.timestamp);
          // Se o oficial foi mencionado (ex: num batedeponto)
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

      // Verifica se o usuário tem o cargo da Organização selecionada
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;

      const uid = p.user.id;

      // Ignora Imunes (Comando Geral, etc)
      if (p.roles.some((roleId) => listaImunes.includes(roleId))) return;

      // Ignora quem está de Férias
      if (FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID)) return;

      // Define a data base para cálculo (Última atividade ou Data de Entrada)
      let baseData;
      if (mapaUltimaAtividade[uid]) {
        baseData = mapaUltimaAtividade[uid];
      } else {
        baseData = new Date(p.joined_at).getTime();
      }

      const diffMs = agora - baseData;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Só adiciona na lista se tiver mais de 7 dias de inatividade
      // (Você pode ajustar esse número se quiser mostrar todos)
      if (diffDias >= 7) {
        const apelido = p.nick || p.user.username;
        const matchPassaporte = apelido.match(/(\d+)/);
        const passaporte = matchPassaporte ? matchPassaporte[0] : "---";

        let nomeRpFinal = mapaNomesRP[uid];
        if (!nomeRpFinal) {
          nomeRpFinal = "Não consta na aba de admissão";
        }

        // Tenta achar a patente do usuário
        const idPatenteEncontrada = idsPatentes.find((id) =>
          p.roles.includes(id)
        );
        const nomePatente = idPatenteEncontrada
          ? mapRolesNames[idPatenteEncontrada]
          : "Oficial"; // Nome genérico se não tiver patente definida

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

    // Ordena: Mais inativos no topo
    resultado.sort((a, b) => b.dias - a.dias);

    res.status(200).json(resultado);
  } catch (error) {
    console.error("Erro Inativos:", error);
    res.status(500).json({ error: "Erro interno no servidor API" });
  }
};
