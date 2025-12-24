// VARIÁVEIS GLOBAIS
let listaMetaCoreAtual = [];

// 1. NAVEGAÇÃO - ABRI CORE
window.abrirMetaCore = function () {
  // Esconde Inatividade e seus botões
  document.getElementById("secao-inatividade").style.display = "none";
  document.getElementById("botoes-inatividade").style.display = "none";

  // Mostra CORE e seus botões (se houver)
  document.getElementById("secao-meta-core").style.display = "block";

  // Atualiza Títulos da Top Bar
  document.getElementById("titulo-pagina").innerText =
    "CONTROLE DE METAS - CORE";
  document.getElementById("subtitulo-pagina").innerText =
    "Análise Semanal de Produtividade e Relatórios";

  // Atualiza Sidebar (Estilo Ativo)
  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-core").classList.add("active");
};

// 2. NAVEGAÇÃO - VOLTAR PARA INATIVIDADE
window.abrirInatividade = function () {
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("secao-meta-core").style.display = "none";

  document.getElementById("titulo-pagina").innerText =
    "SISTEMA DE AUDITORIA DE ATIVIDADE";
  document.getElementById("subtitulo-pagina").innerText =
    "Controle de Presença em Canais Oficiais";

  document.querySelector(".nav-item.active")?.classList.remove("active");
  document.getElementById("nav-inatividade").classList.add("active");
};

// 3. CARREGAR DADOS DA CORE
window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");
  const btnCopiar = document.getElementById("btn-copiar-core");

  corpo.innerHTML =
    '<tr><td colspan="5" align="center">Carregando dados...</td></tr>';
  progContainer.style.display = "block";
  progBar.style.width = "30%";

  try {
    const res = await fetch("/api/meta-core");
    const dados = await res.json();
    listaMetaCoreAtual = dados;

    corpo.innerHTML = ""; // Limpa para inserir os dados reais
    progBar.style.width = "80%";

    dados.forEach((m) => {
      const tr = document.createElement("tr");

      // SE ESTIVER DE FÉRIAS: Ignora metas e mostra status azul
      if (m.isFerias) {
        tr.innerHTML = `
            <td><strong>${m.name}</strong></td>
            <td colspan="3" align="center" style="color: #3498db; font-weight: bold; letter-spacing: 1px;">🌴 EM PERÍODO DE FÉRIAS</td>
            <td align="center">
                <span class="badge-info" style="background: #3498db; color: white; padding: 5px 10px; border-radius: 4px;">REGULAR</span>
            </td>
        `;
      } else {
        // LÓGICA DE METAS (Usando os booleanos que o backend já enviou)
        const acoesOk = m.acoes >= 4;
        const cgpcOk = !m.temCGPC || m.cgpc >= 1; // Se não tem a tag, meta ok. Se tem, precisa de 1.
        const ensinoOk =
          !m.temEnsino || m.ensino_cursos >= 4 || m.ensino_recrut >= 2;

        const metaFinal = acoesOk && cgpcOk && ensinoOk;

        tr.innerHTML = `
            <td><strong>${m.name}</strong></td>
            <td style="color: ${acoesOk ? "#2ecc71" : "#ff4d4d"}">${
          m.acoes
        }/4</td>
            <td>${
              m.temCGPC
                ? m.cgpc >= 1
                  ? "✅ OK"
                  : "❌ PENDENTE"
                : '<span style="color:#555">--</span>'
            }</td>
            <td>${
              m.temEnsino
                ? `${m.ensino_cursos}C / ${m.ensino_recrut}R`
                : '<span style="color:#555">--</span>'
            }</td>
            <td align="center">
                <span class="badge-${metaFinal ? "success" : "danger"}">
                    ${metaFinal ? "✅ META BATIDA" : "❌ PENDENTE"}
                </span>
            </td>
        `;
      }
      corpo.appendChild(tr);
    });

    progBar.style.width = "100%";
    if (btnCopiar) btnCopiar.style.display = "inline-block";
    if (typeof mostrarAviso === "function")
      mostrarAviso("Metas CORE sincronizadas!");
  } catch (e) {
    console.error(e);
    alert("Erro ao carregar metas CORE. Verifique o console.");
  } finally {
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 2000);
  }
};

// 4. COPIAR RELATÓRIO CORE PARA DISCORD
window.copiarRelatorioCORE = function () {
  if (listaMetaCoreAtual.length === 0) return;

  let texto = "🎯 **RELATÓRIO SEMANAL DE METAS - CORE** 🎯\n";
  texto += `📅 **DATA:** ${new Date().toLocaleDateString("pt-BR")}\n`;
  texto += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  listaMetaCoreAtual.forEach((m) => {
    if (m.isFerias) {
      texto += `👤 <@${m.id}> ➔ **🌴 FÉRIAS**\n`;
    } else {
      const acoesIcon = m.acoes >= 4 ? "✅" : "❌";
      texto += `👤 <@${m.id}> ➔ ${acoesIcon} **Ações:** ${m.acoes}/4`;

      if (m.temCGPC) texto += ` | **CGPC:** ${m.cgpc >= 1 ? "OK" : "PENDENTE"}`;
      if (m.temEnsino)
        texto += ` | **Ensino:** ${m.ensino_cursos}C/${m.ensino_recrut}R`;

      texto += "\n";
    }
  });

  texto +=
    "\n⚠️ *Oficiais pendentes devem regularizar suas metas imediatamente.*";

  navigator.clipboard.writeText(texto).then(() => {
    if (typeof mostrarAviso === "function")
      mostrarAviso("Relatório CORE copiado!");
  });
};
