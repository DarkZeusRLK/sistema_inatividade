// =========================================================
// SCRIPT DE METAS OPERACIONAIS - GRR (PRF) - VERSÃO FINAL
// =========================================================
let listaMetaGRRAtual = [];

window.carregarMetaGRR = async function () {
  // Seleção de elementos usando IDs específicos do GRR
  const corpo = document.getElementById("corpo-meta-grr");
  const progBar = document.getElementById("prog-bar-grr");
  const progContainer = document.getElementById("progress-container-grr");

  const dataInicio = document.getElementById("data-inicio-grr").value;
  const dataFim = document.getElementById("data-fim-grr").value;

  if (!dataInicio || !dataFim) {
    return mostrarAviso("Selecione o período para o GRR.", "warning");
  }

  // Feedback Visual Inicial
  corpo.innerHTML =
    '<div style="grid-column: 1/-1; text-align: center; color: #d4af37; padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Processando Registros GRR...</div>';
  progContainer.style.display = "block";
  progBar.style.width = "10%";

  try {
    // Chamada para a API do GRR
    const res = await fetch(
      `/api/relatorios.js?tipo=grr&start=${dataInicio}&end=${dataFim}`
    );
    const result = await res.json();
    const dados = result.dados || [];
    listaMetaGRRAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    if (dados.length === 0) {
      corpo.innerHTML =
        '<p style="grid-column: 1/-1; text-align: center; color: #888;">Nenhum operador encontrado com o cargo GRR.</p>';
      return;
    }

    dados.forEach((m) => {
      const card = document.createElement("div");
      // Usamos a classe 'horizontal' para alinhar como na CORE
      card.className = "card-meta horizontal";

      const metaAtingida = m.isFerias || (m.acoes >= 4 && m.ensino >= 2);

      card.innerHTML = `
                <div class="card-info-main">
                    <img src="${
                      m.avatar ||
                      "https://cdn.discordapp.com/embed/avatars/0.png"
                    }" class="avatar-img">
                    <div class="user-data">
                        <strong>${m.nome}</strong>
                        <small>${m.id}</small>
                    </div>
                </div>

                <div class="card-stats-wrapper">
                    <div class="stat-block">
                        <div class="stat-label">
                            <span><i class="fa-solid fa-gun"></i> Ações</span>
                            <small>${m.acoes}/4</small>
                        </div>
                        <div class="stat-bar-bg">
                            <div class="stat-bar-fill" style="width: ${Math.min(
                              (m.acoes / 4) * 100,
                              100
                            )}%; background: #003399"></div>
                        </div>
                    </div>

                    <div class="stat-block">
                        <div class="stat-label">
                            <span><i class="fa-solid fa-chalkboard-user"></i> Ensino</span>
                            <small>${m.ensino}/2</small>
                        </div>
                        <div class="stat-bar-bg">
                            <div class="stat-bar-fill" style="width: ${Math.min(
                              (m.ensino / 2) * 100,
                              100
                            )}%; background: #d4af37"></div>
                        </div>
                    </div>
                </div>

                <div class="card-status-badge">
                    <span class="badge-${
                      m.isFerias
                        ? "warning"
                        : metaAtingida
                        ? "success"
                        : "danger"
                    }">
                        ${
                          m.isFerias
                            ? "PALMEIRA"
                            : metaAtingida
                            ? "ATINGIDA"
                            : "PENDENTE"
                        }
                    </span>
                </div>
            `;
      corpo.appendChild(card);
    });

    mostrarAviso(`Metas GRR carregadas com sucesso.`);
  } catch (e) {
    console.error(e);
    mostrarAviso("Erro ao buscar metas do GRR.", "error");
  } finally {
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1000);
  }
};

// =========================================================
// GERADOR DE RELATÓRIO PARA O DISCORD (GRR)
// =========================================================
window.copiarRelatorioGRR = async function () {
  if (listaMetaGRRAtual.length === 0)
    return mostrarAviso("Filtre os dados do GRR primeiro.", "error");

  const dIni = document
    .getElementById("data-inicio-grr")
    .value.split("-")
    .reverse()
    .join("/");
  const dFim = document
    .getElementById("data-fim-grr")
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
      texto += `📚 **INSTRUÇÃO:** ${m.ensino}/2\n`;
      texto += `📊 **STATUS:** ${
        metaAtingida ? "✅ META ATINGIDA" : "❌ NÃO ATINGIU"
      }\n\n`;
    }
  });

  texto += `━━━━━━━━━━━━━━━━━━\n*Relatório gerado via Painel Administrativo*`;

  const sucesso = await executarCopiaGRR(texto);
  if (sucesso) mostrarAviso("Relatório GRR copiado!");
  else mostrarAviso("Erro ao copiar relatório.", "error");
};

async function executarCopiaGRR(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {}
  }
  const textArea = document.createElement("textarea");
  textArea.value = texto;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textArea);
  return ok;
}
