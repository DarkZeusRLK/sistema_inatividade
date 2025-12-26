// =========================================================
// 1. UTILITÁRIOS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  if (!sessionStr) return { org: "PCERJ" }; // Fallback
  return JSON.parse(sessionStr);
};

// Mapeamento de rótulos por organização
const getOrgLabel = (org) => {
  const labels = {
    PCERJ: { unidade: "CORE", nome: "PCERJ" },
    PRF: { unidade: "GRR", nome: "PRF" },
    PMERJ: { unidade: "BOPE", nome: "PMERJ" },
  };
  return labels[org] || labels["PCERJ"];
};

window.fazerLogout = function () {
  if (confirm("Deseja realmente encerrar sua sessão no painel?")) {
    localStorage.removeItem("pc_session");
    window.location.href = "login.html";
  }
};

// =========================================================
// 2. SISTEMA DE PERMISSÕES (RESTRITIVO)
// =========================================================

function aplicarRestricoes() {
  const { org } = obterSessao();

  // IDs dos itens da Navbar para cada org
  const permissoes = {
    PCERJ: {
      mostrar: ["nav-core", "nav-porte", "nav-admin"], // Somente PCERJ vê Porte
      esconder: ["nav-grr", "nav-bope"],
    },
    PRF: {
      mostrar: ["nav-grr"],
      esconder: ["nav-core", "nav-bope", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope"],
      esconder: ["nav-core", "nav-grr", "nav-porte", "nav-admin"],
    },
  };

  const config = permissoes[org] || permissoes["PCERJ"];

  // Esconde o que não pertence à org
  config.esconder.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  // Mostra o que pertence à org
  config.mostrar.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "flex";
  });
}

// =========================================================
// 3. CONTROLE DE INTERFACE E NAVEGAÇÃO
// =========================================================

function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
    "secao-porte-armas",
  ];

  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });

  const gruposBotoes = [
    "botoes-inatividade",
    "botoes-core",
    "botoes-grr",
    "botoes-bope",
    "botoes-ferias",
  ];
  gruposBotoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.remove("active");
  });
}

window.abrirInatividade = function () {
  const { org } = obterSessao();
  const label = getOrgLabel(org);
  resetarTelas();

  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");

  document.getElementById(
    "titulo-pagina"
  ).innerText = `AUDITORIA - ${label.nome}`;
  document.getElementById("subtitulo-pagina").innerText =
    "Controle de Presença em Canais Oficiais";
};

// Funções de abertura de metas (específicas)
window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("secao-meta-grr").style.visibility = "visible";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
};

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("secao-meta-bope").style.visibility = "visible";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
};

window.abrirPorte = function () {
  const { org } = obterSessao();
  if (org !== "PCERJ") return; // Proteção extra
  resetarTelas();
  document.getElementById("secao-porte-armas").style.display = "block";
  document.getElementById("secao-porte-armas").style.visibility = "visible";
  document.getElementById("nav-porte").classList.add("active");
};

document.addEventListener("DOMContentLoaded", () => {
  aplicarRestricoes();
  window.abrirInatividade();
});

// =========================================================
// 4. LOGICA DE INATIVIDADE (SUA ANIMAÇÃO PRESERVADA)
// =========================================================

window.carregarInatividade = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progPercent = document.getElementById("progress-percentage");
  const progLabel = document.getElementById("progress-label");

  if (!corpo) return;

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  progBar.style.width = "0%";
  progPercent.innerText = "0%";
  progLabel.innerText = "CONECTANDO AO DISCORD...";

  const originalTexto = btn.innerHTML;
  btn.innerHTML =
    '<i class="fa-solid fa-spinner fa-spin"></i> SINCRONIZANDO...';
  btn.disabled = true;

  let width = 0;
  const interval = setInterval(() => {
    if (width < 90) {
      width += Math.random() * 2;
      progBar.style.width = width + "%";
      progPercent.innerText = Math.floor(width) + "%";
    }
  }, 150);

  try {
    // Busca os dados filtrados pela ORG na API
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    const dados = await res.json();
    dadosInatividadeGlobal = dados;

    clearInterval(interval);
    progBar.style.width = "100%";
    progPercent.innerText = "100%";
    progLabel.innerText = "AUDITORIA FINALIZADA!";

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
    btn.innerHTML = originalTexto;
    btn.disabled = false;
    setTimeout(() => {
      progContainer.style.display = "none";
    }, 3000);
  }
};

// =========================================================
// 5. CÓPIA DE RELATÓRIO DINÂMICO
// =========================================================

window.copiarRelatorioDiscord = function () {
  const { org } = obterSessao();
  const label = getOrgLabel(org);

  if (dadosInatividadeGlobal.length === 0)
    return mostrarAviso("Sincronize os dados primeiro.", "warning");

  const agora = new Date();
  const dataHoje = agora.toLocaleDateString("pt-BR");
  const dataBaseAuditoria = new Date("2025-12-08T00:00:00").getTime();

  const exonerados = dadosInatividadeGlobal.filter((m) => {
    let dataRef = Math.max(m.lastMsg || 0, m.joinedAt || 0, dataBaseAuditoria);
    let dias = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
    return dias >= 7;
  });

  if (exonerados.length === 0)
    return mostrarAviso(
      "Nenhum oficial identificado para exoneração.",
      "error"
    );

  const formatador = (membros) => {
    let texto = "";
    membros.forEach((m) => {
      texto += `QRA: <@${m.id}>\nNOME NA CIDADE: ${m.rpName || m.name}\nID: ${
        m.id
      }\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────\n`;
    });
    return texto;
  };

  let cabecalho = `📋 **RELATÓRIO DE EXONERAÇÃO - ${label.nome}** 📋\n📅 **DATA:** ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  let relatorio = cabecalho + formatador(exonerados);

  // Lógica de envio/cópia
  if (relatorio.length <= 1900) {
    navigator.clipboard
      .writeText(relatorio)
      .then(() => mostrarAviso("Relatório copiado!"));
  } else {
    abrirModalDivisor(exonerados, dataHoje, cabecalho, formatador);
  }
};

// ... Restante das funções (Férias, Modal Divisor, mostrarAviso) permanecem iguais ...

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

window.fecharModalRelatorio = () =>
  (document.getElementById("modal-relatorio").style.display = "none");

// =========================================================
// 5. GESTÃO DE FÉRIAS
// =========================================================

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const logContainer = document.getElementById("status-ferias-info");
  if (!select) return;

  // Feedback visual de carregamento nos Logs
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
