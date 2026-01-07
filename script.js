// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];

const CARGOS_PROTEGIDOS = [
  "Delegado PCERJ",
  "Delegado Adj. PCERJ",
  "Comando CGPC",
  "Comando SAER",
  "Comando GEM",
  "Comando CORE",
  "Coordenador Civil",
];

const DATA_BASE_AUDITORIA = new Date("2024-12-08T00:00:00").getTime();

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  if (!sessionStr) {
    if (!window.location.pathname.includes("login.html"))
      window.location.href = "login.html";
    return null;
  }
  const sessao = JSON.parse(sessionStr);
  if (sessao.expira && Date.now() > sessao.expira) {
    localStorage.removeItem("pc_session");
    window.location.href = "login.html";
    return null;
  }
  return sessao;
};

const getOrgLabel = (org) => {
  const labels = {
    PCERJ: {
      nome: "PCERJ",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    },
    PRF: { nome: "PRF", logo: "Imagens/PRF_new.png" },
    PMERJ: {
      nome: "PMERJ",
      logo: "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    },
  };
  return (
    labels[org] || {
      nome: "SISTEMA",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    }
  );
};

function atualizarIdentidadeVisual(org) {
  const info = getOrgLabel(org);
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = info.logo;

  let favicon =
    document.querySelector("link[rel~='icon']") ||
    document.createElement("link");
  favicon.rel = "icon";
  favicon.href = info.logo;
  document.getElementsByTagName("head")[0].appendChild(favicon);
}

window.mostrarAviso = function (msg, tipo = "success") {
  const aviso = document.getElementById("aviso-global");
  if (!aviso) {
    alert(msg);
    return;
  }
  aviso.innerText = msg;
  aviso.className = `aviso-toast ${tipo}`;
  aviso.style.display = "block";
  setTimeout(() => {
    aviso.style.display = "none";
  }, 4000);
};

// =========================================================
// 2. NAVEGAÇÃO E TELAS
// =========================================================
function resetarTelas() {
  const secoes = [
    "secao-inatividade",
    "secao-meta-core",
    "secao-meta-grr",
    "secao-meta-bope",
    "secao-gestao-ferias",
    "secao-ensino",
  ];
  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });
  document
    .querySelectorAll('[id^="botoes-"]')
    .forEach((el) => (el.style.display = "none"));
  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
}

window.abrirInatividade = function () {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;
  resetarTelas();
  const secao = document.getElementById("secao-inatividade");
  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible";
  }
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById("titulo-pagina").innerText = `AUDITORIA - ${
    getOrgLabel(sessao.org).nome
  }`;
};

