// === App de dictado por voz con autocorrección ===

// 1) Detectar soporte del navegador (Chrome/Chromium/Edge lo tienen).
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Referencias a los elementos de la página.
const btnHold      = document.getElementById("btn-hold");
const btnToggle    = document.getElementById("btn-toggle");
const estadoEl     = document.getElementById("estado");
const idiomaEl     = document.getElementById("idioma");
const autocorregirEl = document.getElementById("autocorregir");
const textoEl      = document.getElementById("texto");
const interinoEl   = document.getElementById("interino");
const contadorEl   = document.getElementById("contador");

// --- Versión visible (se cambia en cada despliegue para identificarla en el móvil) ---
const VERSION = "v9";
document.getElementById("version").textContent = VERSION;
const vPie = document.getElementById("version-pie");
if (vPie) vPie.textContent = "DICTADO · " + VERSION;
console.log("DICTADO", VERSION);

if (!SpeechRecognition) {
  document.getElementById("no-soportado").classList.remove("oculto");
  btnHold.disabled = true;
  btnToggle.disabled = true;
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
let textoBase = "";       // todo el texto ya confirmado (sesiones previas + ediciones)
let yaConfirmado = false; // ¿ya se añadió la frase de la sesión actual? (evita duplicados)

function crearReconocimiento() {
  const r = new SpeechRecognition();
  r.lang = idiomaEl.value;
  // IMPORTANTE: modo NO continuo. En Chrome Android el modo continuo es la causa
  // de las frases repetidas. Aquí cada frase es una sesión corta que se confirma
  // UNA sola vez; luego reiniciamos en onend para seguir dictando.
  r.continuous = false;
  r.interimResults = true;

  r.onresult = (evento) => {
    let interino = "";
    for (let i = 0; i < evento.results.length; i++) {
      const res = evento.results[i];
      if (res.isFinal) {
        // Confirmar la frase solo una vez, aunque Android dispare el resultado
        // final varias veces dentro de la misma sesión.
        if (!yaConfirmado) {
          textoBase += res[0].transcript.trim() + " ";
          yaConfirmado = true;
        }
      } else {
        interino += res[0].transcript;
      }
    }
    textoEl.value = autocorregir(textoBase);
    interinoEl.textContent = interino;
    caretAlFinal();
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

  // Cada sesión cubre una frase. Al terminar, preparamos la siguiente y
  // reiniciamos si seguimos dictando.
  r.onend = () => {
    yaConfirmado = false;
    if (escuchando) {
      try { r.start(); } catch (_) {}
    }
  };

  return r;
}

// 5) Control de grabación: dos modos (mantener pulsado / alternar).
let modoActual = null; // "hold" | "toggle"

function iniciar(modo) {
  if (escuchando) return;
  textoBase = textoEl.value ? textoEl.value + " " : ""; // conservar lo editado a mano
  yaConfirmado = false;
  recognition = crearReconocimiento();
  escuchando = true;
  modoActual = modo;
  try { recognition.start(); } catch (_) {}
  estadoEl.textContent = "● ESCUCHANDO";
  estadoEl.classList.add("activo");
  (modo === "hold" ? btnHold : btnToggle).classList.add("grabando");
  // Mostrar el cursor en el cuadro de texto SIN abrir el teclado del móvil.
  textoEl.inputMode = "none";
  textoEl.focus({ preventScroll: true });
  caretAlFinal();
}

function detener() {
  if (!escuchando) return;
  escuchando = false;
  try { recognition.stop(); } catch (_) {}
  interinoEl.textContent = "";
  estadoEl.textContent = "DETENIDO";
  estadoEl.classList.remove("activo");
  btnHold.classList.remove("grabando");
  btnToggle.classList.remove("grabando");
  modoActual = null;
  textoEl.inputMode = "text"; // restaurar el teclado para edición manual
}

// Lleva el cursor (caret) al final del texto.
function caretAlFinal() {
  const fin = textoEl.value.length;
  try { textoEl.setSelectionRange(fin, fin); } catch (_) {}
}

// MANTÉN — interruptor momentáneo: graba solo mientras se mantiene pulsado.
// Usamos pointer events (cubren ratón y táctil) + captura para que el "soltar"
// se detecte aunque el dedo se mueva fuera del botón.
btnHold.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  try { btnHold.setPointerCapture(e.pointerId); } catch (_) {}
  iniciar("hold");
});
btnHold.addEventListener("pointerup",     () => { if (modoActual === "hold") detener(); });
btnHold.addEventListener("pointercancel", () => { if (modoActual === "hold") detener(); });
btnHold.addEventListener("contextmenu",   (e) => e.preventDefault());

// TOCAR — interruptor con enclavamiento: toca para grabar, toca otra vez para parar.
btnToggle.addEventListener("click", () => {
  if (escuchando && modoActual === "toggle") detener();
  else if (!escuchando) iniciar("toggle");
});

// 6) Acciones: copiar, descargar, limpiar.
document.getElementById("btn-compartir").addEventListener("click", async () => {
  const boton = document.getElementById("btn-compartir");
  const texto = textoEl.value.trim();
  if (!texto) { flash(boton, "NADA QUE COMPARTIR"); return; }

  if (navigator.share) {
    // Móvil: abre el menú nativo de Android (WhatsApp, Telegram, Gmail…).
    try {
      await navigator.share({ title: "Dictado", text: texto });
    } catch (e) {
      // El usuario canceló el menú: no hacemos nada.
    }
  } else {
    // Escritorio u otros sin Web Share: copiamos como alternativa.
    await navigator.clipboard.writeText(texto);
    flash(boton, "✓ COPIADO (SIN COMPARTIR)");
  }
});

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
  textoBase = "";
  yaConfirmado = false;
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
