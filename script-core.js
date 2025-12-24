let listaMetaCoreAtual = [];

// 1. ABRIR ABA CORE
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

  const campoInicio = document.getElementById("data-inicio-core");
  const campoFim = document.getElementById("data-fim-core");

  // Só preenche se estiver vazio para não sobrescrever o que você alterou
  if (!campoInicio.value) {
    const hoje = new Date();
    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(hoje.getDate() - 7);
    campoInicio.value = umaSemanaAtras.toISOString().split("T")[0];
    campoFim.value = hoje.toISOString().split("T")[0];
  }
};

// 2. CARREGAR DADOS (FILTRO DE DATAS)
window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    alert("Selecione o período.");
    return;
  }

  corpo.innerHTML =
    '<p style="text-align: center; color: #d4af37; padding: 20px;">Buscando logs operacionais...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "40%";

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
      card.className = "meta-card-item";
      card.style =
        "background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; display: flex; flex-direction: column; gap: 10px; border-left: 5px solid #444;";

      if (m.isFerias) {
        card.style.borderLeftColor = "#3498db";
        card.innerHTML = `<strong style="color:#fff">${m.name.toUpperCase()}</strong><span style="color:#3498db; font-size:0.8rem;">🌴 EM FÉRIAS</span>`;
      } else {
        const ok =
          m.acoes >= 4 &&
          (!m.temCGPC || m.cgpc >= 1) &&
          (!m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2);
        card.style.borderLeftColor = ok ? "#2ecc71" : "#ff4d4d";
        card.innerHTML = `
          <div style="display:flex; justify-content:space-between; border-bottom:1px solid #222; padding-bottom:5px;">
            <strong style="color:#fff">${m.name.toUpperCase()}</strong>
            <span style="color:${
              ok ? "#2ecc71" : "#ff4d4d"
            }; font-weight:bold; font-size:0.75rem;">${
          ok ? "✅ META BATIDA" : "❌ PENDENTE"
        }</span>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-size:0.8rem; color:#bbb; margin-top:5px;">
            <div><small style="display:block; color:#666;">AÇÕES</small> ${
              m.acoes
            }/4</div>
            <div><small style="display:block; color:#666;">CGPC</small> ${
              m.temCGPC ? (m.cgpc >= 1 ? "OK" : "Pendente") : "--"
            }</div>
            <div><small style="display:block; color:#666;">ENSINO</small> ${
              m.temEnsino ? `${m.ensino_cursos}C|${m.ensino_recrut}R` : "--"
            }</div>
          </div>
        `;
      }
      corpo.appendChild(card);
    });
  } catch (e) {
    alert("Erro ao carregar metas.");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

// 3. COPIAR RELATÓRIO (FORMATO VERTICAL SOLICITADO)
window.copiarRelatorioCORE = function () {
  if (listaMetaCoreAtual.length === 0)
    return alert("Filtre as metas antes de copiar.");

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

      // Formato Vertical um abaixo do outro
      texto += `👤 **OFICIAL:** <@${m.id}>\n`;
      texto += `📊 **STATUS:** ${ok ? "✅ META BATIDA" : "❌ PENDENTE"}\n`;
      texto += `┠ **Ações:** ${m.acoes}/4\n`;
      if (m.temCGPC)
        texto += `┠ **CGPC:** ${m.cgpc >= 1 ? "OK" : "PENDENTE"}\n`;
      if (m.temEnsino)
        texto += `┠ **Ensino:** ${m.ensino_cursos} Cursos / ${m.ensino_recrut} Recrut.\n`;
      texto += `\n`;
    }
  });

  texto += `━━━━━━━━━━━━━━━━━━\n⚠️ *Regularizem suas pendências operacionais.*`;

  navigator.clipboard
    .writeText(texto)
    .then(() => alert("Relatório Vertical copiado para o Discord!"));
};
// FUNÇÃO PARA VOLTAR PARA A ABA DE INATIVIDADE
window.abrirInatividade = function () {
  // 1. Alterna a visibilidade das seções
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-meta-core").style.display = "none";

  // 2. Alterna os botões da barra superior
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("botoes-core").style.display = "none";

  // 3. Restaura os títulos originais
  document.getElementById("titulo-pagina").innerText =
    "SISTEMA DE AUDITORIA DE ATIVIDADE";
  document.getElementById("subtitulo-pagina").innerText =
    "Controle de Presença em Canais Oficiais";

  // 4. Atualiza o estado visual da Sidebar (Menu lateral)
  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-inatividade").classList.add("active");
};
