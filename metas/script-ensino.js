window.carregarRelatorioEnsino = async function () {
  // Função auxiliar caso obterSessao não esteja no escopo global
  const sessao =
    typeof obterSessao === "function"
      ? obterSessao()
      : JSON.parse(localStorage.getItem("pc_session") || "{}");
  const org = sessao.org;

  const corpo = document.getElementById("corpo-ensino");
  const progContainer = document.getElementById("progress-container-ensino");
  const btn = document.getElementById("btn-sincronizar-ensino");

  if (!corpo) return;

  corpo.innerHTML =
    '<tr><td colspan="5" style="text-align: center; padding: 20px;">Processando dados...</td></tr>';
  if (progContainer) progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/relatorio-ensino?org=${org}`);

    // Verifica se a resposta foi bem sucedida
    if (!res.ok) {
      const txtErro = await res.text();
      throw new Error(`Erro no servidor (${res.status}): ${txtErro}`);
    }

    const dados = await res.json();
    corpo.innerHTML = "";

    if (dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum instrutor encontrado com os cargos configurados.</td></tr>';
      return;
    }

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
    corpo.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ff4444; padding: 20px;">Erro ao carregar: ${err.message}</td></tr>`;
  } finally {
    if (progContainer) progContainer.style.display = "none";
    if (btn) btn.disabled = false;
  }
};
