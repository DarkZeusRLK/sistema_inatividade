// =========================================================
// 1. SISTEMA DE NAVEGAÇÃO (CORREÇÃO DEFINITIVA DE SOBREPOSIÇÃO)
// =========================================================

function resetarTelas() {
  // 1. Esconder todas as seções
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-gestao-ferias",
  ];
  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });

  // 2. Esconder todos os grupos de botões do topo
  const gruposBotoes = ["botoes-inatividade", "botoes-core", "botoes-ferias"];
  gruposBotoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // 3. LIMPEZA TOTAL DA NAVBAR (CORREÇÃO DO PROBLEMA VISUAL)
  // Removemos a classe 'active' de TODOS os itens, sem exceção
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
}

// Funções de ativação de aba
window.abrirInatividade = function () {
  resetarTelas();
  const tela = document.getElementById("secao-inatividade");
  if (tela) {
    tela.style.display = "block";
    tela.style.visibility = "visible";
  }
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");

  document.getElementById("titulo-pagina").innerText =
    "SISTEMA DE AUDITORIA DE ATIVIDADE";
  document.getElementById("subtitulo-pagina").innerText =
    "Controle de Presença em Canais Oficiais";
};

window.abrirMetaCore = function () {
  resetarTelas();
  const tela = document.getElementById("secao-meta-core");
  if (tela) {
    tela.style.display = "block";
    tela.style.visibility = "visible";
  }
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");

  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - CORE";
  document.getElementById("subtitulo-pagina").innerText =
    "Contabilização de Metas e Produtividade";
};

