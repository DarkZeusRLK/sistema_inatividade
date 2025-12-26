// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = []; // Armazena os dados para o relatório
const DATA_BASE_AUDITORIA = new Date("2025-12-08T00:00:00").getTime();

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  if (!sessionStr) return { org: "PCERJ", tema: "tema-pcerj" };
  return JSON.parse(sessionStr);
};

const getOrgConfig = (org) => {
  const configs = {
    PCERJ: {
      nome: "PCERJ",
      unidade: "CORE",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    },
    PRF: {
      nome: "PRF",
      unidade: "GRR",
      logo: "Imagens/PRF_new.png", // Nome corrigido
    },
    PMERJ: {
      nome: "PMERJ",
      unidade: "BOPE",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png", // Nome corrigido
    },
  };
  return configs[org] || configs["PCERJ"];
};

function mostrarAviso(msg, tipo = "success") {
  const toast = document.createElement("div");
  toast.className = `toast-aviso ${tipo}`;
  toast.innerHTML = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}

// =========================================================
// 2. SISTEMA DE PERMISSÕES E INTERFACE
// =========================================================

function aplicarRestricoes() {
  const { org } = obterSessao();
  const config = getOrgConfig(org);

  // Atualiza Logo Dinamicamente
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = config.logo;

  const permissoes = {
    PCERJ: {
      mostrar: ["nav-core", "nav-porte", "nav-admin", "nav-ferias"],
      esconder: ["nav-grr", "nav-bope"],
    },
    PRF: {
      mostrar: ["nav-grr", "nav-ferias"],
      esconder: ["nav-core", "nav-bope", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope", "nav-ferias"],
      esconder: ["nav-core", "nav-grr", "nav-porte", "nav-admin"],
    },
  };

  const p = permissoes[org] || permissoes["PCERJ"];
  p.esconder.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });
  p.mostrar.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "flex";
  });
}

function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
  ];
  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });

  const botoes = [
    "botoes-inatividade",
    "botoes-core",
    "botoes-grr",
    "botoes-bope",
    "botoes-ferias",
  ];
  botoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
}

// =========================================================
// 3. NAVEGAÇÃO
// =========================================================

window.abrirInatividade = function () {
  const { org } = obterSessao();
  const config = getOrgConfig(org);
  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `AUDITORIA - ${config.nome}`;
};

window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "GESTÃO DE FÉRIAS";
  window.atualizarListaFerias(); // Carrega filtrado
};

// Funções de Metas (Simplificadas)
window.abrirMetaCore = () => {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
};
window.abrirMetaGRR = () => {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("secao-meta-grr").style.visibility = "visible";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
};
window.abrirMetaBOPE = () => {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("secao-meta-bope").style.visibility = "visible";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
};

// =========================================================
// 4. LÓGICA DE INATIVIDADE E RELATÓRIO
// =========================================================

window.carregarInatividade = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btnSinc = document.getElementById("btn-sincronizar");
  const btnCopiar = document.getElementById("btn-copiar");
  const progBar = document.getElementById("progress-bar");
  const progContainer = document.getElementById("progress-container");

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  btnSinc.disabled = true;

  try {
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    const dados = await res.json();
    dadosInatividadeGlobal = dados; // Salva globalmente

    const agora = Date.now();
    dados.forEach((m) => {
      let dataRef = Math.max(
        m.lastMsg || 0,
        m.joinedAt || 0,
        DATA_BASE_AUDITORIA
      );
      m.diasInatividade = Math.floor((agora - dataRef) / (1000 * 60 * 60 * 24));
      m.precisaExonerar = m.diasInatividade >= 7;

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
        <td style="color: ${m.precisaExonerar ? "#ff4d4d" : "#d4af37"}">${
        m.diasInatividade
      } Dias</td>
        <td align="center"><span class="${
          m.precisaExonerar ? "badge-danger" : "badge-success"
        }">${m.precisaExonerar ? "⚠️ EXONERAR" : "✅ REGULAR"}</span></td>
      `;
      corpo.appendChild(tr);
    });

    if (dados.length > 0) btnCopiar.style.display = "inline-block";
    mostrarAviso("Sincronização concluída!");
  } catch (err) {
    mostrarAviso("Erro na sincronização.", "error");
  } finally {
    btnSinc.disabled = false;
    progContainer.style.display = "none";
  }
};

window.copiarRelatorioDiscord = function () {
  const { org } = obterSessao();
  const config = getOrgConfig(org);
  const dataHoje = new Date().toLocaleDateString("pt-BR");

  const exonerados = dadosInatividadeGlobal.filter((m) => m.precisaExonerar);

  if (exonerados.length === 0)
    return mostrarAviso("Nenhum oficial para exonerar!", "warning");

  const formatador = (lista) => {
    return lista
      .map(
        (m) =>
          `QRA: <@${m.id}>\nNOME: ${m.rpName || m.name}\nID: ${
            m.id
          }\nDATA: ${dataHoje}\nMOTIVO: INATIVIDADE\n────────────────────────────────`
      )
      .join("\n");
  };

  const cabecalho = `📋 **RELATÓRIO DE EXONERAÇÃO - ${config.nome}** 📋\n📅 DATA: ${dataHoje}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  const relatorioCompleto = cabecalho + formatador(exonerados);

  if (relatorioCompleto.length <= 1900) {
    navigator.clipboard
      .writeText(relatorioCompleto)
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

window.fecharModalRelatorio = () =>
  (document.getElementById("modal-relatorio").style.display = "none");

// =========================================================
// 5. GESTÃO DE FÉRIAS (FILTRADO POR ORGANIZAÇÃO)
// =========================================================

window.atualizarListaFerias = async function () {
  const { org } = obterSessao();
  const select = document.getElementById("select-oficiais-ferias");
  const logContainer = document.getElementById("status-ferias-info");

  if (!select) return;
  select.innerHTML = '<option value="">⏳ Carregando oficiais...</option>';

  try {
    const res = await fetch(`/api/verificar-ferias?org=${org}`);
    const data = await res.json();

    select.innerHTML = '<option value="">Selecione para antecipar...</option>';

    if (data.oficiais && data.oficiais.length > 0) {
      data.oficiais.forEach((oficial) => {
        const opt = document.createElement("option");
        opt.value = oficial.id;
        opt.textContent = `🌴 ${oficial.nome} (Até: ${oficial.dataRetorno})`;
        select.appendChild(opt);
      });
    } else {
      select.innerHTML = '<option value="">Nenhum oficial em férias.</option>';
    }

    logContainer.innerHTML =
      data.logs?.length > 0
        ? data.logs.map((l) => `✅ ${l}`).join("<br>")
        : "Nenhum retorno pendente hoje.";
  } catch (e) {
    mostrarAviso("Erro ao buscar férias.", "error");
  }
};

window.executarAntecipacao = async function () {
  const userId = document.getElementById("select-oficiais-ferias").value;
  if (!userId) return mostrarAviso("Selecione um oficial.", "warning");

  try {
    const res = await fetch("/api/verificar-ferias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      mostrarAviso("Retorno antecipado com sucesso!");
      window.atualizarListaFerias();
    }
  } catch (e) {
    mostrarAviso("Erro ao processar antecipação.", "error");
  }
};

// =========================================================
// 6. INICIALIZAÇÃO
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  aplicarRestricoes();
  window.abrirInatividade();
});
