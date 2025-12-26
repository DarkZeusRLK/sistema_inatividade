// =========================================================
// 1. SISTEMA DE NAVEGAÇÃO E CONTROLE DE INTERFACE
// =========================================================

function resetarTelas() {
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

  const gruposBotoes = ["botoes-inatividade", "botoes-core", "botoes-ferias"];
  gruposBotoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
}

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
  resetarTelas();
  const tela = document.getElementById("secao-gestao-ferias");
  if (tela) {
    tela.style.display = "block";
    tela.style.visibility = "visible";
  }
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS - COMANDO";
  document.getElementById("subtitulo-pagina").innerText =
    "Auditoria de Prazos e Retornos Antecipados";

  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

document.addEventListener("DOMContentLoaded", () => {
  window.abrirInatividade();
});

// =========================================================
// 2. ALERTAS PERSONALIZADOS
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
// 3. LOGICA DE INATIVIDADE (COM ANIMAÇÃO E EXIBIÇÃO DO BOTÃO)
// =========================================================
let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const corpo = document.getElementById("corpo-inatividade");
  const btnSinc = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar"); // Referência ao seu botão de copiar
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progPercent = document.getElementById("progress-percentage");
  const progLabel = document.getElementById("progress-label");

  if (!corpo) return;

  // Reset visual
  corpo.innerHTML = "";
  if (btnCopiar) btnCopiar.style.display = "none"; // Esconde o copiar enquanto carrega novo
  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "CONECTANDO AO DISCORD...";

  const originalTexto = btnSinc.innerHTML;
  btnSinc.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO...';
  btnSinc.disabled = true;

  // Animação de progresso fluida
  let width = 0;
  const interval = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 2;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";
    }
  }, 150);

  try {
    const res = await fetch("/api/membros-inativos");
    const dados = await res.json();
    listaMembrosAtual = dados;

    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "AUDITORIA FINALIZADA!";

    // Exibe o botão de copiar após carregar os dados
    if (btnCopiar) btnCopiar.style.display = "inline-block";

    dados.sort((a, b) => (a.lastMsg || 0) - (b.lastMsg || 0));
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

    dados.forEach((membro) => {
      let dataRef = Math.max(
        membro.lastMsg || 0,
        membro.joinedAt || 0,
        dataBaseAuditoria
      );
      const dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
      const statusExonerar = dias >= 7;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><div class="user-cell"><img src="${
          membro.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
        }" class="avatar-img"><strong>${membro.name}</strong></div></td>
        <td><code>${membro.id}</code></td>
        <td>${
          membro.lastMsg > 0
            ? new Date(membro.lastMsg).toLocaleDateString("pt-BR")
            : "---"
        }</td>
        <td><strong style="color: ${
          statusExonerar ? "#ff4d4d" : "#d4af37"
        }">${dias} Dias</strong></td>
        <td align="center"><span class="${
          statusExonerar ? "badge-danger" : "badge-success"
        }">${statusExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
      `;
      corpo.appendChild(tr);
    });
    mostrarAviso("Dados atualizados.");
  } catch (err) {
    clearInterval(interval);
    mostrarAviso("Erro na sincronização.", "error");
  } finally {
    btnSinc.innerHTML = originalTexto;
    btnSinc.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

// =========================================================
// 4. LÓGICA DE RELATÓRIO (FORMATO VERTICAL)
// =========================================================

window.copiarRelatorioDiscord = function () {
  if (listaMembrosAtual.length === 0)
    return mostrarAviso("Sincronize os dados primeiro.", "warning");

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

  // FORMATO VERTICAL
  const formatador = (membros) => {
    let texto = "";
    membros.forEach((m) => {
      let idRP = m.fullNickname?.split("|")[1]?.trim() || "---";
      texto += `QRA: <@${m.id}>\n`;
      texto += `NOME NA CIDADE: ${m.rpName || m.name}\n`;
      texto += `ID: ${idRP}\n`;
      texto += `DATA: ${dataHoje}\n`;
      texto += `MOTIVO: INATIVIDADE\n`;
      texto += `────────────────────────────────\n`;
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
      .then(() => mostrarAviso("Relatório copiado (Modelo Vertical)!"));
  } else {
    abrirModalDivisor(exonerados, dataHoje, cabecalho, formatador);
  }
};

function abrirModalDivisor(membros, data, header, formatador) {
  const container = document.getElementById("container-botoes-partes");
  container.innerHTML = "";
  const limit = 8; // Limite menor para mensagens verticais

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

window.fecharModalRelatorio = () =>
  (document.getElementById("modal-relatorio").style.display = "none");

// =========================================================
// 5. GESTÃO DE FÉRIAS
// =========================================================

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const logContainer = document.getElementById("status-ferias-info");
  if (!select) return;

  logContainer.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> Sincronizando dados de férias...';
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
        "<strong>Remoções Hoje:</strong><br>" +
        data.logs.map((l) => `✅ ${l}`).join("<br>");
    } else {
      logContainer.innerHTML =
        '<i class="fa-solid fa-check-double"></i> Tudo atualizado. Nenhuma tag pendente de remoção.';
    }
  } catch (e) {
    logContainer.innerHTML =
      '<span style="color:red">Erro ao carregar dados.</span>';
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
      window.atualizarListaFerias();
    }
  } catch (e) {
    mostrarAviso("Falha na comunicação.", "error");
  }
};