window.abrirGestaoFerias = function () {
  resetarTelas(); // Limpa tudo, inclusive o dourado dos outros
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("botoes-ferias").style.display = "block";

  // Marca o item atual como ativo
  document.getElementById("nav-ferias").classList.add("active");

  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS - COMANDO";
  document.getElementById("subtitulo-pagina").innerText =
    "Auditoria de Prazos e Retornos Antecipados";

  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

// Forçar abertura da tela inicial ao carregar a página
document.addEventListener("DOMContentLoaded", () => {
  window.abrirInatividade();
});

// =========================================================
// 2. SISTEMA DE ALERTAS PERSONALIZADOS
// =========================================================
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

  alert.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${mensagem}</span>`;
  container.appendChild(alert);

  setTimeout(() => {
    alert.classList.add("fade-out");
    setTimeout(() => alert.remove(), 500);
  }, 4000);
}

// =========================================================
// 3. SINCRONIZAÇÃO E BARRA DE PROGRESSO (INATIVIDADE)
// =========================================================
let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progLabel = document.getElementById("progress-label");
  const progPercent = document.getElementById("progress-percentage");

  if (!corpo) return;

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "CONECTANDO AO DISCORD...";

  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PROCESSANDO...';
  btn.disabled = true;

  let width = 0;
  const interval = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 2;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";
    }
  }, 200);

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();

    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "AUDITORIA FINALIZADA!";

    listaMembrosAtual = dados;
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();
    const msPorDia = 1000 * 60 * 60 * 24;

    dados.sort((a, b) => (a.lastMsg || 0) - (b.lastMsg || 0));

    dados.forEach((membro) => {
      let dataReferenciaReal = Math.max(
        membro.lastMsg || 0,
        membro.joinedAt || 0,
        dataBaseAuditoria
      );
      const dias = Math.floor((agora - dataReferenciaReal) / msPorDia);
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
                  membro.lastMsg > 0
                    ? new Date(membro.lastMsg).toLocaleDateString("pt-BR")
                    : "---"
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
    mostrarAviso("Sincronização concluída.");
  } catch (err) {
    clearInterval(interval);
    mostrarAviso("Erro ao buscar dados.", "error");
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> SINCRONIZAR DADOS';
    btn.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

// =========================================================
// 4. LÓGICA DE RELATÓRIOS E FÉRIAS
// =========================================================

window.copiarRelatorioDiscord = function () {
  if (listaMembrosAtual.length === 0) return;
  const agora = new Date();
  const dataHoje = agora.toLocaleDateString("pt-BR");
  const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

  const exonerados = listaMembrosAtual.filter((m) => {
    let dataRef = Math.max(m.lastMsg || 0, m.joinedAt || 0, dataBaseAuditoria);
    let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
    return dias >= 7;
  });

  if (exonerados.length === 0)
    return mostrarAviso("Nenhum oficial identificado.", "error");

  const formatador = (membros) => {
    let texto = "";
    membros.forEach((m) => {
      let idRP = m.fullNickname?.split("|")[1]?.trim() || "---";
      texto += `QRA: <@${m.id}>\nNOME NA CIDADE: ${
        m.rpName || m.name
      }\nID: ${idRP}\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────\n`;
    });
    return texto;
  };

  let cabecalho =
    "📋 **RELATÓRIO DE EXONERAÇÃO - ADMINISTRAÇÃO PCERJ** 📋\n📅 **DATA:** " +
    dataHoje +
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
  let relatorio = cabecalho + formatador(exonerados);

  if (relatorio.length <= 1900) {
    navigator.clipboard
      .writeText(relatorio)
      .then(() => mostrarAviso("Relatório copiado!"));
  } else {
    abrirModalDivisor(exonerados, dataHoje, cabecalho, formatador);
  }
};

function abrirModalDivisor(membros, data, header, formatador) {
  const container = document.getElementById("container-botoes-partes");
  container.innerHTML = "";
  const limit = 10;

  for (let i = 0; i < membros.length; i += limit) {
    const bloco = membros.slice(i, i + limit);
    const parte = Math.floor(i / limit) + 1;
    const btn = document.createElement("button");
    btn.className = "btn-parte";
    btn.innerHTML = `<i class="fa-solid fa-copy"></i> PARTE ${parte}`;
    btn.onclick = () => {
      navigator.clipboard.writeText(
        header + `(PARTE ${parte})\n\n` + formatador(bloco)
      );
      mostrarAviso(`Parte ${parte} copiada!`);
    };
    container.appendChild(btn);
  }
  document.getElementById("modal-relatorio").style.display = "flex";
}

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const logContainer = document.getElementById("status-ferias-info");
  if (!select) return;

  select.innerHTML = '<option value="">⏳ Sincronizando...</option>';

  try {
    const res = await fetch("/api/verificar-ferias");
    const data = await res.json();
    select.innerHTML = '<option value="">Selecione para antecipar...</option>';

    if (data.oficiais.length === 0) {
      select.innerHTML = '<option value="">Nenhum oficial em férias.</option>';
    } else {
      data.oficiais.forEach((oficial) => {
        const opt = document.createElement("option");
        opt.value = oficial.id;
        opt.textContent = `🌴 ${oficial.nome} (Até: ${oficial.dataRetorno})`;
        select.appendChild(opt);
      });
    }

    if (data.logs?.length > 0) {
      logContainer.innerHTML =
        "<strong>Remoções:</strong><br>" +
        data.logs.map((l) => `✅ ${l}`).join("<br>");
    }
  } catch (e) {
    select.innerHTML = '<option value="">Erro ao carregar.</option>';
  }
};

window.executarAntecipacao = async function () {
  const userId = document.getElementById("select-oficiais-ferias").value;
  if (!userId) return mostrarAviso("Selecione um oficial.", "warning");
  if (!confirm("Confirmar retorno antecipado?")) return;

  try {
    const res = await fetch("/api/verificar-ferias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      mostrarAviso("Férias antecipadas!");
      atualizarListaFerias();
    }
  } catch (e) {
    mostrarAviso("Falha na comunicação.", "error");
  }
};

window.fecharModalRelatorio = () =>
  (document.getElementById("modal-relatorio").style.display = "none");
