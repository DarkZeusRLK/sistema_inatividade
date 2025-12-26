// =========================================================
// SCRIPT DE METAS OPERACIONAIS - GRR (PRF)
// =========================================================
let listaMetaGRRAtual = [];

window.carregarMetaGRR = async function () {
  const corpo = document.getElementById("corpo-meta-core"); // Reutiliza o container de metas
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    return mostrarAviso("Selecione o período para o GRR.", "warning");
  }

  // Feedback Visual
  corpo.innerHTML =
    '<p style="text-align: center; color: #003399; padding: 20px;">Processando Registros GRR...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "40%";

  try {
    // Chamada para a API com a flag da PRF
    const res = await fetch(
      `/api/meta-core?start=${dataInicio}&end=${dataFim}&org=PRF`
    );
    const { dados, config } = await res.json();
    listaMetaGRRAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    dados.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card-meta";

      // Lógica de Aprovação GRR: 4 Ações + Ensino (Instruções)
      // Como não tem CGPC, a meta depende apenas desses dois
      const metaAtingida = m.isFerias || (m.acoes >= 4 && m.ensino >= 2);

      card.innerHTML = `
        <div class="card-meta-header">
           <div class="user-info">
              <img src="${
                m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
              }" class="avatar-img">
              <div>
                <strong>${m.nome}</strong>
                <small>${m.id}</small>
              </div>
           </div>
           <span class="badge-${metaAtingida ? "success" : "danger"}">
              ${
                m.isFerias
                  ? "PALMEIRA (FÉRIAS)"
                  : metaAtingida
                  ? "META ATINGIDA"
                  : "PENDENTE"
              }
           </span>
        </div>

        <div class="card-meta-body">
           <div class="stat-item">
              <label><i class="fa-solid fa-gun"></i> Ações</label>
              <div class="stat-val">${m.acoes} / 4</div>
              <div class="stat-bar"><div style="width: ${Math.min(
                (m.acoes / 4) * 100,
                100
              )}%; background: #003399"></div></div>
           </div>

           <div class="stat-item">
              <label><i class="fa-solid fa-chalkboard-user"></i> Instrução/Ensino</label>
              <div class="stat-val">${m.ensino}</div>
              <div class="stat-bar"><div style="width: ${Math.min(
                (m.ensino / 2) * 100,
                100
              )}%; background: #d4af37"></div></div>
           </div>
        </div>
      `;
      corpo.appendChild(card);
    });

    mostrarAviso(`Metas GRR carregadas (${dados.length} operadores).`);
  } catch (e) {
    console.error(e);
    mostrarAviso("Erro ao buscar metas do GRR.", "error");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

// =========================================================
// GERADOR DE RELATÓRIO PARA O DISCORD (GRR)
// =========================================================
window.copiarRelatorioGRR = function () {
  if (listaMetaGRRAtual.length === 0)
    return mostrarAviso("Filtre os dados do GRR primeiro.", "error");

  const dIni = document
    .getElementById("data-inicio-core")
    .value.split("-")
    .reverse()
    .join("/");
  const dFim = document
    .getElementById("data-fim-core")
    .value.split("-")
    .reverse()
    .join("/");

  let texto = `🦅 **RELATÓRIO DE METAS - GRR (PRF)** 🦅\n📅 **PERÍODO:** ${dIni} a ${dFim}\n━━━━━━━━━━━━━━━━━━\n\n`;

  listaMetaGRRAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `👤 **OPERADOR:** <@${m.id}>\n🌴 **STATUS:** EM FÉRIAS\n\n`;
    } else {
      const metaAtingida = m.acoes >= 4 && m.ensino >= 2;
      texto += `👤 **OPERADOR:** <@${m.id}>\n`;
      texto += `💥 **AÇÕES:** ${m.acoes}/4\n`;
      texto += `📚 **INSTRUÇÃO:** ${m.ensino}\n`;
      texto += `📊 **STATUS:** ${
        metaAtingida ? "✅ META ATINGIDA" : "❌ NÃO ATINGIU"
      }\n\n`;
    }
  });

  texto += `━━━━━━━━━━━━━━━━━━\n*Relatório gerado via Painel Administrativo*`;

  navigator.clipboard.writeText(texto).then(() => {
    mostrarAviso("Relatório GRR copiado para o Discord!");
  });
};
