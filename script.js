// =========================================================
// 1. CONFIGURAÇÕES, SESSÃO E UTILITÁRIOS
// =========================================================

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  return sessionStr ? JSON.parse(sessionStr) : null;
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

window.fazerLogout = function () {
  if (confirm("Deseja realmente encerrar sua sessão?")) {
    localStorage.removeItem("pc_session");
    window.location.href = "login.html";
  }
};

// =========================================================
// 2. NAVEGAÇÃO ENTRE TELAS
// =========================================================

function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
  ];
  const gruposBotoes = [
    "botoes-inatividade",
    "botoes-core",
    "botoes-grr",
    "botoes-bope",
    "botoes-ferias",
  ];

  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });

  gruposBotoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
}

window.abrirInatividade = function () {
  const sessao = obterSessao();
  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `AUDITORIA DE ATIVIDADE - ${sessao.org}`;
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("secao-meta-grr").style.visibility = "visible";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - GRR";
};

// ... Repita o padrão acima para abrirMetaCore, abrirMetaBOPE e abrirGestaoFerias

// =========================================================
// 3. AUDITORIA E PROGRESSO
// =========================================================

let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const sessao = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progLabel = document.getElementById("progress-label");
  const progPerc = document.getElementById("progress-percentage");
  const btnSinc = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");

  if (!corpo) return;

  btnSinc.disabled = true;
  progContainer.style.display = "block";
  corpo.innerHTML =
    '<tr><td colspan="5" align="center" style="padding:40px; color:#888;">Iniciando auditoria...</td></tr>';

  const updateProgress = (text, percent) => {
    progLabel.innerText = text.toUpperCase();
    progBar.style.width = percent + "%";
    progPerc.innerText = percent + "%";
  };

  try {
    updateProgress("conectando ao discord", 15);
    await delay(800);

    updateProgress("verificando lista de oficaiis ausentes", 45);
    const res = await fetch(`/api/membros-inativos?org=${sessao.org}`);
    const dados = await res.json();
    listaMembrosAtual = dados;
    await delay(700);

    updateProgress("filtrando férias...", 80);
    await delay(800);

    updateProgress("finalizando auditoria", 100);
    await delay(500);

    corpo.innerHTML = "";
    btnCopiar.style.display = "inline-block";

    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

    dados.sort((a, b) => (a.lastMsg || 0) - (b.lastMsg || 0));

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
          statusExonerar ? "#ff4d4d" : "var(--gold)"
        }">${dias} Dias</strong></td>
        <td align="center"><span class="${
          statusExonerar ? "badge-danger" : "badge-success"
        }">${statusExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
      `;
      corpo.appendChild(tr);
    });

    mostrarAviso("Sincronização concluída!");
  } catch (err) {
    mostrarAviso("Erro na sincronização.", "error");
    corpo.innerHTML =
      '<tr><td colspan="5" align="center" style="color:red;">Falha ao obter dados.</td></tr>';
  } finally {
    btnSinc.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

// =========================================================
// 4. FUNÇÃO DE CÓPIA (CORRIGIDA)
// =========================================================

// Função universal de cópia para evitar erros de permissão do navegador
async function copiarParaAreaTransferencia(texto) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(texto);
      return true;
    } catch (err) {
      console.error("Falha na API clipboard:", err);
    }
  }

  // Fallback para navegadores que bloqueiam a API ou contextos não seguros (HTTP)
  const textArea = document.createElement("textarea");
  textArea.value = texto;
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  const sucesso = document.execCommand("copy");
  document.body.removeChild(textArea);
  return sucesso;
}

window.copiarRelatorioDiscord = function () {
  const sessao = obterSessao();
  if (listaMembrosAtual.length === 0)
    return mostrarAviso("Sincronize os dados primeiro.", "warning");

  const agora = new Date();
  const dataHoje = agora.toLocaleDateString("pt-BR");
  const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

  const exonerados = listaMembrosAtual.filter((m) => {
    let dataRef = Math.max(m.lastMsg || 0, m.joinedAt || 0, dataBaseAuditoria);
    return Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24)) >= 7;
  });

  if (exonerados.length === 0)
    return mostrarAviso("Ninguém identificado para exoneração.", "success");

  const formatador = (membros) => {
    return membros
      .map((m) => {
        let idRP = m.fullNickname?.split("|")[1]?.trim() || "---";
        return `QRA: <@${m.id}>\nNOME NA CIDADE: ${
          m.rpName || m.name
        }\nID: ${idRP}\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────`;
      })
      .join("\n");
  };

  let cabecalho = `📋 **RELATÓRIO DE EXONERAÇÃO - ${sessao.org}** 📋\n📅 **DATA:** ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  let relatorioCompleto = cabecalho + formatador(exonerados);

  if (relatorioCompleto.length <= 1900) {
    copiarParaAreaTransferencia(relatorioCompleto).then((sucesso) => {
      if (sucesso) mostrarAviso("Relatório copiado!");
    });
  } else {
    abrirModalDivisor(exonerados, dataHoje, cabecalho, formatador);
  }
};

// =========================================================
// 5. MODAL E UTILITÁRIOS
// =========================================================

function abrirModalDivisor(membros, data, header, formatador) {
  const container = document.getElementById("container-botoes-partes");
  container.innerHTML = "";
  const limit = 6; // Reduzido para garantir que caiba no Discord
  for (let i = 0; i < membros.length; i += limit) {
    const bloco = membros.slice(i, i + limit);
    const parte = Math.floor(i / limit) + 1;
    const btn = document.createElement("button");
    btn.className = "btn-parte";
    btn.innerHTML = `<i class="fa-solid fa-copy"></i> PARTE ${parte}`;
    btn.onclick = () => {
      const textoParte = header + `(PARTE ${parte})\n\n` + formatador(bloco);
      copiarParaAreaTransferencia(textoParte).then(() =>
        mostrarAviso(`Parte ${parte} copiada!`)
      );
    };
    container.appendChild(btn);
  }
  document.getElementById("modal-relatorio").style.display = "flex";
}

window.fecharModalRelatorio = () =>
  (document.getElementById("modal-relatorio").style.display = "none");

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
