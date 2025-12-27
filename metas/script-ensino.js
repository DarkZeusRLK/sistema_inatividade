window.carregarRelatorioEnsino = async function () {
  // Tenta obter a sessão de várias formas para não dar erro
  let sessao = {};
  try {
    sessao =
      typeof obterSessao === "function"
        ? obterSessao()
        : JSON.parse(localStorage.getItem("pc_session") || "{}");
  } catch (e) {
    console.error("Erro ao obter sessão", e);
  }

  const org = sessao.org || "PCERJ"; // Fallback para PCERJ se falhar

  const dataIn = document.getElementById("data-inicio-ensino")?.value;
  const dataFi = document.getElementById("data-fim-ensino")?.value;

  const corpo = document.getElementById("corpo-ensino");
  const progContainer = document.getElementById("progress-container-ensino");
  const btn = document.getElementById("btn-sincronizar-ensino");

  // Log para depuração - Se aparecer no F12, o botão está funcionando
  console.log("Iniciando busca de ensino para:", org, dataIn, dataFi);

  if (!corpo) {
    console.error("Erro: Elemento 'corpo-ensino' não encontrado no HTML!");
    return;
  }

  corpo.innerHTML =
    '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #d4af37;">Sincronizando com Discord... Aguarde.</td></tr>';
  if (progContainer) progContainer.style.display = "block";
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(
      `/api/relatorio-ensino?org=${org}&dataInicio=${dataIn}&dataFim=${dataFi}`
    );
    if (!res.ok) throw new Error(`Erro HTTP: ${res.status}`);

    const dados = await res.json();
    corpo.innerHTML = "";

    if (!dados || dados.length === 0) {
      corpo.innerHTML =
        '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum instrutor encontrado nesta matriz ou período.</td></tr>';
      return;
    }

    dados.sort((a, b) => b.total - a.total);

    dados.forEach((inst) => {
      const tr = document.createElement("tr");
      tr.style.borderBottom = "1px solid #222";
      tr.innerHTML = `
                <td style="padding: 10px;">
                    <div class="user-cell" style="display: flex; align-items: center; gap: 10px;">
                        <img src="${
                          inst.avatar ||
                          "https://cdn.discordapp.com/embed/avatars/0.png"
                        }" 
                             style="width: 32px; height: 32px; border-radius: 50%; border: 1px solid #d4af37;">
                        <strong style="color: #eee;">${inst.name}</strong>
                    </div>
                </td>
                <td style="padding: 10px;"><code style="color: #888;">${
                  inst.id
                }</code></td>
                <td align="center" style="padding: 10px;"><span class="badge-curso" style="background: #1a1a1a; color: #00ff00; padding: 4px 8px; border-radius: 4px;">${
                  inst.cursos
                }</span></td>
                <td align="center" style="padding: 10px;"><span class="badge-rec" style="background: #1a1a1a; color: #00d9ff; padding: 4px 8px; border-radius: 4px;">${
                  inst.recs
                }</span></td>
                <td align="center" style="padding: 10px;"><strong style="color: #d4af37;">${
                  inst.total
                }</strong></td>
            `;
      corpo.appendChild(tr);
    });
  } catch (err) {
    console.error("Erro Ensino:", err);
    corpo.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ff4444; padding: 20px;">Erro ao carregar dados: ${err.message}</td></tr>`;
  } finally {
    if (progContainer) progContainer.style.display = "none";
    if (btn) btn.disabled = false;
  }
};
