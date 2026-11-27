import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, query, where, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

function mostrarPopup(mensagem, redirecionarParaHome) {
  const overlay = document.getElementById("popup-overlay");
  const texto = document.getElementById("popup-mensagem");
  const botaoOk = document.getElementById("popup-ok");

  texto.textContent = mensagem;
  overlay.style.display = "flex";

  botaoOk.onclick = function () {
    overlay.style.display = "none";
    if (redirecionarParaHome) window.location.href = "index.html";
  };
}

emailjs.init("ZYnnibvkmlqB5UaeP");

// Um e-mail entre aspas por linha, com vírgula depois de cada um (menos o último)
const EMAILS_DESTINO = [
  "0117389@academico.ifmg.edu.br"
];

const form = document.querySelector("form[data-atividade]");
const atividade = form.dataset.atividade;
const campoTabuleiro = form.querySelector("[name=tabuleiro]");
const botaoEnviar = form.querySelector("button[type=submit]");

function calcularExpiraEm(diaTexto, horarioTexto) {
  const [dia, mes, ano] = diaTexto.split("/").map(Number);
  const horaFim = parseInt(horarioTexto.split("-")[1], 10);
  return new Date(ano, mes - 1, dia, horaFim, 0, 0);
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Envia um e-mail por vez, com pausa entre eles, e avisa no console se algum falhar
async function enviarAvisos(dados) {
  for (let i = 0; i < EMAILS_DESTINO.length; i++) {
    const email = EMAILS_DESTINO[i];
    try {
      await emailjs.send("service_09v7eu9", "template_l1b54gq", {
        to_email: email,
        ...dados
      });
    } catch (erro) {
      console.warn("Falha ao enviar e-mail para " + email, erro);
    }
    if (i < EMAILS_DESTINO.length - 1) await esperar(1100);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = form.querySelector("[name=nome]").value;
  const ra = form.querySelector("[name=ra]").value;
  const ano = form.querySelector("[name=ano]").value;
  const curso = form.querySelector("[name=curso]").value;
  const dia = document.getElementById("data-selecionada").value;
  const horario = form.querySelector("[name=horario]").value;
  const tabuleiro = campoTabuleiro ? campoTabuleiro.value : null;

  if (!dia) {
    mostrarPopup("Escolha um dia no calendário antes de agendar.", false);
    return;
  }

  const textoOriginal = botaoEnviar.textContent;
  botaoEnviar.disabled = true;
  botaoEnviar.textContent = "Agendando...";

  try {
    const condicoes = [
      where("atividade", "==", atividade),
      where("dia", "==", dia),
      where("horario", "==", horario)
    ];
    if (tabuleiro) condicoes.push(where("tabuleiro", "==", tabuleiro));

    const q = query(collection(db, "agendamentos"), ...condicoes);
    const jaExiste = await getDocs(q);

    if (!jaExiste.empty) {
      mostrarPopup("Esse horário já está reservado. Escolha outro dia ou horário.", false);
      return;
    }

    const dadosAgendamento = {
      nome, ra, ano, curso, dia, horario, atividade,
      criadoEm: serverTimestamp(),
      expiraEm: Timestamp.fromDate(calcularExpiraEm(dia, horario))
    };
    if (tabuleiro) dadosAgendamento.tabuleiro = tabuleiro;

    await addDoc(collection(db, "agendamentos"), dadosAgendamento);

    // Espera todos os e-mails saírem ANTES de mostrar o pop-up,
    // porque ao clicar em OK a página vai pro início e cancelaria os envios pendentes
    await enviarAvisos({
      nome, ra, ano, curso, atividade, dia, horario,
      tabuleiro: tabuleiro || ""
    });

    mostrarPopup("Agendamento realizado com sucesso!", true);

    form.reset();
    document.getElementById("data-selecionada").value = "";
    document.querySelectorAll(".dia-selecionado").forEach(function (el) {
      el.classList.remove("dia-selecionado");
    });
  } finally {
    botaoEnviar.disabled = false;
    botaoEnviar.textContent = textoOriginal;
  }
});
