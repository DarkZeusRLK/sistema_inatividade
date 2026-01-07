// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];

// IMPORTANTE: Coloque uma data no PASSADO para servir de base para quem nunca falou.
const DATA_BASE_AUDITORIA = new Date("2024-12-08T00:00:00").getTime();

const obterSessao = () => {
  const sessionStr = localStorage.getItem("pc_session");
  if (!sessionStr) {
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
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
      unidade: "CORE",
      nome: "PCERJ",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    },
    PRF: { unidade: "GRR", nome: "PRF", logo: "Imagens/PRF_new.png" },
    PMERJ: {
      unidade: "BOPE",
      nome: "PMERJ",
      logo: "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    },
  };
  return (
    labels[org] || {
      unidade: "---",
      nome: "SISTEMA",
      logo: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    }
  );
};

// --- IDENTIDADE VISUAL ---
function atualizarIdentidadeVisual(org) {
  const logos = {
    PRF: "Imagens/PRF_new.png",
    PMERJ:
      "Imagens/Brasão_da_Polícia_Militar_do_Estado_do_Rio_de_Janeiro_-_PMERJ.png",
    PCERJ: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
    POLICE: "Imagens/Brasão_da_Polícia_Civil_do_Estado_do_Rio_de_Janeiro.png",
  };

  const logoUrl = logos[org] || logos["PCERJ"];
  const logoSidebar = document.getElementById("logo-sidebar");
  if (logoSidebar) logoSidebar.src = logoUrl;

  let favicon = document.querySelector("link[rel~='icon']");
  if (!favicon) {
    favicon = document.createElement("link");
    favicon.rel = "icon";
    document.getElementsByTagName("head")[0].appendChild(favicon);
  }
  favicon.href = logoUrl;
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
// 2. FUNÇÕES DO COMANDO GERAL
// =========================================================

window.setPainelComando = function (orgEscolhida) {
  const sessao = obterSessao();
  if (!sessao) return;
  const temas = { PCERJ: "tema-pcerj", PRF: "tema-prf", PMERJ: "tema-pmerj" };
  sessao.org = orgEscolhida;
  sessao.tema = temas[orgEscolhida];
  localStorage.setItem("pc_session", JSON.stringify(sessao));
  window.location.reload();
};

window.abrirSelecaoPainel = function () {
  const modal = document.getElementById("modal-selecao-comando");
  if (modal) modal.style.display = "flex";
};

// =========================================================
// 3. INICIALIZAÇÃO
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
  const sessao = obterSessao();
  if (!sessao) return;

  if (sessao.tema) document.body.classList.add(sessao.tema);

  if (sessao.isComando) {
    const btnTrocar = document.getElementById("wrapper-comando");
    if (btnTrocar) btnTrocar.style.display = "block";
    if (!sessao.org) {
      window.abrirSelecaoPainel();
      return;
    }
  }

  aplicarRestricoes();
  window.abrirInatividade();
});

function aplicarRestricoes() {
  const sessao = obterSessao();
  if (!sessao || !sessao.org) return;

  const { org } = sessao;
  atualizarIdentidadeVisual(org);

  const sidebarTitulo = document.querySelector(".sidebar-header h2");
  if (sidebarTitulo)
    sidebarTitulo.innerText = `POLÍCIA ${
      org === "PCERJ" ? "CIVIL" : org === "PMERJ" ? "MILITAR" : "RODOVIÁRIA"
    }`;

  const permissoes = {
    PCERJ: {
      mostrar: [
        "nav-core",
        "nav-porte",
        "nav-admin",
        "nav-ferias",
        "nav-inatividade",
        "nav-ensino",
      ],
      esconder: ["nav-grr", "nav-bope"],
    },
    PRF: {
      mostrar: ["nav-grr", "nav-ferias", "nav-inatividade"],
      esconder: ["nav-core", "nav-bope", "nav-porte", "nav-admin"],
    },
    PMERJ: {
      mostrar: ["nav-bope", "nav-ferias", "nav-inatividade"],
      esconder: ["nav-core", "nav-grr", "nav-porte", "nav-admin"],
    },
  };

  const config = permissoes[org];
  if (config) {
    config.esconder.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "none";
    });
    config.mostrar.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = "flex";
    });
  }
}

