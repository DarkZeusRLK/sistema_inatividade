// =========================================================
// SCRIPT DE METAS OPERACIONAIS - GRR (PRF)
// =========================================================
let listaMetaGRRAtual = [];

window.carregarMetaGRR = async function () {
  // 1. IDs corrigidos para a seção GRR
  const corpo = document.getElementById("corpo-meta-grr");
  const progBar = document.getElementById("prog-bar-grr");
  const progContainer = document.getElementById("progress-container-grr");

  const dataInicio = document.getElementById("data-inicio-grr").value;
  const dataFim = document.getElementById("data-fim-grr").value;

  if (!dataInicio || !dataFim) {
    return mostrarAviso("Selecione o período para o GRR.", "warning");
  }

  // Feedback Visual
  corpo.innerHTML =
    '<div style="grid-column: 1/-1; text-align: center; color: var(--gold); padding: 40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>Processando Registros GRR...</div>';
  progContainer.style.display = "block";
  progBar.style.width = "40%";

  try {
    // 2. Rota corrigida para a API do GRR
    const res = await fetch(`/api/meta-grr?start=${dataInicio}&end=${dataFim}`);
    const result = await res.json();

    // O backend meta-grr.js retorna { dados: [...] }
    const dados = result.dados || [];
    listaMetaGRRAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    if (dados.length === 0) {
      corpo.innerHTML =
        '<p style="grid-column: 1/-1; text-align: center; color: #888;">Nenhum operador encontrado com este cargo.</p>';
      return;
    }

    dados.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card-meta";

      // Lógica de Aprovação GRR: 4 Ações + 2 Instruções (Ensino)
      const metaAtingida = m.isFerias || (m.acoes >= 4 && m.ensino >= 2);

      card.innerHTML = `
                <div class="card-meta-header">
                   <div class="user-info">
                      <img src="${
                        m.avatar ||
                        "https://cdn.discordapp.com/embed/avatars/0.png"
                      }" class="avatar-img">
                      <div>
                        <strong>${m.nome}</strong>
                        <small>${m.id}</small>
                      </div>
                   </div>
                   <span class="badge-${
                     m.isFerias
                       ? "warning"
                       : metaAtingida
                       ? "success"
                       : "danger"
                   }">
                      ${
                        m.isFerias
                          ? "🌴 FÉRIAS"
                          : metaAtingida
                          ? "✅ META ATINGIDA"
                          : "⚠️ PENDENTE"
                      }
                   </span>
                </div>

                <div class="card-meta-body">
                   <div class="stat-item">
                      <label><i class="fa-solid fa-gun"></i> Ações de Campo</label>
                      <div class="stat-val">${m.acoes} / 4</div>
                      <div class="stat-bar"><div style="width: ${Math.min(
                        (m.acoes / 4) * 100,
                        100
                      )}%; background: #003399"></div></div>
                   </div>

                   <div class="stat-item">
                      <label><i class="fa-solid fa-chalkboard-user"></i> Instrução/Ensino</label>
                      <div class="stat-val">${m.ensino} / 2</div>
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

  // Uso da função robusta de cópia
  const sucesso = await executarCopiaManual(texto);
  if (sucesso) mostrarAviso("Relatório GRR copiado para o Discord!");
  else mostrarAviso("Erro ao copiar relatório.", "error");
};

// Função de suporte para garantir a cópia em qualquer navegador (PRF/Mobile)
async function executarCopiaManual(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (e) {}
  }
  const textArea = document.createElement("textarea");
  textArea.value = texto;
  document.body.appendChild(textArea);
  textArea.select();
  const ok = document.execCommand("copy");
  document.body.removeChild(textArea);
  return ok;
}
