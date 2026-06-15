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
const recTxt       = document.querySelector(".rec__txt");

// --- Versión visible (se cambia en cada despliegue para identificarla en el móvil) ---
const VERSION = "v4";
document.getElementById("version").textContent = VERSION;
const vPie = document.getElementById("version-pie");
if (vPie) vPie.textContent = "DICTADO · " + VERSION;
console.log("DICTADO", VERSION);

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
let baseRaw = "";      // texto consolidado (sesiones previas + ediciones a mano)
let finalSesion = "";  // texto definitivo de la sesión de escucha actual
let ultimaConsolidada = ""; // última frase fijada, para no repetirla al reiniciar

function crearReconocimiento() {
  const r = new SpeechRecognition();
  r.lang = idiomaEl.value;
  r.continuous = true;       // no parar tras la primera frase
  r.interimResults = true;   // mostrar resultados provisionales

  r.onresult = (evento) => {
    // Reconstruimos SIEMPRE desde cero el texto de esta sesión (índices 0..n).
    // En Android, 'onresult' se dispara varias veces para la misma frase; si
    // fuéramos acumulando, saldría repetida ("hola hola hola").
    finalSesion = "";
    let interino = "";
    let previa = null;  // para descartar finales repetidos consecutivos (bug Android)
    for (let i = 0; i < evento.results.length; i++) {
      const res = evento.results[i];
      const txt = res[0].transcript.trim();
      if (res.isFinal) {
        if (txt && txt !== previa) {   // si es igual a la anterior, es una repetición del motor
          finalSesion += txt + " ";
          previa = txt;
        }
      } else {
        interino += res[0].transcript + " ";
      }
    }
    textoEl.value = autocorregir(baseRaw + finalSesion);
    interinoEl.textContent = interino;
    textoEl.scrollTop = textoEl.scrollHeight;
    actualizarContador();
  };

  r.onerror = (e) => {
    if (e.error === "not-allowed") {
      estadoEl.textContent = "MICRÓFONO DENEGADO";
    } else if (e.error === "no-speech") {
      estadoEl.textContent = "NO TE OÍ… SIGO ESCUCHANDO";
    } else {
      estadoEl.textContent = "ERROR: " + e.error;
    }
  };

  // Al terminar una sesión (Android la corta tras cada frase) consolidamos lo
  // reconocido en la base y, si seguimos dictando, reiniciamos.
  r.onend = () => {
    // Consolidar lo de esta sesión, salvo que sea idéntico a lo último fijado
    // (eso pasa cuando Android, al reiniciar, vuelve a mandar la misma frase).
    const limpio = finalSesion.trim();
    if (limpio && limpio !== ultimaConsolidada) {
      baseRaw += finalSesion;
      ultimaConsolidada = limpio;
    }
    finalSesion = "";
    if (escuchando) {
      try { r.start(); } catch (_) {}
    }
  };

  return r;
}

// 5) Botón empezar/parar.
btnDictar.addEventListener("click", () => {
  if (!escuchando) {
    baseRaw = textoEl.value ? textoEl.value + " " : ""; // conservar lo editado a mano
    finalSesion = "";
    ultimaConsolidada = "";
    recognition = crearReconocimiento();
    escuchando = true;
    recognition.start();
    recTxt.textContent = "PARAR";
    btnDictar.classList.add("grabando");
    estadoEl.textContent = "● ESCUCHANDO";
    estadoEl.classList.add("activo");
  } else {
    escuchando = false;
    recognition.stop();
    interinoEl.textContent = "";
    recTxt.textContent = "EMPEZAR A DICTAR";
    btnDictar.classList.remove("grabando");
    estadoEl.textContent = "DETENIDO";
    estadoEl.classList.remove("activo");
  }
});

// 6) Acciones: copiar, descargar, limpiar.
document.getElementById("btn-copiar").addEventListener("click", async () => {
  await navigator.clipboard.writeText(textoEl.value);
  flash(document.getElementById("btn-copiar"), "✓ COPIADO");
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
  baseRaw = "";
  finalSesion = "";
  ultimaConsolidada = "";
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
  contadorEl.textContent = palabras + (palabras === 1 ? " PALABRA" : " PALABRAS");
}

function flash(boton, mensaje) {
  const original = boton.textContent;
  boton.textContent = mensaje;
  setTimeout(() => (boton.textContent = original), 1200);
}
