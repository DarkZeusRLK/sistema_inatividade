// =========================================================
// SCRIPT DE METAS OPERACIONAIS - COT (PF)
// =========================================================
let listaMetaCOTAtual = [];

window.carregarMetaCOT = async function () {
  const corpo = document.getElementById("corpo-meta-cot");
  const progBar = document.getElementById("prog-bar-cot");
  const progContainer = document.getElementById("progress-container-cot");

  const dataInicio = document.getElementById("data-inicio-cot").value;
  const dataFim = document.getElementById("data-fim-cot").value;

  if (!dataInicio || !dataFim) {
    return mostrarAviso("Selecione o período para o COT (PF).", "warning");
  }

  // Feedback Visual
  corpo.innerHTML =
    '<p style="text-align: center; color: var(--gold); padding: 20px; font-weight: bold;">PROCESSANDO DADOS DE INTELIGÊNCIA...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "40%";
  progBar.style.background = "var(--gold)";

  try {
    // Chama a API passando a Org PF
    const res = await fetch(
      `/api/relatorios.js?tipo=cot&start=${dataInicio}&end=${dataFim}&org=PF`
    );
    const { dados } = await res.json();
    listaMetaCOTAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    dados.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card-meta";

      // Lógica de Metas COT (Exemplo: 4 Operações + 2 Treinamentos/Intel)
      const metaAtingida = m.isFerias || (m.acoes >= 4 && m.ensino >= 2);

      card.innerHTML = `
        <div class="card-meta-header" style="border-bottom: 1px solid var(--border);">
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
                  ? "APROVADO"
                  : "PENDENTE"
              }
           </span>
        </div>

        <div class="card-meta-body">
           <div class="stat-item">
              <label><i class="fa-solid fa-user-secret"></i> Operações / Missões</label>
              <div class="stat-val">${m.acoes} / 4</div>
              <div class="stat-bar"><div style="width: ${Math.min(
                (m.acoes / 4) * 100,
                100
              )}%; background: var(--gold)"></div></div>
           </div>

           <label style="font-size: 0.7rem; color: var(--gray); margin-top: 10px; display: block;">
             CAPACITAÇÃO E INTELIGÊNCIA (${m.ensino}/2):
           </label>
           
           <div class="meta-stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-top: 5px;">
              <div class="stat-box" title="Investigação / Básico">
                <small>Investig.</small>
                <span style="display:block; font-weight:bold; color: var(--gold)">${
                  m.ensino_basico || 0
                }</span>
              </div>
              <div class="stat-box" title="Tático Avançado">
                <small>Tático</small>
                <span style="display:block; font-weight:bold; color: var(--gold)">${
                  m.ensino_acoes_curso || 0
                }</span>
              </div>
              <div class="stat-box" title="Recrutamento">
                <small>Recrut.</small>
                <span style="display:block; font-weight:bold; color: var(--gold)">${
                  m.ensino_recrut || 0
                }</span>
              </div>
           </div>
        </div>
      `;
      corpo.appendChild(card);
    });

    mostrarAviso(`Relatório COT carregado com sucesso.`);
  } catch (e) {
    console.error(e);
    mostrarAviso("Erro ao buscar metas do COT.", "error");
    // Fallback visual em caso de erro (opcional, para teste)
    corpo.innerHTML =
      '<p style="text-align: center; color: #f55; padding: 20px;">Falha na conexão com o banco de dados.</p>';
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

window.copiarRelatorioCOT = function () {
  if (listaMetaCOTAtual.length === 0)
    return mostrarAviso("Filtre os dados primeiro.", "error");

  let texto = `🦅 **RELATÓRIO DE ATIVIDADE - COT (PF)** 🦅\n━━━━━━━━━━━━━━━━━━\n\n`;

  listaMetaCOTAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `🕵️ **AGENTE:** <@${m.id}> | 🌴 **LICENÇA/FÉRIAS**\n`;
    } else {
      const status = m.acoes >= 4 && m.ensino >= 2 ? "✅" : "❌";
      texto += `${status} **AGENTE:** <@${m.id}>\n`;
      texto += `└ 🚔 Ops: ${m.acoes}/4 | 📡 Intel/Treino: ${m.ensino}/2\n`;

      if (m.ensino > 0) {
        let detalhes = [];
        if (m.ensino_basico > 0) detalhes.push(`Investig: ${m.ensino_basico}`);
        if (m.ensino_acoes_curso > 0)
          detalhes.push(`Tático: ${m.ensino_acoes_curso}`);
        if (m.ensino_recrut > 0) detalhes.push(`Recrut: ${m.ensino_recrut}`);
        texto += `   *( ${detalhes.join(" | ")} )*\n`;
      }
    }
  });

  texto += `\n━━━━━━━━━━━━━━━━━━\n*Departamento de Polícia Federal - Sistema Integrado*`;

  // Usa a função global dividirRelatorio (presumindo que exista no script.js principal)
  if (typeof dividirRelatorio === "function") {
    dividirRelatorio(texto, (bloco) => bloco);
  } else {
    // Fallback caso a função não exista
    navigator.clipboard.writeText(texto).then(() => {
      mostrarAviso(
        "Relatório copiado para a área de transferência!",
        "success"
      );
    });
  }
};
