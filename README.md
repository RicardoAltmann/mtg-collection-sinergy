# MTG Synergy Analyzer

Herramienta para analizar la sinergia entre tus cartas de Magic: The Gathering y un commander específico usando la API de Scryfall.

## Requisitos

- Node.js 18+ (usa el fetch nativo)
- npm

## Instalación

1. Abre una terminal en esta carpeta
2. Instala las dependencias:

```bash
npm install
```

## Uso

1. Inicia el servidor:

```bash
npm start
```

2. Abre tu navegador en: `http://localhost:3000`

3. Ingresa:
   - Nombre del commander (en inglés)
   - Tu lista de cartas (una por línea)

4. Click en "Analizar Sinergia"

## Cómo funciona

El servidor actúa como proxy entre tu navegador y la API de Scryfall, evitando problemas de CORS.

**Análisis de sinergia basado en:**
- Identidad de color
- Keywords compartidas
- Mecánicas específicas (+1/+1 counters, proliferate, sacrifice, ETB, graveyard, tokens)
- Sinergias tribales
- Rampeo y card draw
- Remoción y protección
- Staples del formato

**Categorías:**
- 🔥 Alta Sinergia (20+ puntos)
- ⚡ Media Sinergia (5-19 puntos)
- 📝 Baja Sinergia (0-4 puntos)
- 🚫 Fuera de identidad de color

## API Endpoints

- `GET /api/card/:name` - Busca una carta específica
- `POST /api/cards/batch` - Busca múltiples cartas
  ```json
  {
    "cardNames": ["Sol Ring", "Lightning Bolt"]
  }
  ```

## Rate Limiting

El servidor respeta el rate limit de Scryfall (100ms entre requests).

## Estructura

```
/
├── server.js          # Backend Express
├── package.json       # Dependencias
├── public/
│   └── index.html     # Frontend
└── README.md
```
