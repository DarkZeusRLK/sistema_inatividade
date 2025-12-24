window.abrirMetaCore = function () {
  document.getElementById("secao-inatividade").style.display = "none";
  document.getElementById("secao-meta-core").style.display = "block";
};

window.carregarMetaCore = async function () {
  const corpo = document.getElementById("corpo-meta-core");
  const progBar = document.getElementById("prog-bar-core");
  const progContainer = document.getElementById("progress-container-core");

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  progBar.style.width = "50%";

  try {
    const res = await fetch("/api/meta-core");
    const dados = await res.json();

    dados.forEach((m) => {
      // Lógica de Status
      const acoesOk = m.acoes >= 4;

      // CGPC Meta (Se tiver cargo de auditor)
      const temCargoCGPC = m.roles.includes(process.env.CGPC_ROLE_ID); // Nota: o frontend precisará desses IDs ou o backend já manda o status
      const cgpcOk = m.cgpc >= 1;

      // Ensino Meta (4 cursos OU 2 recrutamentos)
      const ensinoOk = m.ensino_cursos >= 4 || m.ensino_recrut >= 2;

      // Verificação Final baseada nos cargos
      let metaFinal = acoesOk;
      if (m.roles.includes("ID_CARGO_CGPC")) metaFinal = metaFinal && cgpcOk;
      if (m.roles.includes("ID_CARGO_ENSINO"))
        metaFinal = metaFinal && ensinoOk;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td><strong>${m.name}</strong></td>
                <td>${m.acoes}/4</td>
                <td>${m.cgpc}/1</td>
                <td>${m.ensino_cursos} Cursos / ${m.ensino_recrut} Recr.</td>
                <td>
                    <span class="badge-${metaFinal ? "success" : "danger"}">
                        ${metaFinal ? "META BATIDA" : "PENDENTE"}
                    </span>
                </td>
            `;
      corpo.appendChild(tr);
    });
    progBar.style.width = "100%";
  } catch (e) {
    alert("Erro ao carregar metas CORE");
  }
};