// =========================================================
// 4. GERENCIAMENTO DE TELAS
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
  const gruposBotoes = [
    "botoes-inatividade",
    "botoes-core",
    "botoes-grr",
    "botoes-bope",
    "botoes-ferias",
    "botoes-ensino",
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
  if (!sessao || !sessao.org) return;
  const label = getOrgLabel(sessao.org);
  resetarTelas();
  document.getElementById("secao-inatividade").style.display = "block";
  document.getElementById("secao-inatividade").style.visibility = "visible";
  document.getElementById("botoes-inatividade").style.display = "block";
  document.getElementById("nav-inatividade").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `AUDITORIA - ${label.nome}`;
};

// =========================================================
// 5. LÓGICA DE AUDITORIA E EXONERAÇÃO
// =========================================================

window.carregarInatividade = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");
  const progBar = document.getElementById("progress-bar");
  const progPercent = document.getElementById("progress-percentage");

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  btn.disabled = true;

  try {
    const res = await fetch(`/api/membros-inativos?org=${org}`);
    const dados = await res.json();

    if (!Array.isArray(dados) || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">Nenhum inativo encontrado.</td></tr>';
      return;
    }

    dadosInatividadeGlobal = dados.map((m) => {
      const agora = Date.now();
      let ref = m.lastMsg > 0 ? m.lastMsg : DATA_BASE_AUDITORIA;
      let dias = Math.floor((agora - ref) / (1000 * 60 * 60 * 24));
      return { ...m, diasInatividade: dias > 0 ? dias : 0 };
    });

    dadosInatividadeGlobal.sort(
      (a, b) => b.diasInatividade - a.diasInatividade
    );

    dadosInatividadeGlobal.forEach((m) => {
      const tr = document.createElement("tr");
      const dataStr =
        m.lastMsg > 0 ? new Date(m.lastMsg).toLocaleDateString("pt-BR") : "---";

      tr.innerHTML = `
        <td>
           <div class="user-cell">
             <img src="${
               m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
             }" class="avatar-img">
             <div><strong>${m.name}</strong><br><small>${
        m.rpName || "Não registrado"
      }</small></div>
           </div>
        </td>
        <td><code>${m.id}</code></td>
        <td>${dataStr}</td>
        <td><strong style="color: #ff4d4d">${
          m.diasInatividade
        } Dias</strong></td>
        <td align="center">
            <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
                <span class="badge-danger">⚠️ INATIVO</span>
                <button onclick="window.exonerarMembro('${m.id}', '${
        m.rpName
      }', '${m.cargo}')" class="btn-exonerar" title="Exonerar por Inatividade">
                    <i class="fa-solid fa-user-slash"></i>
                </button>
            </div>
        </td>
      `;
      corpo.appendChild(tr);
    });

    mostrarAviso("Sincronização concluída.");
  } catch (err) {
    mostrarAviso("Erro ao carregar inativos.", "error");
  } finally {
    btn.disabled = false;
    progContainer.style.display = "none";
  }
};

// --- FUNÇÃO DE EXONERAÇÃO ---
window.exonerarMembro = async function (discordId, rpName, cargo) {
  // Tenta extrair ID do nome se estiver no formato "Nome | 123"
  const idMatch = rpName.match(/(\d+)$/);
  const passaporte = idMatch ? idMatch[1] : "---";
  const nomeLimpo = rpName.split("|")[0].trim();

  const motivo = prompt(
    `Motivo da exoneração de ${nomeLimpo}:`,
    "Inatividade superior a 7 dias"
  );
  if (!motivo) return;

  if (!confirm(`Confirmar envio de relatório de exoneração para o Discord?`))
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
        motivo: motivo,
      }),
    });

    if (res.ok) {
      mostrarAviso("Relatório de exoneração enviado!");
      window.carregarInatividade(); // Recarrega a lista
    } else {
      alert("Falha ao enviar relatório.");
    }
  } catch (e) {
    alert("Erro na conexão com a API.");
  }
};

