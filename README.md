# MTG Synergy Analyzer

Herramienta para analizar la sinergia entre tus cartas de Magic: The Gathering y un commander específico usando la API de Scryfall.

## Nuevas Funcionalidades

- **Sistema de Usuarios**: Cada persona tiene su propia colección privada
- **Autenticación Segura**: Login/registro con Supabase Auth
- **Persistencia de Resultados**: Los análisis se guardan automáticamente
- **Filtros por Tipo**: Filtra cartas por Criaturas, Instantáneos, Artefactos, etc.
- **Ordenamiento**: Ordena tu colección por nombre, tipo o fecha

## Requisitos

- Node.js 18+ (usa el fetch nativo)
- npm
- Cuenta de Supabase (gratuita)

## Instalación

### 1. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con tus credenciales de Supabase:

```bash
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-clave-anonima
```

### 2. Configurar Base de Datos en Supabase

**⚠️ IMPORTANTE**: Debes configurar la base de datos ANTES de iniciar la aplicación.

1. Ve a tu proyecto en https://app.supabase.com
2. Abre **SQL Editor** (barra lateral izquierda)
3. Crea una nueva consulta y pega el contenido completo de `supabase-schema.sql`
4. Ejecuta la consulta (Run o Ctrl+Enter)

**¿Obtienes el error "column user_id does not exist"?**
→ Ver [QUICKFIX.md](./QUICKFIX.md) para solución rápida

### 3. Instalar Dependencias

```bash
npm install
```

## Precargar las 10 000 cartas más usadas

Para minimizar las llamadas a Scryfall, puedes poblar `master_cards` con las cartas mejor rankeadas en EDHRec usando la clave de servicio de Supabase (requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`).

```bash
SUPABASE_SERVICE_ROLE_KEY=tu-clave-de-servicio npm run seed:master
```

El script descarga el bulk `default_cards` de Scryfall, selecciona las 10 000 con mejor `edhrec_rank` y las inserta por lotes en `master_cards`.

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
