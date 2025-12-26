let listaMetaCoreAtual = [];

// 1. CARREGAR DADOS CORE
window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  const dataInicio = document.getElementById("data-inicio-core").value;
  const dataFim = document.getElementById("data-fim-core").value;

  if (!dataInicio || !dataFim) {
    mostrarAviso("Selecione o período de filtragem.", "warning");
    return;
  }

  corpo.innerHTML =
    '<p style="text-align: center; color: #d4af37; padding: 20px;">Processando registros...</p>';
  progContainer.style.display = "block";
  progBar.style.width = "50%";

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
      card.className = "card-meta"; // Use classes do CSS
      card.style =
        "background: #111; border: 1px solid #333; border-radius: 8px; padding: 15px; margin-bottom: 10px; border-left: 5px solid #444;";

      if (m.isFerias) {
        card.style.borderLeftColor = "#3498db";
        card.innerHTML = `<strong style="color:#fff">${m.name.toUpperCase()}</strong><br><span style="color:#3498db;">🌴 EM FÉRIAS</span>`;
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
                        }; font-weight:bold;">${
          ok ? "✅ META BATIDA" : "❌ PENDENTE"
        }</span>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; font-size:0.8rem; color:#bbb; margin-top:10px;">
                        <div>AÇÕES: ${m.acoes}/4</div>
                        <div>CGPC: ${
                          m.temCGPC ? (m.cgpc >= 1 ? "OK" : "Pendente") : "--"
                        }</div>
                        <div>ENSINO: ${
                          m.temEnsino
                            ? `${m.ensino_cursos}C|${m.ensino_recrut}R`
                            : "--"
                        }</div>
                    </div>`;
      }
      corpo.appendChild(card);
    });
    mostrarAviso("Metas sincronizadas.");
  } catch (e) {
    mostrarAviso("Erro ao buscar metas.", "error");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 1000);
  }
};

// 2. COPIAR RELATÓRIO
window.copiarRelatorioCORE = function () {
  if (listaMetaCoreAtual.length === 0)
    return mostrarAviso("Filtre os dados primeiro.", "error");

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
      texto += `👤 **OFICIAL:** <@${m.id}>\n📊 **STATUS:** ${
        ok ? "✅ META BATIDA" : "❌ PENDENTE"
      }\n┠ **Ações:** ${m.acoes}/4\n`;
      if (m.temCGPC)
        texto += `┠ **CGPC:** ${m.cgpc >= 1 ? "OK" : "PENDENTE"}\n`;
      if (m.temEnsino)
        texto += `┠ **Ensino:** ${m.ensino_cursos}C / ${m.ensino_recrut}R\n`;
      texto += `\n`;
    }
  });

  navigator.clipboard
    .writeText(texto + `━━━━━━━━━━━━━━━━━━`)
    .then(() => mostrarAviso("Copiado!"));
};
