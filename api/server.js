// 1. IMPORTAÇÕES
require("dotenv").config(); // ESSENCIAL para ler o arquivo .env
const express = require("express");
const app = express();

// 2. MIDDLEWARES
app.use(express.json()); // Permite que o servidor entenda o JSON que o login envia

// =========================================================
// 3. SUA NOVA ROTA DE AUTENTICAÇÃO (COLE AQUI)
// =========================================================
app.post("/api/auth", async (req, res) => {
  const { token } = req.body;

  try {
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID}/member`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    const memberData = await memberRes.json();

    const ORG_MAP = {
      [process.env.ROLE_ID_PCERJ]: { id: "PCERJ", tema: "tema-pcerj" },
      [process.env.ROLE_ID_PRF]: { id: "PRF", tema: "tema-prf" },
      [process.env.ROLE_ID_PMERJ]: { id: "PMERJ", tema: "tema-pmerj" },
    };

    let userOrg = null;
    for (const roleId of memberData.roles) {
      if (ORG_MAP[roleId]) {
        userOrg = ORG_MAP[roleId];
        break;
      }
    }

    if (!userOrg) return res.status(403).json({ error: "Acesso negado" });

    res.json({
      org: userOrg.id,
      tema: userOrg.tema,
      nome: memberData.nick || "Oficial",
    });
  } catch (err) {
    res.status(500).json({ error: "Falha na autenticação" });
  }
});

// Outras rotas que você já tem...
// app.get('/api/membros-inativos', ... )

app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
