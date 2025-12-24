// 1. SISTEMA DE ALERTAS PERSONALIZADOS
function mostrarAviso(mensagem, tipo = "success") {
  let container = document.getElementById("custom-alert-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "custom-alert-container";
    document.body.appendChild(container);
  }

  const alert = document.createElement("div");
  alert.className = `pc-alert ${tipo}`;
  const icon =
    tipo === "success" ? "fa-check-circle" : "fa-exclamation-triangle";

  alert.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${mensagem}</span>
    `;

  container.appendChild(alert);

  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => alert.remove(), 500);
  }, 4000);
}

// 2. VARIÁVEIS GLOBAIS
let listaMembrosAtual = [];

// 3. FUNÇÃO DE FECHAR MODAL
window.fecharModalRelatorio = function () {
  document.getElementById("modal-relatorio").style.display = "none";
};

// 4. SINCRONIZAÇÃO E BARRA DE PROGRESSO
window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progLabel = document.getElementById("progress-label");
  const progPercent = document.getElementById("progress-percentage");

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "CONECTANDO AO DISCORD...";

  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESSANDO...';
  btn.disabled = true;

  // Simulação visual de progresso
  let width = 0;
  const interval = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 2;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";
      if (width > 30) progLabel.innerText = "VASCULHANDO MENSAGENS RECENTES...";
      if (width > 70) progLabel.innerText = "ORGANIZANDO QRA DOS OFICIAIS...";
    }
  }, 200);

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    if (!Array.isArray(dados)) throw new Error("Erro");

    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "AUDITORIA FINALIZADA!";

    listaMembrosAtual = dados;
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();
    const msPorDia = 1000 * 60 * 60 * 24;

    dados.sort((a, b) => a.lastMsg - b.lastMsg);

    dados.forEach((membro) => {
      let dataReferencia =
        membro.lastMsg < dataBaseAuditoria
          ? new Date(dataBaseAuditoria)
          : new Date(membro.lastMsg);
      const dias = Math.floor((agora - dataReferencia) / msPorDia);
      const statusExonerar = dias >= 7;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${
                          membro.avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }" class="avatar-img">
                        <strong>${membro.name}</strong>
                    </div>
                </td>
                <td><code style="color:#888">${membro.id}</code></td>
                <td>${
                  membro.lastMsg === 0
                    ? "DESDE 08/12"
                    : new Date(membro.lastMsg).toLocaleDateString("pt-BR")
                }</td>
                <td><strong style="color: ${
                  statusExonerar ? "#ff4d4d" : "#d4af37"
                }">${dias} Dias</strong></td>
                <td align="center">
                    <span class="${
                      statusExonerar ? "badge-danger" : "badge-success"
                    }">
                        ${statusExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}
                    </span>
                </td>
            `;
      corpo.appendChild(tr);
    });

    if (btnCopiar) btnCopiar.style.display = "inline-block";
    mostrarAviso("Banco de dados sincronizado.");
  } catch (err) {
    clearInterval(interval);
    mostrarAviso("Erro ao buscar dados do servidor.", "error");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

// 5. LÓGICA DE CÓPIA INTELIGENTE (COM DIVISOR SE NECESSÁRIO)
window.copiarRelatorioDiscord = function () {
  if (listaMembrosAtual.length === 0) return;

  const agora = new Date();
  const dataHoje = agora.toLocaleDateString("pt-BR");
  const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

  const exonerados = listaMembrosAtual.filter((m) => {
    let dataRef = m.lastMsg < dataBaseAuditoria ? dataBaseAuditoria : m.lastMsg;
    let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
    return dias >= 7;
  });

  if (exonerados.length === 0) {
    mostrarAviso("Nenhum oficial para exoneração.", "error");
    return;
  }

  // Gerar versão única para teste de tamanho
  let relatorioCompleto =
    "📋 **RELATÓRIO DE EXONERAÇÃO - CORREGEDORIA PCERJ** 📋\n";
  relatorioCompleto += `📅 **DATA:** ${dataHoje}\n`;
  relatorioCompleto += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  exonerados.forEach((m) => {
    let partesNome = m.name.split(" | ");
    let nomeRP = partesNome[0] ? partesNome[0].trim() : m.name;
    let idRP = partesNome[1] ? partesNome[1].trim() : "---";

    relatorioCompleto += `🚔 **QRA:** <@${m.id}>\n`;
    relatorioCompleto += `👤 **NOME NO RP:** ${nomeRP}\n`;
    relatorioCompleto += `🆔 **ID:** ${idRP}\n`;
    relatorioCompleto += `📅 **DATA:** ${dataHoje}\n`;
    relatorioCompleto += `⚖️ **MOTIVO:** Inatividade\n`;
    relatorioCompleto += "────────────────────────────────\n";
  });

  relatorioCompleto +=
    "\n⚠️ *Oficiais citados devem entrar em contato com a Corregedoria.*";

  // Decisão: Copiar direto ou Abrir Modal de Partes
  if (relatorioCompleto.length <= 2000) {
    navigator.clipboard.writeText(relatorioCompleto).then(() => {
      mostrarAviso("Relatório copiado!");
    });
  } else {
    gerarModalDePartes(exonerados, dataHoje);
  }
};

// 6. GERADOR DE PARTES (SÓ ABRE SE > 2000 CARACTERES)
function gerarModalDePartes(exonerados, dataHoje) {
  const tamanhoBloco = 8;
  const partes = [];

  for (let i = 0; i < exonerados.length; i += tamanhoBloco) {
    const bloco = exonerados.slice(i, i + tamanhoBloco);
    let textoPart = `📋 **RELATÓRIO DE EXONERAÇÃO - PARTE ${
      Math.floor(i / tamanhoBloco) + 1
    }** 📋\n`;
    textoPart += `📅 **DATA:** ${dataHoje}\n\n`;

    bloco.forEach((m) => {
      let partesNome = m.name.split(" | ");
      let nomeRP = partesNome[0] ? partesNome[0].trim() : m.name;
      let idRP = partesNome[1] ? partesNome[1].trim() : "---";
      textoPart += `🚔 **QRA:** <@${m.id}> | **ID:** ${idRP} | **Motivo:** Inatividade\n`;
    });

    partes.push(textoPart);
  }

  const container = document.getElementById("container-botoes-partes");
  container.innerHTML = "";

  partes.forEach((texto, index) => {
    const btn = document.createElement("button");
    btn.className = "btn-parte";
    btn.innerHTML = `<i class="fa-solid fa-copy"></i> PARTE ${index + 1}`;
    btn.onclick = () => {
      navigator.clipboard.writeText(texto).then(() => {
        mostrarAviso(`Parte ${index + 1} copiada!`);
        btn.classList.add("copiado");
        btn.innerHTML = `<i class="fa-solid fa-check"></i> COPIADA`;
      });
    };
    container.appendChild(btn);
  });

  document.getElementById("modal-relatorio").style.display = "flex";
}
