require("dotenv").config();
const express = require("express");
const app = express();

app.use(express.json());

app.post("*", async (req, res) => {
  const { token } = req.body;

  try {
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID?.trim()}/member`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const memberData = await memberRes.json();
    if (!memberRes.ok)
      return res.status(401).json({ error: "Membro não encontrado." });

    // 1. PROCESSAMENTO DOS CARGOS DE COMANDO (Múltiplos IDs separados por vírgula)
    const comandoRolesStr = process.env.COMANDO_GERAL_ROLE_ID || "";
    const listaComandoIds = comandoRolesStr.split(",").map((id) => id.trim());

    // Verifica se o usuário possui qualquer um dos IDs de comando listados
    const isComando = memberData.roles.some((roleId) =>
      listaComandoIds.includes(roleId)
    );

    // 2. IDs DAS ORGANIZAÇÕES
    const rolePCERJ = process.env.POLICE_ROLE_ID?.trim();
    const rolePRF = process.env.PRF_ROLE_ID?.trim();
    const rolePMERJ = process.env.PMERJ_ROLE_ID?.trim();

    let userOrg = null;

    // 3. LÓGICA DE ATRIBUIÇÃO
    // Se for COMANDO, não atribuímos organização automática para que ele possa escolher no frontend
    if (!isComando) {
      if (memberData.roles.includes(rolePMERJ)) {
        userOrg = { id: "PMERJ", tema: "tema-pmerj" };
      } else if (memberData.roles.includes(rolePRF)) {
        userOrg = { id: "PRF", tema: "tema-prf" };
      } else if (memberData.roles.includes(rolePCERJ)) {
        userOrg = { id: "PCERJ", tema: "tema-pcerj" };
      }

      // Se não for comando e não tiver nenhum cargo de força, nega o acesso
      if (!userOrg) {
        return res.status(403).json({
          error: "Você não tem um cargo autorizado para este painel.",
        });
      }
    }

    // 4. RESPOSTA PARA O FRONTEND
    res.json({
      org: userOrg ? userOrg.id : null, // Comando recebe null para ativar o seletor
      tema: userOrg ? userOrg.tema : "tema-pcerj", // Tema padrão inicial para comando
      isComando: isComando,
      nome: memberData.nick || memberData.user.username,
    });
  } catch (err) {
    console.error("Erro no Auth:", err);
    res.status(500).json({ error: "Falha na comunicação com o servidor." });
  }
});

module.exports = app;
