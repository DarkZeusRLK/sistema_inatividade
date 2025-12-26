// =========================================================
// SCRIPT DE METAS OPERACIONAIS - BOPE (PMERJ)
// =========================================================
let listaMetaBOPEAtual = [];

window.carregarMetaBOPE = async function () {
  const corpo = document.getElementById("corpo-meta-bope");
  const progBar = document.getElementById("prog-bar-bope");
  const progContainer = document.getElementById("progress-container-core"); // Container compartilhado

  const dataInicio = document.getElementById("data-inicio-bope").value;
  const dataFim = document.getElementById("data-fim-bope").value;

  if (!dataInicio || !dataFim) {
    return mostrarAviso("Selecione o período para o BOPE.", "warning");
  }

  // Feedback Visual (Cores PMERJ: Azul Marinho)
  corpo.innerHTML =
    '<p style="text-align: center; color: var(--gold); padding: 20px; font-weight: bold;">PROCESSANDO REGISTROS BOPE...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "40%";
  progBar.style.background = "var(--gold)";

  try {
    const res = await fetch(
      `/api/meta-bope?start=${dataInicio}&end=${dataFim}&org=PMERJ`
    );
    const { dados } = await res.json();
    listaMetaBOPEAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    dados.forEach((m) => {
      const card = document.createElement("div");
      card.className = "card-meta"; // Usa a classe que definimos no style.css

      // Meta BOPE: 4 Ações + 2 Cursos (Independente do tipo)
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
              )}%; background: var(--gold)"></div></div>
           </div>

           <label style="font-size: 0.7rem; color: var(--gray); margin-top: 10px; display: block;">DETALHAMENTO DE ENSINO (${
             m.ensino
           }/2):</label>
           <div class="meta-stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px; margin-top: 5px;">
              <div class="stat-box" title="Básico">
                <small>Básico</small>
                <span style="display:block; font-weight:bold; color: var(--gold)">${
                  m.ensino_basico
                }</span>
              </div>
              <div class="stat-box" title="C. Ações">
                <small>Curs.</small>
                <span style="display:block; font-weight:bold; color: var(--gold)">${
                  m.ensino_acoes_curso
                }</span>
              </div>
              <div class="stat-box" title="Recrutamento">
                <small>Recrut.</small>
                <span style="display:block; font-weight:bold; color: var(--gold)">${
                  m.ensino_recrut
                }</span>
              </div>
           </div>
        </div>
      `;
      corpo.appendChild(card);
    });

    mostrarAviso(`Metas BOPE carregadas.`);
  } catch (e) {
    mostrarAviso("Erro ao buscar metas do BOPE.", "error");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

window.copiarRelatorioBOPE = function () {
  if (listaMetaBOPEAtual.length === 0)
    return mostrarAviso("Filtre os dados primeiro.", "error");

  let texto = `💀 **RELATÓRIO DE METAS - BOPE (PMERJ)** 💀\n━━━━━━━━━━━━━━━━━━\n\n`;

  listaMetaBOPEAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `👤 **OPERADOR:** <@${m.id}> | 🌴 **FÉRIAS**\n`;
    } else {
      const status = m.acoes >= 4 && m.ensino >= 2 ? "✅" : "❌";
      texto += `${status} **OPERADOR:** <@${m.id}>\n`;
      texto += `└ 🔫 Ações: ${m.acoes}/4 | 📚 Ensino: ${m.ensino}/2\n`;
      // Opcional: Detalhar qual ensino ele fez no relatório
      if (m.ensino > 0) {
        let detalhes = [];
        if (m.ensino_basico > 0) detalhes.push(`Básico: ${m.ensino_basico}`);
        if (m.ensino_acoes_curso > 0)
          detalhes.push(`Cursos: ${m.ensino_acoes_curso}`);
        if (m.ensino_recrut > 0) detalhes.push(`Recrut: ${m.ensino_recrut}`);
        texto += `   *( ${detalhes.join(" | ")} )*\n`;
      }
    }
  });

  texto += `\n━━━━━━━━━━━━━━━━━━\n*Caveira! Gerado via Painel Administrativo*`;

  // Usa o divisor de relatório para evitar erro de 2000 caracteres
  dividirRelatorio(texto, (bloco) => bloco);
};
