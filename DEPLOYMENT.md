# Guía de Deployment - Vercel + Supabase

Esta guía te ayudará a deployar tu MTG Synergy Analyzer en Vercel usando Supabase como base de datos.

## Paso 1: Configurar Supabase

1. Ve a [supabase.com](https://supabase.com) (ya tienes cuenta)
2. Crea un nuevo proyecto o usa uno existente
3. Ve a **SQL Editor** en el menú lateral
4. Copia y pega el contenido de `supabase-schema.sql`
5. Click en "Run" para crear la tabla
6. Ve a **Settings** → **API** y copia:
   - `Project URL` (SUPABASE_URL)
   - `anon public` key (SUPABASE_ANON_KEY)

## Paso 2: Deploy en Vercel

### Opción A: Desde la Web (Más fácil)

1. Ve a [vercel.com](https://vercel.com) (ya tienes cuenta)
2. Click en "Add New" → "Project"
3. Importa tu repositorio de GitHub: `mtg-collection-sinergy`
4. Configuración:
   - **Framework Preset**: Other
   - **Root Directory**: `./`
   - **Build Command**: (dejar vacío)
   - **Output Directory**: (dejar vacío)

5. **Variables de Entorno** (expandir sección):
   ```
   SUPABASE_URL = tu_project_url_de_supabase
   SUPABASE_ANON_KEY = tu_anon_key_de_supabase
   ```

6. Click en "Deploy"

### Opción B: Desde CLI

```bash
# Instalar Vercel CLI (si no lo tienes)
npm install -g vercel

# Desde el directorio del proyecto
vercel

# Seguir las instrucciones y configurar las variables de entorno cuando te pregunte
```

## Paso 3: Configurar Variables de Entorno en Vercel

Si no las configuraste al inicio:

1. Ve a tu proyecto en Vercel
2. Settings → Environment Variables
3. Agrega:
   - `SUPABASE_URL` = tu URL
   - `SUPABASE_ANON_KEY` = tu key
4. Redeploy el proyecto

## Paso 4: Verificar

1. Visita tu URL de Vercel (ej: `https://mtg-synergy-analyzer.vercel.app`)
2. Ve a "Agregar Cartas"
3. Agrega algunas cartas de prueba
4. Verifica que aparezcan en "Mi Colección"
5. Verifica en Supabase → Table Editor → cards que las cartas se guardaron

## Desarrollo Local

Para desarrollo local puedes seguir usando el archivo JSON:

```bash
# Sin variables de entorno = usa archivo local
npm start

# Con Supabase (opcional para local)
# Crea un archivo .env:
SUPABASE_URL=tu_url
SUPABASE_ANON_KEY=tu_key

npm start
```

## Actualizar el Deploy

Cada vez que hagas push a la rama main, Vercel automáticamente re-desplegará tu aplicación.

## Troubleshooting

### Error: "Cannot find module"
- Verifica que todas las dependencias estén en `package.json`
- Ejecuta `npm install` localmente y haz push del `package-lock.json`

### Error: "Supabase connection failed"
- Verifica que las variables de entorno estén correctas en Vercel
- Verifica que la tabla `cards` exista en Supabase
- Verifica que RLS (Row Level Security) tenga las políticas correctas

### La colección no persiste
- Verifica que las variables de entorno de Supabase estén configuradas
- Revisa los logs en Vercel → Deployments → tu deployment → Logs

## Notas Importantes

- **Supabase Free Tier**: Incluye 500MB de base de datos, más que suficiente para miles de cartas
- **Vercel Free Tier**: Incluye hosting ilimitado para sitios públicos
- **Sin cold starts**: A diferencia de Render, Vercel no tiene "sleep", tu app siempre está activa
