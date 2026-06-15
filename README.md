# 🎤 Dictado por voz

App web que convierte tu voz en texto con autocorrección (puntuación, mayúsculas
y comandos de voz). Funciona **100% en el navegador**, sin instalar nada.

## Requisitos

- **Google Chrome** o Chromium (Firefox no soporta el reconocimiento de voz).
- Permitir el **micrófono** cuando el navegador lo pida.

## Cómo arrancar

```bash
cd ~/proyectos/dictado
python3 -m http.server 8001
```

Abre <http://localhost:8001> en Chrome y pulsa **"Empezar a dictar"**.

## Comandos de voz

| Dices… | Escribe |
|---|---|
| "punto" / "coma" | . , |
| "dos puntos" / "punto y coma" | : ; |
| "punto y aparte" | . + salto de línea |
| "nueva línea" | salto de línea |
| "signo de interrogación / exclamación" | ? ! |
| "abre/cierra paréntesis" | ( ) |

Las mayúsculas tras punto y al inicio se aplican solas.

## Estructura

```
dictado/
├── index.html      # interfaz
├── css/styles.css  # estilos
├── js/main.js      # reconocimiento de voz + autocorrección
└── README.md
```

## Mejora futura: autocorrección con IA

La autocorrección actual es por reglas (puntuación, mayúsculas). Para una
corrección **gramatical y ortográfica potente**, se puede enviar el texto a un
modelo de IA (p. ej. la API de Claude) desde un pequeño servidor local que
guarde la clave de forma segura. Ver notas en el chat.
