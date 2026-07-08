// =========================================================
// TESOURARIA - Geração do Edital de Repasse (modelo oficial)
// =========================================================

const TESOURARIA_CONFIG = {
  VALOR_UNIDADE: 3000000,     // Grupamentos / Tropas Especiais (fixo)
  VALOR_CURSO: 50000,         // por curso aplicado (Ensino)
  VALOR_RECRUTAMENTO: 70000,  // por recrutamento realizado (Ensino)
};

const MATRIZES = {
  PCERJ: {
    instituicao: "POLÍCIA CIVIL DO ESTADO DO RIO DE JANEIRO",
    sigla: "PCERJ",
    tesoureiro: "Tesoureiro da Polícia Civil do Estado do Rio de Janeiro",
  },
  PMERJ: {
    instituicao: "POLÍCIA MILITAR DO ESTADO DO RIO DE JANEIRO",
    sigla: "PMERJ",
    tesoureiro: "Tesoureiro da Polícia Militar do Estado do Rio de Janeiro",
  },
  PRF: {
    instituicao: "POLÍCIA RODOVIÁRIA FEDERAL",
    sigla: "PRF",
    tesoureiro: "Tesoureiro da Polícia Rodoviária Federal",
  },
};

function formatarMoeda(valor) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ---------------------------------------------------------
// Máscara de milhar em tempo real para inputs de valor (1.500.000)
// ---------------------------------------------------------
function aplicarMascaraMilhar(inputEl) {
  inputEl.addEventListener("input", () => {
    const somenteDigitos = inputEl.value.replace(/\D/g, "");
    inputEl.value = somenteDigitos ? Number(somenteDigitos).toLocaleString("pt-BR") : "";
  });
}

function lerValorMascarado(inputEl) {
  if (!inputEl || !inputEl.value) return 0;
  const somenteDigitos = inputEl.value.replace(/\D/g, "");
  return somenteDigitos ? parseInt(somenteDigitos, 10) : 0;
}

// ---------------------------------------------------------
// Numeração sequencial do ofício
//
// Fonte da verdade: canal do Discord (1406087625080705034), via backend.
// O backend lê as mensagens já postadas naquele canal, filtra pela sigla
// da matriz (PMERJ/PCERJ/PRF) e retorna o maior número já usado + 1.
// Isso evita colisão entre pessoas diferentes gerando documentos ao mesmo tempo.
//
// Se o backend estiver indisponível (offline, erro de rede etc.), cai para
// um contador local (localStorage) apenas como plano B - nesse caso avisamos
// claramente o usuário, pois pode colidir com o número de outra pessoa.
// ---------------------------------------------------------
const OFICIO_STORAGE_PREFIX = "tesouraria_oficio_fallback_";

async function obterProximoNumeroOficio(sigla) {
  try {
    const res = await fetch(`${API_BASE}/api/oficio-contador.js?org=${encodeURIComponent(sigla)}`);
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    const data = await res.json();
    if (typeof data.proximoNumero !== "number") throw new Error("Resposta inesperada da API");
    return { numero: data.proximoNumero, fonte: "discord" };
  } catch (erro) {
    console.warn("Contador remoto de ofício indisponível, usando fallback local:", erro);
    const chave = OFICIO_STORAGE_PREFIX + sigla;
    const atual = parseInt(localStorage.getItem(chave) || "0", 10);
    return { numero: atual + 1, fonte: "local" };
  }
}

function confirmarUsoNumeroOficio(sigla, numero, fonte) {
  // Só precisamos gravar localmente quando a numeração veio do fallback local;
  // quando vem do Discord, o próprio documento postado lá já "confirma" o número.
  if (fonte === "local") {
    localStorage.setItem(OFICIO_STORAGE_PREFIX + sigla, String(numero));
  }
}

function formatarNumeroOficio(numero) {
  return String(numero).padStart(3, "0");
}