// =========================================================
// 6. GESTÃO DE FÉRIAS (CORREÇÃO DO ERRO)
// =========================================================

window.abrirGestaoFerias = function () {
  const { org } = obterSessao();
  resetarTelas();
  document.getElementById("secao-gestao-ferias").style.display = "block";
  document.getElementById("secao-gestao-ferias").style.visibility = "visible";
  document.getElementById("botoes-ferias").style.display = "block";
  document.getElementById("nav-ferias").classList.add("active");
  document.getElementById(
    "titulo-pagina"
  ).innerText = `GESTÃO DE FÉRIAS - ${org}`;

  window.atualizarListaFerias(); // Agora a função existe abaixo
};

// FUNÇÃO QUE ESTAVA FALTANDO E CAUSAVA O ERRO:
window.atualizarListaFerias = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-ferias");
  if (!corpo) return;

  corpo.innerHTML =
    '<tr><td colspan="4" align="center">Sincronizando férias...</td></tr>';

  try {
    const res = await fetch(`/api/verificar-ferias?org=${org}`);
    const data = await res.json();

    corpo.innerHTML = "";

    if (data.oficiais && data.oficiais.length > 0) {
      data.oficiais.forEach((o) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
                    <td><strong>${o.nome}</strong></td>
                    <td>${o.dataRetorno}</td>
                    <td align="center"><span class="badge-ferias">EM FÉRIAS</span></td>
                    <td align="center">
                        <button onclick="window.anteciparVolta('${o.id}')" class="btn-voltar">Antecipar</button>
                    </td>
                `;
        corpo.appendChild(tr);
      });
    } else {
      corpo.innerHTML =
        '<tr><td colspan="4" align="center">Nenhum oficial em férias.</td></tr>';
    }
  } catch (e) {
    corpo.innerHTML =
      '<tr><td colspan="4" align="center" style="color:red">Erro ao carregar férias.</td></tr>';
  }
};

window.anteciparVolta = async function (userId) {
  if (!confirm("Deseja remover a tag de férias deste membro agora?")) return;
  try {
    const res = await fetch("/api/verificar-ferias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      mostrarAviso("Membro retornou das férias!");
      window.atualizarListaFerias();
    }
  } catch (e) {
    alert("Erro ao processar retorno.");
  }
};
// =========================================================
// 8. METAS E ENSINO
// =========================================================

window.abrirMetaCore = function () {
  resetarTelas();
  document.getElementById("secao-meta-core").style.display = "block";
  document.getElementById("secao-meta-core").style.visibility = "visible";
  document.getElementById("botoes-core").style.display = "block";
  document.getElementById("nav-core").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "AUDITORIA - METAS CORE (PCERJ)";
};

window.abrirMetaGRR = function () {
  resetarTelas();
  document.getElementById("secao-meta-grr").style.display = "block";
  document.getElementById("secao-meta-grr").style.visibility = "visible";
  document.getElementById("botoes-grr").style.display = "block";
  document.getElementById("nav-grr").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "AUDITORIA - METAS GRR (PRF)";
};

window.abrirMetaBOPE = function () {
  resetarTelas();
  document.getElementById("secao-meta-bope").style.display = "block";
  document.getElementById("secao-meta-bope").style.visibility = "visible";
  document.getElementById("botoes-bope").style.display = "block";
  document.getElementById("nav-bope").classList.add("active");
  document.getElementById("titulo-pagina").innerText =
    "AUDITORIA - METAS BOPE (PMERJ)";
};

window.abrirEnsino = function () {
  resetarTelas();
  document.getElementById("secao-ensino").style.display = "block";
  document.getElementById("botoes-ensino").style.display = "block";
  document.getElementById("nav-ensino").classList.add("active");
  document.getElementById("titulo-pagina").innerText = "SISTEMA DE ENSINO";
};
