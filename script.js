window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");

  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO (VASCULHANDO 200 MSGS)...';
  btn.disabled = true;

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    if (!Array.isArray(dados)) throw new Error("Resposta inválida");

    corpo.innerHTML = "";
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00"); // Sua data de início
    const msPorDia = 1000 * 60 * 60 * 24;

    dados.sort((a, b) => a.lastMsg - b.lastMsg);

    dados.forEach((membro) => {
      let dataReferencia;
      let nota = "";

      // Se o bot não achou mensagem nas 200 últimas de cada canal
      if (membro.lastMsg === 0) {
        dataReferencia = dataBaseAuditoria;
        nota =
          '<br><small style="color:#ce9178">Inativo desde o início (08/12)</small>';
      } else {
        dataReferencia = new Date(membro.lastMsg);
      }

      const diffMs = agora - dataReferencia;
      const diasInativo = Math.floor(diffMs / msPorDia);
      const statusExonerar = diasInativo >= 7;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>
                    <div class="user-cell">
                        <img src="${
                          membro.avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }" class="avatar-img">
                        <div>
                            <strong>${membro.name}</strong>
                            ${nota}
                        </div>
                    </div>
                </td>
                <td><code style="color:#888">${membro.id}</code></td>
                <td>${
                  membro.lastMsg === 0
                    ? "SEM MENSAGENS RECENTES"
                    : dataReferencia.toLocaleDateString("pt-BR")
                }</td>
                <td>
                    <strong style="color: ${
                      statusExonerar ? "#ff4d4d" : "#d4af37"
                    }">
                        ${diasInativo} Dias
                    </strong>
                </td>
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
  } catch (err) {
    console.error(err);
    alert("Erro ao sincronizar. Tente novamente em alguns segundos.");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
  }
};
document.addEventListener("DOMContentLoaded", function () {
  const sessionStr = localStorage.getItem("pc_session");
  if (sessionStr) {
    const session = JSON.parse(sessionStr);
    // Procure o elemento do nome no seu HTML e atualize
    const nomeElemento = document.getElementById("user-name");
    const avatarElemento = document.getElementById("user-avatar");

    if (nomeElemento) nomeElemento.textContent = session.nome;
    if (avatarElemento) avatarElemento.src = session.avatar;
  }
});
// Variável global para armazenar os membros após carregar
let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar"); // Botão de cópia

  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO...';
  btn.disabled = true;

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    if (!Array.isArray(dados)) throw new Error("Erro");

    listaMembrosAtual = dados; // Salva na global
    corpo.innerHTML = "";
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

    dados.sort((a, b) => a.lastMsg - b.lastMsg);

    dados.forEach((membro) => {
      let dataReferencia =
        membro.lastMsg < dataBaseAuditoria
          ? new Date(dataBaseAuditoria)
          : new Date(membro.lastMsg);
      const dias = Math.floor((agora - dataReferencia) / (1000 * 60 * 60 * 24));
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
                    ? "SEM REGISTRO"
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

    // Mostra o botão de copiar se houver dados
    btnCopiar.style.display = "inline-block";
  } catch (err) {
    alert("Erro ao sincronizar dados.");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
  }
};

// FUNÇÃO PARA GERAR O RELATÓRIO BONITO
window.copiarRelatorioDiscord = function () {
  if (listaMembrosAtual.length === 0) return;

  const agora = new Date();
  const dataHoje = agora.toLocaleDateString("pt-BR");
  const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

  // Filtrar apenas quem deve ser exonerado (>= 7 dias)
  const exonerados = listaMembrosAtual.filter((m) => {
    let dataRef = m.lastMsg < dataBaseAuditoria ? dataBaseAuditoria : m.lastMsg;
    let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
    return dias >= 7;
  });

  if (exonerados.length === 0) {
    alert("Nenhum oficial identificado para exoneração no momento.");
    return;
  }

  let relatorio = "📋 **RELATÓRIO DE EXONERAÇÃO - CORREGEDORIA PCERJ** 📋\n";
  relatorio += `📅 **DATA:** ${dataHoje}\n`;
  relatorio += "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

  exonerados.forEach((m) => {
    // Separar Nome e ID (Exemplo: ALN PCERJ CHARLIE | 722)
    let partes = m.name.split(" | ");
    let nomeRP = partes[0] ? partes[0].trim() : m.name;
    let idRP = partes[1] ? partes[1].trim() : "Não informado";

    relatorio += `🚔 **QRA:** <@${m.id}>\n`;
    relatorio += `👤 **NOME NO RP:** ${nomeRP}\n`;
    relatorio += `🆔 **ID:** ${idRP}\n`;
    relatorio += `📅 **DATA:** ${dataHoje}\n`;
    relatorio += `⚖️ **MOTIVO:** Inatividade\n`;
    relatorio += "────────────────────────────────\n";
  });

  relatorio +=
    "\n⚠️ *Oficiais citados devem entrar em contato com a Corregedoria para devolução de armamento e fardamento.*";

  // Copiar para o teclado
  navigator.clipboard.writeText(relatorio).then(() => {
    alert(
      "✅ Relatório copiado! Agora é só colar (CTRL+V) no canal do Discord."
    );
  });
};