// =========================================================
// 3. LÓGICA DE SINCRONIZAÇÃO (BARRA DE PROGRESSO REAL)
// =========================================================
window.carregarInatividade = async function () {
  const sessao = obterSessao();
  if (!sessao) return;

  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");
  const barra = progContainer
    ? progContainer.querySelector(".progress-bar")
    : null;

  if (!corpo) return;

  // Reset e Início
  corpo.innerHTML =
    '<tr><td colspan="6" align="center">🔍 Sincronizando com o Discord...</td></tr>';
  if (btn) btn.disabled = true;
  if (progContainer) progContainer.style.display = "block";
  if (barra) barra.style.width = "0%";

  // Simulação de progresso enquanto a API não responde
  let progressoSimulado = 0;
  const interval = setInterval(() => {
    if (progressoSimulado < 90) {
      progressoSimulado += Math.random() * 15;
      if (barra) barra.style.width = `${Math.min(progressoSimulado, 90)}%`;
    }
  }, 400);

  try {
    const res = await fetch(`/api/membros-inativos?org=${sessao.org}`);
    const dados = await res.json();

    // Finaliza a barra
    clearInterval(interval);
    if (barra) barra.style.width = "100%";

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">Nenhum oficial encontrado.</td></tr>';
    } else {
      dadosInatividadeGlobal = dados
        .filter((m) => {
          const dias =
            m.dias ||
            Math.floor(
              (Date.now() - (m.lastMsg || DATA_BASE_AUDITORIA)) / 86400000
            );
          return dias >= 7 && !CARGOS_PROTEGIDOS.includes(m.cargo);
        })
        .sort((a, b) => (b.dias || 0) - (a.dias || 0));

      corpo.innerHTML = "";
      if (dadosInatividadeGlobal.length === 0) {
        corpo.innerHTML =
          '<tr><td colspan="6" align="center">Todos os oficiais estão ativos!</td></tr>';
      } else {
        dadosInatividadeGlobal.forEach((m) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><div class="user-cell"><img src="${
              m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
            }" class="avatar-img">
            <div><strong>${m.name}</strong><br><small>${
            m.cargo || "Oficial"
          }</small></div></div></td>
            <td><code>${m.id}</code></td>
            <td>${
              m.lastMsg > 0
                ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
                : "Nunca"
            }</td>
            <td><strong style="color: #ff4d4d">${m.dias || 0} Dias</strong></td>
            <td align="center">
              <button onclick="window.exonerarMembro('${m.id}', '${
            m.rpName || m.name
          }', '${
            m.cargo
          }')" class="btn-exonerar" title="Exonerar por Inatividade">
                <i class="fa-solid fa-user-slash"></i>
              </button>
            </td>`;
          corpo.appendChild(tr);
        });
        window.mostrarAviso(
          `${dadosInatividadeGlobal.length} inativos encontrados.`
        );
      }
    }
  } catch (err) {
    clearInterval(interval);
    corpo.innerHTML =
      '<tr><td colspan="6" align="center" style="color:red">Erro ao conectar com a API.</td></tr>';
  } finally {
    if (btn) btn.disabled = false;
    // Esconde a barra após 1 segundo da conclusão
    setTimeout(() => {
      if (progContainer) progContainer.style.display = "none";
    }, 1000);
  }
};

// =========================================================
// 4. EXONERAÇÃO (ADAPTADA CONFORME SOLICITADO)
// =========================================================
window.exonerarMembro = async function (discordId, rpName, cargo) {
  // Puxa o passaporte do nome (ex: "Nome / 1234" -> "1234")
  const idMatch = rpName.match(/(\d+)$/);
  const passaporte = idMatch ? idMatch[1] : "---";
  const nomeLimpo = rpName.split(/[|/]/)[0].trim();

  // Conforme solicitado: Motivo fixo inatividade, sem prompt.
  const motivoFixo = "Inatividade superior a 7 dias";

  if (
    !confirm(
      `Confirmar relatório de exoneração de ${nomeLimpo} por inatividade?`
    )
  )
    return;

  try {
    const res = await fetch("/api/exonerar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        discordUser: discordId,
        nomeCidade: nomeLimpo,
        idPassaporte: passaporte,
        cargo: cargo || "Oficial",
        motivo: motivoFixo,
      }),
    });

    if (res.ok) {
      window.mostrarAviso("Relatório enviado com sucesso!");
      window.carregarInatividade(); // Recarrega a lista
    } else {
      const erro = await res.json();
      alert(`Erro: ${erro.error || "Erro desconhecido"}`);
    }
  } catch (e) {
    alert(
      "Erro na conexão com a API de exoneração. Verifique se o servidor está online."
    );
  }
};

// =========================================================
// 5. OUTRAS FUNÇÕES (FERIAS, METAS, ENSINO)
// =========================================================
window.abrirGestaoFerias = function () {
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS E LICENÇAS";
  document.getElementById("botoes-ferias").style.display = "block";
  window.atualizarListaFerias();
};

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const infoBox = document.getElementById("status-ferias-info");
  const sessao = obterSessao();
  if (!select || !infoBox) return;

  select.innerHTML = '<option value="">🔄 Sincronizando...</option>';
  try {
    const response = await fetch(
      `/api/verificar-ferias?org=${sessao.org || "PCERJ"}`
    );
    const data = await response.json();
    select.innerHTML = '<option value="">Selecione um oficial...</option>';
    if (!data.oficiais || data.oficiais.length === 0) {
      infoBox.innerHTML = "Nenhum oficial em férias.";
      return;
    }
    data.oficiais.forEach((o) => {
      const opt = document.createElement("option");
      opt.value = o.id;
      opt.textContent = `${o.nome} (Retorno: ${o.dataRetorno})`;
      select.appendChild(opt);
    });
    infoBox.innerHTML = `✅ ${data.oficiais.length} oficiais em férias.`;
  } catch (e) {
    select.innerHTML = '<option value="">Erro ao carregar</option>';
  }
};

const abrirPaginaMeta = (secao, botoes, nav, titulo, orgReq) => {
  const sessao = obterSessao();
  if (!sessao || sessao.org !== orgReq) {
    window.mostrarAviso(`Acesso restrito à ${orgReq}`, "error");
    return;
  }
  resetarTelas();
  document.getElementById(secao).style.display = "block";
  document.getElementById(secao).style.visibility = "visible";
  document.getElementById(botoes).style.display = "block";
  document.getElementById(nav).classList.add("active");
  document.getElementById("titulo-pagina").innerText = titulo;
};

window.abrirMetaCore = () =>
  abrirPaginaMeta(
    "secao-meta-core",
    "botoes-core",
    "nav-core",
    "METAS CORE",
    "PCERJ"
  );
window.abrirMetaGRR = () =>
  abrirPaginaMeta(
    "secao-meta-grr",
    "botoes-grr",
    "nav-grr",
    "METAS GRR",
    "PRF"
  );
window.abrirMetaBOPE = () =>
  abrirPaginaMeta(
    "secao-meta-bope",
    "botoes-bope",
    "nav-bope",
    "METAS BOPE",
    "PMERJ"
  );

window.abrirEnsino = function () {
  resetarTelas();
  document.getElementById("secao-ensino").style.display = "block";
  document.getElementById("secao-ensino").style.visibility = "visible";
  document.getElementById("nav-ensino")?.classList.add("active");
  document.getElementById("titulo-pagina").innerText = "SISTEMA DE ENSINO";
};

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  const sessao = obterSessao();
  if (sessao) {
    if (sessao.tema) document.body.classList.add(sessao.tema);
    atualizarIdentidadeVisual(sessao.org);
    window.abrirInatividade();
  }
});
