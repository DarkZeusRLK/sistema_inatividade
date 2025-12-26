require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();

app.use(express.json());

// Serve os arquivos da pasta 'public' (onde devem estar seu index, login, style, etc)
app.use(express.static(path.join(__dirname, "public")));

// ROTA DE AUTENTICAÇÃO
app.post("/api/auth", async (req, res) => {
  const { token } = req.body;

  try {
    const memberRes = await fetch(
      `https://discord.com/api/users/@me/guilds/${process.env.GUILD_ID}/member`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!memberRes.ok) {
      return res
        .status(401)
        .json({ error: "Membro não encontrado no servidor oficial." });
    }

    const memberData = await memberRes.json();

    // IDs vindos do seu .env
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

    if (!userOrg)
      return res
        .status(403)
        .json({ error: "Acesso negado: Sem cargo administrativo." });

    res.json({
      org: userOrg.id,
      tema: userOrg.tema,
      nome: memberData.nick || "Oficial",
    });
  } catch (err) {
    console.error("Erro na auth:", err);
    res.status(500).json({ error: "Falha na comunicação com o servidor." });
  }
});

// Inicialização
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Servidor rodando em http://localhost:${PORT}`)
);