// ---------------------------------------------------------
// Filtra as unidades do <select id="select-servico"> conforme a matriz
// ---------------------------------------------------------
function atualizarOpcoesServico() {
  const matriz = document.getElementById("select-matriz").value;
  const select = document.getElementById("select-servico");
  if (!select) return;

  Array.from(select.options).forEach((opt) => {
    const pertence = opt.dataset.matriz === matriz;
    opt.disabled = !pertence;
    opt.hidden = !pertence;
    if (!pertence) opt.selected = false;
  });

  atualizarVisibilidadeCGPC();
}

function atualizarVisibilidadeCGPC() {
  const select = document.getElementById("select-servico");
  const grupo = document.getElementById("cgpc-input-group");
  if (!select || !grupo) return;
  const cgpcSelecionado = Array.from(select.selectedOptions).some((o) => o.value === "CGPC");
  grupo.style.display = cgpcSelecionado ? "block" : "none";
}

// ---------------------------------------------------------
// Lê os totais já carregados na aba "Divisão de Ensino" (#corpo-ensino)
// ---------------------------------------------------------
function obterTotaisEnsino() {
  const corpo = document.getElementById("corpo-ensino");
  const totais = { recrutamentos: 0, cursos: 0, linhas: 0 };
  if (!corpo) return totais;

  corpo.querySelectorAll("tr").forEach((tr) => {
    const tds = tr.querySelectorAll("td");
    if (tds.length < 4) return; // ignora linhas de aviso/placeholder
    const recrutamentos = parseInt(tds[2].textContent.replace(/\D/g, ""), 10) || 0;
    const cursos = parseInt(tds[3].textContent.replace(/\D/g, ""), 10) || 0;
    totais.recrutamentos += recrutamentos;
    totais.cursos += cursos;
    totais.linhas += 1;
  });

  return totais;
}

