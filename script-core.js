// VARIÁVEL GLOBAL PARA ARMAZENAR OS DADOS DO RELATÓRIO
let listaMetaCoreAtual = [];

// 1. NAVEGAÇÃO - ABRIR ABA CORE
window.abrirMetaCore = function () {
  document.getElementById("secao-inatividade").style.display = "none";
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("botoes-inatividade").style.display = "none";
  document.getElementById("botoes-core").style.display = "block";

  document.getElementById("titulo-pagina").innerText =
    "CONTROLE DE METAS - CORE";
  document.getElementById("subtitulo-pagina").innerText =
    "Análise de Produtividade por Período Personalizado";

  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-core").classList.add("active");

  // Auto-preencher apenas se estiver vazio
  const campoInicio = document.getElementById("data-inicio-core");
  const campoFim = document.getElementById("data-fim-core");
  if (!campoInicio.value || !campoFim.value) {
    const hoje = new Date();
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(hoje.getDate() - 7);
    campoInicio.value = umaSemanaAtras.toISOString().split("T")[0];
    campoFim.value = hoje.toISOString().split("T")[0];
  }
};

window.abrirInatividade = function () {
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-meta-core").style.display = "none";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("botoes-core").style.display = "none";
  document.getElementById("titulo-pagina").innerText =
    "SISTEMA DE AUDITORIA DE ATIVIDADE";
  document.getElementById("subtitulo-pagina").innerText =
    "Controle de Presença em Canais Oficiais";
  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-inatividade").classList.add("active");
};

// 2. CARREGAR DADOS COM FILTRO DE DATA
window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  // Captura os valores no momento do clique para garantir que a alteração manual funcione
  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    alert("Por favor, selecione as datas de início e fim.");
    return;
  }

  corpo.innerHTML =
    '<p style="text-align: center; color: #d4af37; padding: 20px;">Sincronizando logs operacionais...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "30%";

  try {
    const res = await fetch(
      `/api/meta-core?start=${dataInicio}&end=${dataFim}`
    );
    const dados = await res.json();
    listaMetaCoreAtual = dados;

    corpo.innerHTML = "";
    progBar.style.width = "100%";

    dados.forEach((m) => {
      const card = document.createElement("div");
      card.style =
        "background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 10px; border-left: 5px solid #444;";

      if (m.isFerias) {
        card.style.borderLeftColor = "#3498db";
        card.innerHTML = `<div><strong style="color:#fff">${m.name.toUpperCase()}</strong> <span style="color:#3498db; font-size:0.8rem; margin-left:10px;">🌴 FÉRIAS</span></div>`;
      } else {
        const ok =
          m.acoes >= 4 &&
          (!m.temCGPC || m.cgpc >= 1) &&
          (!m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2);
        card.style.borderLeftColor = ok ? "#2ecc71" : "#ff4d4d";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between;">
            <strong style="color:#fff">${m.name.toUpperCase()}</strong>
            <span style="color:${
              ok ? "#2ecc71" : "#ff4d4d"
            }; font-weight:bold;">${ok ? "✅ OK" : "❌ PENDENTE"}</span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-size:0.85rem; color:#bbb;">
            <span>Ações: ${m.acoes}/4</span>
            <span>CGPC: ${
              m.temCGPC ? (m.cgpc >= 1 ? "Sim" : "Não") : "--"
            }</span>
            <span>Ensino: ${
              m.temEnsino ? `${m.ensino_cursos}C|${m.ensino_recrut}R` : "--"
            }</span>
          </div>
        `;
      }
      corpo.appendChild(card);
    });
  } catch (e) {
    alert("Erro ao buscar dados.");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

// 3. COPIAR RELATÓRIO (FORMATO VERTICAL PARA DISCORD)
window.copiarRelatorioCORE = function () {
  if (listaMetaCoreAtual.length === 0)
    return alert("Filtre os dados antes de copiar.");

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

  let texto = `🎯 **RELATÓRIO DE METAS CORE**\n📅 **PERÍODO:** ${dIni} a ${dFim}\n━━━━━━━━━━━━━━━━━━\n\n`;

  listaMetaCoreAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `👤 **OFICIAL:** <@${m.id}>\n🌴 **STATUS:** EM FÉRIAS\n\n`;
    } else {
      const ok =
        m.acoes >= 4 &&
        (!m.temCGPC || m.cgpc >= 1) &&
        (!m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2);

      texto += `👤 **OFICIAL:** <@${m.id}>\n`;
      texto += `${ok ? "✅" : "❌"} **META:** ${ok ? "BATIDA" : "PENDENTE"}\n`;
      texto += `┠ **Ações:** ${m.acoes}/4\n`;
      if (m.temCGPC)
        texto += `┠ **CGPC:** ${
          m.cgpc >= 1 ? "OK (Relatório entregue)" : "PENDENTE"
        }\n`;
      if (m.temEnsino)
        texto += `┠ **Ensino:** ${m.ensino_cursos} Cursos / ${m.ensino_recrut} Recrut.\n`;
      texto += `\n`; // Espaço entre oficiais
    }
  });

  texto += `━━━━━━━━━━━━━━━━━━\n⚠️ *Regularizem suas metas pendentes.*`;

  navigator.clipboard
    .writeText(texto)
    .then(() => alert("Relatório Vertical copiado!"));
};
