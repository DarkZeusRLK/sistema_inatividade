// =========================================================
// SCRIPT DE METAS OPERACIONAIS - BOPE (PMERJ)
// =========================================================
let listaMetaBOPEAtual = [];

window.carregarMetaBOPE = async function () {
  const corpo = document.getElementById("corpo-meta-core"); // Reutiliza o container de metas
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    return mostrarAviso("Selecione o período para o BOPE.", "warning");
  }

  // Feedback Visual (Cores PMERJ: Verde Oliva / Escuro)
  corpo.innerHTML =
    '<p style="text-align: center; color: #1b4332; padding: 20px; font-weight: bold;">PROCESSANDO REGISTROS BOPE...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "40%";
  progBar.style.background = "#1b4332"; // Verde PMERJ

  try {
    // Chamada para a API com a flag da PMERJ
    const res = await fetch(
      `/api/meta-core?start=${dataInicio}&end=${dataFim}&org=PMERJ`
    );
    const { dados } = await res.json();
    listaMetaBOPEAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    dados.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card-meta";

      // Lógica de Meta BOPE: 4 Ações + 2 Instruções (Ensino)
      const metaAtingida = m.isFerias || (m.acoes >= 4 && m.ensino >= 2);

      card.innerHTML = `
        <div class="card-meta-header" style="border-bottom: 1px solid #1b4332;">
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
                  ? "🌴 EM FÉRIAS"
                  : metaAtingida
                  ? "META BATIDA"
                  : "PENDENTE"
              }
           </span>
        </div>

        <div class="card-meta-body">
           <div class="stat-item">
              <label><i class="fa-solid fa-person-rifle"></i> Ações de Campo</label>
              <div class="stat-val">${m.acoes} / 4</div>
              <div class="stat-bar"><div style="width: ${Math.min(
                (m.acoes / 4) * 100,
                100
              )}%; background: #1b4332"></div></div>
           </div>

           <div class="stat-item">
              <label><i class="fa-solid fa-graduation-cap"></i> Instrução / Ensino</label>
              <div class="stat-val">${m.ensino} / 2</div>
              <div class="stat-bar"><div style="width: ${Math.min(
                (m.ensino / 2) * 100,
                100
              )}%; background: #2d6a4f"></div></div>
           </div>
        </div>
      `;
      corpo.appendChild(card);
    });

    mostrarAviso(`Metas BOPE carregadas (${dados.length} operacionais).`);
  } catch (e) {
    console.error(e);
    mostrarAviso("Erro ao buscar metas do BOPE.", "error");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

// =========================================================
// GERADOR DE RELATÓRIO PARA O DISCORD (BOPE)
// =========================================================
window.copiarRelatorioBOPE = function () {
  if (listaMetaBOPEAtual.length === 0)
    return mostrarAviso("Filtre os dados do BOPE primeiro.", "error");

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

  let texto = `💀 **RELATÓRIO DE METAS - BOPE (PMERJ)** 💀\n📅 **PERÍODO:** ${dIni} a ${dFim}\n━━━━━━━━━━━━━━━━━━\n\n`;

  listaMetaBOPEAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `👤 **OPERADOR:** <@${m.id}>\n🌴 **STATUS:** FÉRIAS\n\n`;
    } else {
      const metaAtingida = m.acoes >= 4 && m.ensino >= 2;
      texto += `👤 **OPERADOR:** <@${m.id}>\n`;
      texto += `🔫 **AÇÕES:** ${m.acoes}/4\n`;
      texto += `📚 **INSTRUÇÕES:** ${m.ensino}/2\n`;
      texto += `📊 **STATUS:** ${
        metaAtingida ? "✅ APROVADO" : "❌ PENDENTE"
      }\n\n`;
    }
  });

  texto += `━━━━━━━━━━━━━━━━━━\n*Caveira! Relatório via Painel Administrativo*`;

  navigator.clipboard.writeText(texto).then(() => {
    mostrarAviso("Relatório BOPE copiado (💀)! ");
  });
};