function atualizarPreviewEnsino() {
  const chk = document.getElementById("chk-ensino");
  const preview = document.getElementById("ensino-preview-tesouraria");
  if (!chk || !preview) return;

  if (!chk.checked) {
    preview.style.display = "none";
    return;
  }

  const totais = obterTotaisEnsino();
  const valor = totais.cursos * TESOURARIA_CONFIG.VALOR_CURSO + totais.recrutamentos * TESOURARIA_CONFIG.VALOR_RECRUTAMENTO;

  preview.style.display = "block";
  if (totais.linhas === 0) {
    preview.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Nenhum dado carregado na aba "Divisão de Ensino". Abra essa aba e clique em ATUALIZAR antes de calcular.`;
  } else {
    preview.innerHTML = `Ensino: ${totais.cursos} curso(s) × ${formatarMoeda(TESOURARIA_CONFIG.VALOR_CURSO)} + ${totais.recrutamentos} recrutamento(s) × ${formatarMoeda(TESOURARIA_CONFIG.VALOR_RECRUTAMENTO)} = <b>${formatarMoeda(valor)}</b>`;
  }
}

// ---------------------------------------------------------
// Monta a lista de itens (unidade, finalidade, valor) a partir do formulário
// ---------------------------------------------------------
function montarItensTesouraria() {
  const matrizKey = document.getElementById("select-matriz").value;
  const matriz = MATRIZES[matrizKey];
  if (!matriz) {
    throw new Error("Selecione uma matriz antes de calcular.");
  }

  const select = document.getElementById("select-servico");
  const unidadesSelecionadas = Array.from(select.selectedOptions).map((o) => o.value);

  const itens = [];

  // Administração (valor manual, sempre presente no modelo)
  const valorAdmin = lerValorMascarado(document.getElementById("input-administracao"));
  itens.push({
    setor: "Administração",
    finalidade: `Bonificações da Administração ${matriz.sigla}`,
    valor: valorAdmin,
  });

  // Ensino (puxado automaticamente da aba de metas de ensino)
  const chkEnsino = document.getElementById("chk-ensino");
  if (chkEnsino.checked) {
    const totais = obterTotaisEnsino();
    if (totais.linhas === 0) {
      throw new Error('Marque "Incluir Divisão de Ensino" apenas depois de sincronizar a aba de Metas de Ensino (aba lateral "Divisão de Ensino" > ATUALIZAR).');
    }
    const valorEnsino = totais.cursos * TESOURARIA_CONFIG.VALOR_CURSO + totais.recrutamentos * TESOURARIA_CONFIG.VALOR_RECRUTAMENTO;
    itens.push({
      setor: "Ensino",
      finalidade: `Bonificações de instrução da Ensino ${matriz.sigla} (${totais.cursos} curso(s), ${totais.recrutamentos} recrutamento(s))`,
      valor: valorEnsino,
    });
  }

  // Unidades operacionais selecionadas
  if (unidadesSelecionadas.length === 0 && !chkEnsino.checked && valorAdmin === 0) {
    throw new Error("Selecione ao menos uma unidade, marque o Ensino, ou informe o valor da Administração.");
  }

  unidadesSelecionadas.forEach((unidade) => {
    let valor;
    if (unidade === "CGPC") {
      valor = lerValorMascarado(document.getElementById("input-cgpc"));
      if (valor <= 0) {
        throw new Error("Informe o valor personalizado do CGPC.");
      }
    } else {
      valor = TESOURARIA_CONFIG.VALOR_UNIDADE;
    }
    itens.push({
      setor: unidade,
      finalidade: `Bonificações de Destaque Operacional do ${unidade}`,
      valor,
    });
  });

  return { matrizKey, matriz, itens };
}

let _dadosTesourariaAtual = null;

// ---------------------------------------------------------
// Botão "Calcular Valores"
// ---------------------------------------------------------
function calcularTesouraria() {
  const resultadoEl = document.getElementById("resultado-tesouraria");
  const btnDownload = document.getElementById("btn-download-doc");

  try {
    const dados = montarItensTesouraria();
    const total = dados.itens.reduce((soma, item) => soma + item.valor, 0);
    const assinatura = document.getElementById("input-assinatura").value.trim() || "________________________";
    const passaporte = document.getElementById("input-passaporte").value.trim();
    if (!passaporte) {
      throw new Error("Informe o Passaporte do Tesoureiro.");
    }

    _dadosTesourariaAtual = { ...dados, total, assinatura, passaporte };

    const linhasHtml = dados.itens
      .map(
        (item) => `
          <tr>
            <td class="rt-setor">${item.setor}</td>
            <td class="rt-finalidade">${item.finalidade}</td>
            <td class="rt-valor">${formatarMoeda(item.valor)}</td>
          </tr>`
      )
      .join("");

    resultadoEl.innerHTML = `
      <div class="resultado-header">
        <span class="resultado-tag"><i class="fa-solid fa-building-shield"></i> ${dados.matriz.sigla}</span>
        <span class="resultado-instituicao">${dados.matriz.instituicao}</span>
      </div>
      <table class="resultado-tabela">
        <thead>
          <tr>
            <th>Setor</th>
            <th>Finalidade</th>
            <th style="text-align:right;">Valor</th>
          </tr>
        </thead>
        <tbody>${linhasHtml}</tbody>
      </table>
      <div class="resultado-footer">
        <div class="resultado-total">
          <span>VALOR TOTAL</span>
          <strong>${formatarMoeda(total)}</strong>
        </div>
        <div class="resultado-assinatura">
          <i class="fa-solid fa-signature"></i> ${assinatura} <span class="resultado-passaporte">(Passaporte: ${passaporte})</span>
        </div>
      </div>
    `;
    resultadoEl.style.display = "block";
    btnDownload.style.display = "inline-flex";
  } catch (erro) {
    resultadoEl.innerHTML = `<div class="resultado-erro"><i class="fa-solid fa-triangle-exclamation"></i> ${erro.message}</div>`;
    resultadoEl.style.display = "block";
    btnDownload.style.display = "none";
    _dadosTesourariaAtual = null;
  }
}

// ---------------------------------------------------------
// Botão "Baixar Documento (PDF)" - preenche o template oculto e exporta
// ---------------------------------------------------------
async function baixarDocumentoTesouraria() {
  if (!_dadosTesourariaAtual) {
    alert('Clique em "Calcular Valores" antes de gerar o documento.');
    return;
  }

  const { matriz, itens, total, assinatura, passaporte } = _dadosTesourariaAtual;

  // Data sempre a partir do relógio local do usuário no momento do download
  const agora = new Date();
  const dataFormatada = agora.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const btnDownload = document.getElementById("btn-download-doc");
  const textoOriginalBotao = btnDownload.innerHTML;
  btnDownload.disabled = true;
  btnDownload.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Consultando numeração...';

  const { numero: numeroOficio, fonte } = await obterProximoNumeroOficio(matriz.sigla);

  btnDownload.disabled = false;
  btnDownload.innerHTML = textoOriginalBotao;

  if (fonte === "local") {
    const continuar = confirm(
      "Não foi possível consultar o canal do Discord para conferir o último número de ofício.\n\n" +
      `Será usado o número local ${formatarNumeroOficio(numeroOficio)} (pode colidir com o de outra pessoa se ela também estiver offline).\n\n` +
      "Deseja continuar mesmo assim?"
    );
    if (!continuar) return;
  }

  document.getElementById("doc-instituicao").textContent = matriz.instituicao;
  document.getElementById("doc-oficio").textContent = `OFÍCIO N.º ${formatarNumeroOficio(numeroOficio)}/${agora.getFullYear()} - ${matriz.sigla}`;
  document.getElementById("doc-data").textContent = `Rio de Janeiro, ${dataFormatada}.`;
  document.getElementById("doc-valor-total").textContent = formatarMoeda(total);
  document.getElementById("doc-numero-conta").textContent = passaporte;
  document.getElementById("doc-titular").textContent = assinatura;
  document.getElementById("doc-assinatura-nome").textContent = assinatura;
  document.getElementById("doc-tesoureiro-label").textContent = matriz.tesoureiro;

  const tbody = document.getElementById("doc-itens-tbody");
  tbody.innerHTML = itens
    .map(
      (item) => `
        <tr>
          <td style="padding:6px; border:1px solid #ccc;">${item.setor}</td>
          <td style="padding:6px; border:1px solid #ccc;">${item.finalidade}</td>
          <td style="padding:6px; border:1px solid #ccc; text-align:right;">${formatarMoeda(item.valor)}</td>
        </tr>`
    )
    .join("");

  const elemento = document.getElementById("documento-print");
  const nomeArquivo = `Repasse_${matriz.sigla}_${new Date().toISOString().slice(0, 10)}.pdf`;

  const opcoes = {
    margin: 0,
    filename: nomeArquivo,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  };

  if (typeof html2pdf === "undefined") {
    alert("Biblioteca de PDF não carregou. Verifique sua conexão e tente novamente.");
    return;
  }

  html2pdf()
    .set(opcoes)
    .from(elemento)
    .save()
    .then(() => {
      confirmarUsoNumeroOficio(matriz.sigla, numeroOficio, fonte);
    });
}

// ---------------------------------------------------------
// Listeners
// ---------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const selectMatriz = document.getElementById("select-matriz");
  const selectServico = document.getElementById("select-servico");
  const chkEnsino = document.getElementById("chk-ensino");
  const btnCalcular = document.getElementById("btn-calcular-tesouraria");
  const btnDownload = document.getElementById("btn-download-doc");
  const inputCgpc = document.getElementById("input-cgpc");
  const inputAdmin = document.getElementById("input-administracao");

  if (selectMatriz) selectMatriz.addEventListener("change", atualizarOpcoesServico);
  if (selectServico) selectServico.addEventListener("change", atualizarVisibilidadeCGPC);
  if (chkEnsino) chkEnsino.addEventListener("change", atualizarPreviewEnsino);
  if (btnCalcular) btnCalcular.addEventListener("click", calcularTesouraria);
  if (btnDownload) btnDownload.addEventListener("click", baixarDocumentoTesouraria);
  if (inputCgpc) aplicarMascaraMilhar(inputCgpc);
  if (inputAdmin) aplicarMascaraMilhar(inputAdmin);
});
