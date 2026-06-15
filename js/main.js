// === App de dictado por voz con autocorrección ===

// 1) Detectar soporte del navegador (Chrome/Chromium/Edge lo tienen).
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Referencias a los elementos de la página.
const btnDictar    = document.getElementById("btn-dictar");
const estadoEl     = document.getElementById("estado");
const idiomaEl     = document.getElementById("idioma");
const autocorregirEl = document.getElementById("autocorregir");
const textoEl      = document.getElementById("texto");
const interinoEl   = document.getElementById("interino");
const contadorEl   = document.getElementById("contador");

if (!SpeechRecognition) {
  document.getElementById("no-soportado").classList.remove("oculto");
  btnDictar.disabled = true;
}

// 2) Comandos de voz -> símbolos. Los de varias palabras van ANTES que los simples.
const COMANDOS = [
  [/\bpunto y aparte\b/gi, ".\n"],
  [/\bpunto y seguido\b/gi, ". "],
  [/\bpunto y coma\b/gi, ";"],
  [/\bdos puntos\b/gi, ":"],
  [/\bnueva l[íi]nea\b/gi, "\n"],
  [/\bsalto de l[íi]nea\b/gi, "\n"],
  [/\bsigno de interrogaci[óo]n\b/gi, "?"],
  [/\bsigno de exclamaci[óo]n\b/gi, "!"],
  [/\babre par[ée]ntesis\b/gi, " ("],
  [/\bcierra par[ée]ntesis\b/gi, ")"],
  [/\bpunto\b/gi, "."],
  [/\bcoma\b/gi, ","],
  [/\bguion\b/gi, "-"],
  [/\bcomillas\b/gi, '"'],
];

// 3) La función de autocorrección.
function autocorregir(texto) {
  let t = texto;

  if (autocorregirEl.checked) {
    for (const [re, rep] of COMANDOS) t = t.replace(re, rep);
  }

  // Quitar espacios antes de signos de puntuación: "hola ." -> "hola."
  t = t.replace(/\s+([.,;:!?])/g, "$1");
  // Asegurar un espacio después de un signo si le sigue una letra/número.
  t = t.replace(/([.,;:!?])(?=[^\s\n.,;:!?])/g, "$1 ");
  // Colapsar espacios repetidos.
  t = t.replace(/[ \t]{2,}/g, " ");
  // Mayúscula al principio del texto, tras . ! ? y tras salto de línea.
  t = t.replace(/(^\s*|[.!?]\s+|\n\s*)([a-záéíóúñü])/g,
                (m, ini, letra) => ini + letra.toUpperCase());

  return t;
}

// 4) Configurar el reconocimiento de voz.
let recognition = null;
let escuchando = false;
let textoFinal = "";   // lo ya reconocido en firme

function crearReconocimiento() {
  const r = new SpeechRecognition();
  r.lang = idiomaEl.value;
  r.continuous = true;       // no parar tras la primera frase
  r.interimResults = true;   // mostrar resultados provisionales

  r.onresult = (evento) => {
    let interino = "";
    for (let i = evento.resultIndex; i < evento.results.length; i++) {
      const trozo = evento.results[i][0].transcript;
      if (evento.results[i].isFinal) {
        textoFinal += trozo + " ";
      } else {
        interino += trozo;
      }
    }
    textoEl.value = autocorregir(textoFinal);
    interinoEl.textContent = interino;
    textoEl.scrollTop = textoEl.scrollHeight;
    actualizarContador();
  };

  r.onerror = (e) => {
    if (e.error === "not-allowed") {
      estadoEl.textContent = "Permiso de micrófono denegado";
    } else if (e.error === "no-speech") {
      estadoEl.textContent = "No te oí… sigo escuchando";
    } else {
      estadoEl.textContent = "Error: " + e.error;
    }
  };

  // Si sigue activo el modo dictado, reiniciar al cortarse (límite del navegador).
  r.onend = () => {
    if (escuchando) {
      try { r.start(); } catch (_) {}
    }
  };

  return r;
}

// 5) Botón empezar/parar.
btnDictar.addEventListener("click", () => {
  if (!escuchando) {
    textoFinal = textoEl.value ? textoEl.value + " " : ""; // conservar lo editado a mano
    recognition = crearReconocimiento();
    escuchando = true;
    recognition.start();
    btnDictar.textContent = "⏹️ Parar";
    btnDictar.classList.add("grabando");
    estadoEl.textContent = "● Escuchando…";
    estadoEl.classList.add("activo");
  } else {
    escuchando = false;
    recognition.stop();
    interinoEl.textContent = "";
    btnDictar.textContent = "🎙️ Empezar a dictar";
    btnDictar.classList.remove("grabando");
    estadoEl.textContent = "Detenido";
    estadoEl.classList.remove("activo");
  }
});

// 6) Acciones: copiar, descargar, limpiar.
document.getElementById("btn-copiar").addEventListener("click", async () => {
  await navigator.clipboard.writeText(textoEl.value);
  flash(document.getElementById("btn-copiar"), "✓ Copiado");
});

document.getElementById("btn-descargar").addEventListener("click", () => {
  const blob = new Blob([textoEl.value], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dictado.txt";
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("btn-limpiar").addEventListener("click", () => {
  textoFinal = "";
  textoEl.value = "";
  interinoEl.textContent = "";
  actualizarContador();
});

// Reaplicar autocorrección si el usuario edita a mano o cambia la opción.
textoEl.addEventListener("input", actualizarContador);
autocorregirEl.addEventListener("change", () => {
  if (!escuchando) textoEl.value = autocorregir(textoEl.value);
});

// 7) Utilidades.
function actualizarContador() {
  const palabras = textoEl.value.trim().split(/\s+/).filter(Boolean).length;
  contadorEl.textContent = palabras + (palabras === 1 ? " palabra" : " palabras");
}

function flash(boton, mensaje) {
  const original = boton.textContent;
  boton.textContent = mensaje;
  setTimeout(() => (boton.textContent = original), 1200);
}
