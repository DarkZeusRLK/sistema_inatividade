window.carregarRelatorioEnsino = async function () {
  const { org } = obterSessao();
  const corpo = document.getElementById("corpo-ensino");
  const progContainer = document.getElementById("progress-container-ensino");
  const progBar = document.getElementById("progress-bar-ensino");
  const btn = document.getElementById("btn-sincronizar-ensino");

  if (!corpo) return;

  corpo.innerHTML = "";
  progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/relatorio-ensino?org=${org}`);
    const dados = await res.json();

    // Ordenar por quem tem mais total de atividades
    dados.sort((a, b) => b.total - a.total);

    dados.forEach((inst) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>
                    <div class="user-cell" style="display: flex; align-items: center; gap: 10px;">
                        <img src="${
                          inst.avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }" 
                             style="width: 32px; height: 32px; border-radius: 50%;">
                        <strong>${inst.name}</strong>
                    </div>
                </td>
                <td><code>${inst.id}</code></td>
                <td align="center"><span class="badge-curso">${
                  inst.cursos
                }</span></td>
                <td align="center"><span class="badge-rec">${
                  inst.recs
                }</span></td>
                <td align="center"><strong>${inst.total}</strong></td>
            `;
      corpo.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro Ensino:", err);
  } finally {
    progContainer.style.display = "none";
    if (btn) btn.disabled = false;
  }
};
