// api/membros-inativos.js
// ATUALIZADO: Filtra membros pela tag da corporação (Org)
module.exports = async (req, res) => {
  // Configuração CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { org } = req.query;
  const {
    Discord_Bot_Token,
    GUILD_ID,
    FERIAS_ROLE_ID,
    // Canais de Admissão
    ADMISSAO_CHANNEL_ID, // PCERJ (Padrão)
    PRF_ADMISSAO_CH, // PRF
    PMERJ_ADMISSAO_CH, // PMERJ
    // Cargos Principais (Para filtrar quem é quem)
    POLICE_ROLE_ID, // Cargo Base PCERJ
    PRF_ROLE_ID, // Cargo Base PRF
    PMERJ_ROLE_ID, // Cargo Base PMERJ
    CARGOS_IMUNES,
  } = process.env;

  if (!Discord_Bot_Token) {
    return res
      .status(500)
      .json({ error: "Token do Bot não configurado no .env" });
  }

  const headers = {
    Authorization: `Bot ${Discord_Bot_Token}`,
    "Content-Type": "application/json",
  };

  try {
    // 1. DEFINIÇÕES BASEADAS NA ORGANIZAÇÃO (ORG)
    let canalAdmissaoId = ADMISSAO_CHANNEL_ID; // Padrão
    let cargoBaseOrg = POLICE_ROLE_ID; // Padrão (PCERJ)

    if (org === "PRF") {
      canalAdmissaoId = PRF_ADMISSAO_CH;
      cargoBaseOrg = PRF_ROLE_ID;
    }
    if (org === "PMERJ") {
      canalAdmissaoId = PMERJ_ADMISSAO_CH;
      cargoBaseOrg = PMERJ_ROLE_ID;
    }

    // 2. BUSCAR DADOS EM PARALELO (Membros + Mensagens do Canal de Admissão)
    const [membersRes, admissaoRes] = await Promise.all([
      fetch(
        `https://discord.com/api/v10/guilds/${GUILD_ID}/members?limit=1000`,
        { headers }
      ),
      canalAdmissaoId
        ? fetch(
            `https://discord.com/api/v10/channels/${canalAdmissaoId}/messages?limit=100`,
            { headers }
          )
        : Promise.resolve(null),
    ]);

    if (!membersRes.ok) {
      throw new Error(`Erro Discord: ${membersRes.status}`);
    }

    const oficiais = await membersRes.json();

    // 3. CRIAR MAPA DE NOMES RP
    const mapaNomesRP = {};
    if (admissaoRes && admissaoRes.ok) {
      const mensagens = await admissaoRes.json();
      if (Array.isArray(mensagens)) {
        mensagens.forEach((msg) => {
          let userIdEncontrado = null;
          if (msg.mentions && msg.mentions.length > 0) {
            userIdEncontrado = msg.mentions[0].id;
          } else {
            const matchId = msg.content.match(/(\d{17,20})/);
            if (matchId) userIdEncontrado = matchId[0];
          }

          if (userIdEncontrado) {
            const matchNome = msg.content.match(
              /(?:Nome|Nick|Oficial):\s*(.+?)(\n|$)/i
            );
            if (matchNome) {
              mapaNomesRP[userIdEncontrado] = matchNome[1]
                .replace(/[*_`]/g, "")
                .trim();
            }
          }
        });
      }
    }

    // 4. PROCESSAMENTO DE INATIVIDADE
    const agora = Date.now();
    const resultado = [];
    const listaImunes = CARGOS_IMUNES ? CARGOS_IMUNES.split(",") : [];

    oficiais.forEach((p) => {
      // a) Pula bots
      if (p.user.bot) return;

      // b) FILTRO CRUCIAL: O usuário tem o cargo da corporação selecionada?
      // Se cargoBaseOrg estiver definido e o usuário NÃO tiver esse cargo, ignoramos ele.
      if (cargoBaseOrg && !p.roles.includes(cargoBaseOrg)) return;

      const uid = p.user.id;

      // c) Verifica Imunidade por Cargo (Staff, etc)
      const temCargoImune = p.roles.some((roleId) =>
        listaImunes.includes(roleId)
      );
      if (temCargoImune) return;

      // d) Verifica Férias
      const temFerias = FERIAS_ROLE_ID && p.roles.includes(FERIAS_ROLE_ID);
      if (temFerias) return;

      // e) Cálculo de Inatividade
      // Usamos joined_at como base pois não temos last_message_id confiável via API REST sem Gateway cacheado
      let baseData = new Date(p.joined_at).getTime();

      const diffMs = agora - baseData;
      const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Filtro básico de 7 dias para listar
      if (diffDias >= 7) {
        // Tenta pegar o Passaporte do Nick
        const apelido = p.nick || p.user.username;
        const matchPassaporte = apelido.match(/(\d+)/);
        const passaporte = matchPassaporte ? matchPassaporte[0] : "---";

        // Tenta pegar o Nome RP
        let nomeRpFinal = mapaNomesRP[uid];
        if (!nomeRpFinal) {
          nomeRpFinal = apelido.replace(/[\d|]/g, "").trim(); // Fallback
        }

        const cargo = p.roles.length > 0 ? "Oficial" : "Recruta";

        resultado.push({
          id: uid,
          name: p.nick || p.user.username,
          rpName: nomeRpFinal,
          passaporte: passaporte,
          cargo: cargo,
          dias: diffDias,
          avatar: p.user.avatar
            ? `https://cdn.discordapp.com/avatars/${uid}/${p.user.avatar}.png`
            : null,
          joined_at: p.joined_at,
        });
      }
    });

    // Ordena por dias inativos (maior para menor)
    resultado.sort((a, b) => b.dias - a.dias);

    res.status(200).json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno no servidor API" });
  }
};
