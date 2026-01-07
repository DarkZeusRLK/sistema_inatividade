// =========================================================
// 1. CONFIGURAÇÕES GLOBAIS E SESSÃO
// =========================================================
let dadosInatividadeGlobal = [];

// Lista de cargos que NUNCA devem aparecer na lista de inatividade (Imunidade)
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

  secoes.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
      el.style.visibility = "hidden"; // Mantemos o hidden por segurança
    }
  });

  // Esconde todos os grupos de botões de uma vez
  document
    .querySelectorAll('[id^="botoes-"]')
    .forEach((el) => (el.style.display = "none"));

  document
    .querySelectorAll(".nav-item")
    .forEach((item) => item.classList.remove("active"));
}

window.carregarInatividade = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-inatividade");
  const btn = document.getElementById("btn-sincronizar");
  const progContainer = document.getElementById("progress-container");

  corpo.innerHTML =
    '<tr><td colspan="6" align="center">🔍 Consultando banco de dados do Discord...</td></tr>';
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

    // 1. FILTRAGEM: Usamos o 'dias' que já vem da API (que já considera entrada no servidor)
    // E filtramos pelos cargos protegidos
    dadosInatividadeGlobal = dados.filter((m) => {
      // Se a API não mandou 'dias', calculamos aqui usando a DATA_BASE
      const diasInatividade =
        m.dias ||
        Math.floor(
          (Date.now() - (m.lastMsg || DATA_BASE_AUDITORIA)) /
            (1000 * 60 * 60 * 24)
        );

      const inativoSuficiente = diasInatividade >= 7;
      const eCargoProtegido = CARGOS_PROTEGIDOS.includes(m.cargo);

      return inativoSuficiente && !eCargoProtegido;
    });

    // Ordenar por mais tempo inativo
    dadosInatividadeGlobal.sort((a, b) => (b.dias || 0) - (a.dias || 0));

    corpo.innerHTML = ""; // Limpa o carregando

    if (dadosInatividadeGlobal.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="6" align="center">Nenhum oficial fora do comando está inativo.</td></tr>';
      return;
    }

    dadosInatividadeGlobal.forEach((m) => {
      const tr = document.createElement("tr");
      const dataStr =
        m.lastMsg > 0
          ? new Date(m.lastMsg).toLocaleDateString("pt-BR")
          : "Nunca interagiu";
      const diasExibir = m.dias || 0;

      tr.innerHTML = `
        <td>
           <div class="user-cell">
             <img src="${
               m.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"
             }" class="avatar-img">
             <div><strong>${m.name}</strong><br><small>${
        m.cargo || "Oficial"
      }</small></div>
           </div>
        </td>
        <td><code>${m.id}</code></td>
        <td>${dataStr}</td>
        <td><strong style="color: #ff4d4d">${diasExibir} Dias</strong></td>
        <td align="center">
            <div style="display: flex; align-items: center; gap: 8px; justify-content: center;">
                <span class="badge-danger">⚠️ INATIVO</span>
                <button onclick="window.exonerarMembro('${m.id}', '${
        m.rpName
      }', '${m.cargo}')" class="btn-exonerar" title="Exonerar">
                    <i class="fa-solid fa-user-slash"></i>
                </button>
            </div>
        </td>
      `;
      corpo.appendChild(tr);
    });

    mostrarAviso(`${dadosInatividadeGlobal.length} inativos listados.`);
  } catch (err) {
    console.error(err);
    corpo.innerHTML =
      '<tr><td colspan="6" align="center" style="color:red">Erro ao conectar com a API.</td></tr>';
    mostrarAviso("Erro ao carregar inativos.", "error");
  } finally {
    btn.disabled = false;
    progContainer.style.display = "none";
  }
};

// --- FUNÇÃO DE EXONERAÇÃO ---
window.exonerarMembro = async function (discordId, rpName, cargo) {
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
      window.carregarInatividade();
    } else {
      alert("Falha ao enviar relatório.");
    }
  } catch (e) {
    alert("Erro na conexão com a API.");
  }
};

// =========================================================
// 6. GESTÃO DE FÉRIAS
// =========================================================

window.abrirGestaoFerias = function () {
  resetarTelas();
  const secao = document.getElementById("secao-gestao-ferias");
  if (secao) {
    secao.style.display = "block";
    secao.style.visibility = "visible"; // <--- CORREÇÃO AQUI
  }

  const nav = document.getElementById("nav-ferias");
  if (nav) nav.classList.add("active");

  document.getElementById("titulo-pagina").innerText =
    "GESTÃO DE FÉRIAS E LICENÇAS";

  const botoes = document.getElementById("botoes-ferias");
  if (botoes) botoes.style.display = "block";

  atualizarListaFerias();
};

window.atualizarListaFerias = async function () {
  const select = document.getElementById("select-oficiais-ferias");
  const infoBox = document.getElementById("status-ferias-info");
  const sessao = JSON.parse(localStorage.getItem("pc_session") || "{}");
  const org = sessao.org || "PCERJ"; // Pega a org da sessão

  if (!select) return;

  select.innerHTML =
    '<option value="">🔄 Sincronizando com Discord...</option>';
  infoBox.innerHTML = "Consultando canal de férias...";

  try {
    // Chame sua API passando a organização como query string
    const response = await fetch(`/api/verificar-ferias?org=${org}`);
    const data = await response.json();

    if (data.error) throw new Error(data.error);

    // Limpa o select
    select.innerHTML = '<option value="">Selecione um oficial...</option>';

    if (!data.oficiais || data.oficiais.length === 0) {
      select.innerHTML = '<option value="">Nenhum oficial em férias</option>';
      infoBox.innerHTML =
        "✅ Sincronização concluída: Nenhum oficial encontrado com a tag de férias.";
      return;
    }

    // Preenche os oficiais
    data.oficiais.forEach((oficial) => {
      const option = document.createElement("option");
      option.value = oficial.id;
      option.textContent = `${oficial.nome} (Retorno: ${oficial.dataRetorno})`;
      select.appendChild(option);
    });

    // Mostra logs de quem teve a tag removida automaticamente
    let logTexto = `✅ ${data.oficiais.length} oficiais em férias encontrados.`;
    if (data.logs && data.logs.length > 0) {
      logTexto += `<br><br><b>Tags removidas hoje (Vencidas):</b><br>• ${data.logs.join(
        "<br>• "
      )}`;
    }
    infoBox.innerHTML = logTexto;
  } catch (error) {
    console.error("Erro ao sincronizar férias:", error);
    select.innerHTML = '<option value="">Erro ao sincronizar</option>';
    infoBox.innerHTML = `<span style="color: #ff4444;">❌ Erro: ${error.message}</span>`;
  }
};
window.executarAntecipacao = async function () {
  const userId = document.getElementById("select-oficiais-ferias").value;
  if (!userId) return alert("Selecione um oficial primeiro!");

  if (
    !confirm(
      "Deseja realmente antecipar o retorno deste oficial? A tag de férias será removida agora."
    )
  )
    return;

  try {
    const response = await fetch("/api/verificar-ferias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (response.ok) {
      alert("Sucesso! O oficial foi removido das férias.");
      atualizarListaFerias(); // Recarrega a lista
    } else {
      alert("Erro ao processar antecipação.");
    }
  } catch (error) {
    alert("Erro de conexão.");
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
