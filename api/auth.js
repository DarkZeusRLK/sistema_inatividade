// =========================================================
// API DE AUTENTICAÇÃO (CORRIGIDA)
// =========================================================
const express = require("express");
const app = express();

// Garante que o fetch funcione em qualquer versão do Node
const fetch = global.fetch || require("node-fetch");

app.use(express.json());

// --- 1. CONFIGURAÇÃO DE CORS (CRUCIAL PARA O LOGIN FUNCIONAR) ---
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Se o navegador fizer uma pré-verificação (OPTIONS), respondemos OK imediatamente
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.post("*", async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: "Token de autenticação não fornecido na solicitação." });
  }

  try {
    // Busca os dados do membro no Discord
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID?.trim()}/member`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!memberRes.ok) {
      const errData = await memberRes.json().catch(() => ({}));
      console.error("Erro Discord API:", errData);
      return res
        .status(401)
        .json({ error: "Falha na autenticação: Membro não encontrado no servidor ou token de acesso inválido." });
    }

    const memberData = await memberRes.json();

    // 1. PROCESSAMENTO DOS CARGOS DE COMANDO (Múltiplos IDs separados por vírgula)
    const comandoRolesStr = process.env.COMANDO_GERAL_ROLE_ID || "";
    // Limpa espaços e cria array
    const listaComandoIds = comandoRolesStr.split(",").map((id) => id.trim());

    // Verifica se o usuário possui qualquer um dos IDs de comando listados
    const isComando = memberData.roles.some((roleId) =>
      listaComandoIds.includes(roleId)
    );

    // 2. IDs DAS ORGANIZAÇÕES
    const rolePCERJ = process.env.POLICE_ROLE_ID?.trim();
    const rolePRF = process.env.PRF_ROLE_ID?.trim();
    const rolePMERJ = process.env.PMERJ_ROLE_ID?.trim();
    const rolePF = process.env.PF_ROLE_ID?.trim();

    let userOrg = null;

    // 3. LÓGICA DE ATRIBUIÇÃO
    // Se for COMANDO, não atribuímos organização automática (null) para ativar o menu de escolha
    if (!isComando) {
      if (memberData.roles.includes(rolePMERJ)) {
        userOrg = { id: "PMERJ", tema: "tema-pmerj" };
      } else if (memberData.roles.includes(rolePRF)) {
        userOrg = { id: "PRF", tema: "tema-prf" };
      } else if (memberData.roles.includes(rolePCERJ)) {
        userOrg = { id: "PCERJ", tema: "tema-pcerj" };
      } else if (memberData.roles.includes(rolePF)) {
        // AQUI ESTÁ A MUDANÇA
        userOrg = { id: "PF", tema: "tema-pf" };
      }

      // Se não for comando e não tiver nenhum cargo de força, nega o acesso
      if (!userOrg) {
        return res.status(403).json({
          error: "Acesso negado: Você não possui um cargo autorizado para acessar este painel administrativo.",
        });
      }
    }

    // 4. RESPOSTA PARA O FRONTEND
    res.json({
      org: userOrg ? userOrg.id : null, // Comando recebe null
      tema: userOrg ? userOrg.tema : "tema-pcerj", // Tema padrão
      isComando: isComando,
      nome: memberData.nick || memberData.user.username,
      avatar: memberData.user.avatar
        ? `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png`
        : null,
    });
  } catch (err) {
    console.error("Erro Crítico Auth:", err);
    res
      .status(500)
      .json({ error: "Erro interno no servidor de autenticação. Por favor, tente novamente mais tarde." });
  }
});

module.exports = app;
