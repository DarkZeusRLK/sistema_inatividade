require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/auth", async (req, res) => {
  const { token } = req.body;

  try {
    // 1. Log para verificar se as variáveis do .env subiram
    console.log("Tentando validar Guild:", process.env.GUILD_ID);

    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID?.trim()}/member`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const memberData = await memberRes.json();

    if (!memberRes.ok) {
      console.error("Erro Discord API:", memberData);
      return res.status(memberRes.status).json({
        error: "Membro não encontrado ou token inválido.",
        details: memberData,
      });
    }

    // 2. Mapeamento (Usando .trim() para evitar espaços invisíveis do .env)
    const ORG_MAP = {
      [process.env.ROLE_ID_PCERJ?.trim()]: { id: "PCERJ", tema: "tema-pcerj" },
      [process.env.ROLE_ID_PRF?.trim()]: { id: "PRF", tema: "tema-prf" },
      [process.env.ROLE_ID_PMERJ?.trim()]: { id: "PMERJ", tema: "tema-pmerj" },
    };

    // 3. Verifica os cargos
    let userOrg = null;
    console.log("Cargos do usuário:", memberData.roles);

    for (const roleId of memberData.roles) {
      if (ORG_MAP[roleId]) {
        userOrg = ORG_MAP[roleId];
        break;
      }
    }

    if (!userOrg) {
      return res
        .status(403)
        .json({ error: "Você não possui cargo de administração." });
    }

    res.json({
      org: userOrg.id,
      tema: userOrg.tema,
      nome: memberData.nick || memberData.user.username,
      avatar: memberData.user.avatar
        ? `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png`
        : null,
    });
  } catch (err) {
    console.error("Erro Crítico no Server:", err);
    res
      .status(500)
      .json({ error: "Falha interna no servidor de autenticação." });
  }
});

// Essencial para rodar localmente
const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Rodando em http://localhost:${PORT}`));
}

// Exportação para a Vercel tratar como Serverless
module.exports = app;
