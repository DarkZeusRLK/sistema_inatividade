// =========================================================
// 1. UTILITÁRIOS E SESSÃO
// =========================================================

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  return sessionStr
    ? JSON.parse(sessionStr)
    : { org: "PCERJ", tema: "tema-pcerj" };
};

const getOrgLabel = (org) => {
  const labels = {
    PCERJ: { unidade: "CORE", nome: "PCERJ" },
    PRF: { unidade: "GRR", nome: "PRF" },
    PMERJ: { unidade: "BOPE", nome: "PMERJ" },
  };
  return labels[org] || labels["PCERJ"];
};

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// =========================================================
// 2. NAVEGAÇÃO E INTERFACE
// =========================================================

function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
  ];
  const botoes = [
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

  botoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));
}

window.abrirInatividade = function () {
  const { org } = obterSessao();
  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `SISTEMA DE AUDITORIA - ${org}`;
};

window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - CORE";
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

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("secao-meta-bope").style.visibility = "visible";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "RELATÓRIO OPERACIONAL - BOPE";
};

window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS - COMANDO";
  if (window.atualizarListaFerias) window.atualizarListaFerias();
};

// =========================================================
// 3. AUDITORIA E BARRA DE PROGRESSO
// =========================================================

let listaMembrosAtual = [];

window.carregarInatividade = async function () {
  const { org } = obterSessao();
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
    '<tr><td colspan="5" align="center" style="padding: 40px; color: #888;">Processando auditoria...</td></tr>';

  const atualizar = (texto, porcentagem) => {
    progLabel.innerText = texto.toUpperCase();
    progBar.style.width = porcentagem + "%";
    progPerc.innerText = porcentagem + "%";
  };

  try {
    // ETAPA 1
    atualizar("conectando ao discord...", 15);
    await delay(900);

    // ETAPA 2
    atualizar("verificando lista de oficaiis ausentes...", 40);
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    const dados = await res.json();
    listaMembrosAtual = dados;
    await delay(700);

    // ETAPA 3
    atualizar("filtrando férias...", 75);
    await delay(800);

    // ETAPA 4
    atualizar("finalizando auditoria.", 100);
    await delay(500);

    corpo.innerHTML = "";
    btnCopiar.style.display = "inline-block";

    dados.sort((a, b) => (a.lastMsg || 0) - (b.lastMsg || 0));
    const agora = new Date();
    const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

    dados.forEach((m) => {
      let dataRef = Math.max(
        m.lastMsg || 0,
        m.joinedAt || 0,
        dataBaseAuditoria
      );
      const dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
      const exonerar = dias >= 7;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td><div class="user-cell"><img src="${
                  m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
                }" class="avatar-img"><strong>${m.name}</strong></div></td>
                <td><code>${m.id}</code></td>
                <td>${
                  m.lastMsg > 0
                    ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
                    : "---"
                }</td>
                <td><strong style="color: ${
                  exonerar ? "#ff4d4d" : "var(--gold)"
                }">${dias} Dias</strong></td>
                <td align="center"><span class="${
                  exonerar ? "badge-danger" : "badge-success"
                }">${exonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
            `;
      corpo.appendChild(tr);
    });

    mostrarAviso("Auditoria finalizada com sucesso!");
  } catch (err) {
    console.error(err);
    mostrarAviso("Erro ao conectar com a API.", "error");
  } finally {
    btnSinc.disabled = false;
    setTimeout(() => (progContainer.style.display = "none"), 3000);
  }
};

// =========================================================
// 4. SISTEMA DE CÓPIA E RELATÓRIO
// =========================================================

window.copiarRelatorioDiscord = function () {
  const { org } = obterSessao();
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
    return mostrarAviso(
      "Nenhum oficial identificado para exoneração.",
      "success"
    );

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

  let cabecalho = `📋 **RELATÓRIO DE EXONERAÇÃO - ${org}** 📋\n📅 **DATA:** ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  let textoFinal = cabecalho + formatador(exonerados);

  if (textoFinal.length <= 1900) {
    copyToClipboard(textoFinal);
  } else {
    abrirModalDivisor(exonerados, dataHoje, cabecalho, formatador);
  }
};

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    mostrarAviso("Relatório copiado para a área de transferência!");
  } catch (err) {
    // Fallback para navegadores que bloqueiam clipboard sem HTTPS
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    mostrarAviso("Relatório copiado! (Fallback)");
  }
}

function abrirModalDivisor(membros, data, header, formatador) {
  const container = document.getElementById("container-botoes-partes");
  container.innerHTML = "";
  const limit = 8;
  for (let i = 0; i < membros.length; i += limit) {
    const bloco = membros.slice(i, i + limit);
    const parte = Math.floor(i / limit) + 1;
    const btn = document.createElement("button");
    btn.className = "btn-parte";
    btn.innerHTML = `<i class="fa-solid fa-copy"></i> PARTE ${parte}`;
    btn.onclick = () => {
      copyToClipboard(header + `(PARTE ${parte})\n\n` + formatador(bloco));
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
