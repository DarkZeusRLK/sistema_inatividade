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
  const valorAdmin = parseFloat(document.getElementById("input-administracao").value) || 0;
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
      valor = parseFloat(document.getElementById("input-cgpc").value) || 0;
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

    _dadosTesourariaAtual = { ...dados, total, assinatura };

    let texto = `MATRIZ: ${dados.matriz.instituicao} (${dados.matriz.sigla})\n\n`;
    dados.itens.forEach((item) => {
      texto += `• ${item.setor.padEnd(14, " ")} ${item.finalidade.padEnd(55, " ")} ${formatarMoeda(item.valor)}\n`;
    });
    texto += `\nVALOR TOTAL: ${formatarMoeda(total)}\n`;
    texto += `Assinatura: ${assinatura}`;

    resultadoEl.textContent = texto;
    resultadoEl.style.display = "block";
    btnDownload.style.display = "inline-flex";
  } catch (erro) {
    resultadoEl.textContent = `⚠ ${erro.message}`;
    resultadoEl.style.display = "block";
    btnDownload.style.display = "none";
    _dadosTesourariaAtual = null;
  }
}

// ---------------------------------------------------------
// Botão "Baixar Documento (PDF)" - preenche o template oculto e exporta
// ---------------------------------------------------------
function baixarDocumentoTesouraria() {
  if (!_dadosTesourariaAtual) {
    alert('Clique em "Calcular Valores" antes de gerar o documento.');
    return;
  }

  const { matriz, itens, total, assinatura } = _dadosTesourariaAtual;
  const hoje = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  document.getElementById("doc-instituicao").textContent = matriz.instituicao;
  document.getElementById("doc-oficio").textContent = `OFÍCIO N.º 000/2026 - ${matriz.sigla}`;
  document.getElementById("doc-data").textContent = `Rio de Janeiro, ${hoje}.`;
  document.getElementById("doc-valor-total").textContent = formatarMoeda(total);
  document.getElementById("doc-titular").textContent = assinatura;
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

  html2pdf().set(opcoes).from(elemento).save();
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

  if (selectMatriz) selectMatriz.addEventListener("change", atualizarOpcoesServico);
  if (selectServico) selectServico.addEventListener("change", atualizarVisibilidadeCGPC);
  if (chkEnsino) chkEnsino.addEventListener("change", atualizarPreviewEnsino);
  if (btnCalcular) btnCalcular.addEventListener("click", calcularTesouraria);
  if (btnDownload) btnDownload.addEventListener("click", baixarDocumentoTesouraria);
});
