// Sistema de Alertas Governamentais
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

let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progLabel = document.getElementById("progress-label");
  const progPercent = document.getElementById("progress-percentage");

  // Reset e Mostrar Barra
  corpo.innerHTML = "";
  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "CONECTANDO AO BANCO DE DADOS DO DISCORD...";

  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESSANDO...';
  btn.disabled = true;

  // Simulação de progresso (O bot leva tempo processando os canais sequencialmente)
  let width = 0;
  const interval = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 2;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";

      if (width > 20) progLabel.innerText = "ANALISANDO CANAIS DE TEXTO...";
      if (width > 50)
        progLabel.innerText = "VERIFICANDO HISTÓRICO DE MENSAGENS...";
      if (width > 80) progLabel.innerText = "FINALIZANDO RELATÓRIO...";
    }
  }, 200);

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    if (!Array.isArray(dados)) throw new Error("Erro");

    // Finaliza a barra
    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "AUDITORIA CONCLUÍDA!";

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
                    ? "INÍCIO DA AUDITORIA"
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
    mostrarAviso("Relatório de inatividade atualizado com sucesso.");
  } catch (err) {
    clearInterval(interval);
    mostrarAviso("Erro na comunicação com a API do Discord.", "error");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
    // Esconde a barra após 3 segundos
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

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

  let relatorio = "📋 **RELATÓRIO DE EXONERAÇÃO - CORREGEDORIA PCERJ** 📋\n";
  relatorio += `📅 **DATA:** ${dataHoje}\n`;
  relatorio += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  exonerados.forEach((m) => {
    let partes = m.name.split(" | ");
    let nomeRP = partes[0] ? partes[0].trim() : m.name;
    let idRP = partes[1] ? partes[1].trim() : "---";

    relatorio += `🚔 **QRA:** <@${m.id}>\n`;
    relatorio += `👤 **NOME NO RP:** ${nomeRP}\n`;
    relatorio += `🆔 **ID:** ${idRP}\n`;
    relatorio += `📅 **DATA:** ${dataHoje}\n`;
    relatorio += `⚖️ **MOTIVO:** Inatividade\n`;
    relatorio += "────────────────────────────────\n";
  });

  navigator.clipboard.writeText(relatorio).then(() => {
    mostrarAviso("Relatório copiado para o Discord!");
  });
};
