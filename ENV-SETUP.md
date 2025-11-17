# 🔐 Guía de Configuración de Variables de Entorno

Esta guía explica cómo configurar de forma segura las variables de entorno para tu proyecto, tanto en desarrollo local como en producción.

## ¿Por qué usar variables de entorno?

Las variables de entorno permiten mantener información sensible (como claves secretas) **fuera del código** y del control de versiones, siguiendo las mejores prácticas de seguridad.

---

## 🏠 Configuración Local (Desarrollo)

### Opción 1: Archivo `.env` (Recomendado)

El archivo `.env` ya está en `.gitignore`, por lo que **NUNCA se subirá a GitHub**.

```bash
# Copia el ejemplo
cp .env.example .env

# Edita con tu editor favorito
nano .env
# o
vim .env
# o
code .env
```

Luego reemplaza los valores de ejemplo con tus credenciales reales:

```env
SUPABASE_URL=https://tu-proyecto-real.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...tu-clave-real
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...tu-clave-secreta-real
ADMIN_EMAIL=tu-email@real.com
```

### Opción 2: Variables de sistema (Sin archivo)

```bash
# Exporta las variables en tu terminal
export SUPABASE_URL="https://tu-proyecto.supabase.co"
export SUPABASE_ANON_KEY="tu_clave_anonima"
export SUPABASE_SERVICE_ROLE_KEY="tu_clave_secreta"
export ADMIN_EMAIL="tu-email@example.com"

# Ejecuta tu app
npm start
```

**Nota:** Deberás exportar estas variables cada vez que abras una nueva terminal.

### Opción 3: Script interactivo seguro

```bash
# Crea un script que te pida las credenciales
cat > setup-env.sh << 'EOF'
#!/bin/bash
echo "🔐 Configuración segura de variables de entorno"
echo ""
read -p "SUPABASE_URL: " supabase_url
read -p "SUPABASE_ANON_KEY: " anon_key
read -sp "SUPABASE_SERVICE_ROLE_KEY (secreto): " service_key
echo ""
read -p "ADMIN_EMAIL: " admin_email

cat > .env << ENVFILE
SUPABASE_URL=$supabase_url
SUPABASE_ANON_KEY=$anon_key
SUPABASE_SERVICE_ROLE_KEY=$service_key
ADMIN_EMAIL=$admin_email
ENVFILE

echo "✅ Archivo .env creado correctamente"
EOF

chmod +x setup-env.sh
./setup-env.sh
```

---

## 🚀 Configuración en Producción (Vercel)

**IMPORTANTE:** En producción **NUNCA uses archivos `.env`**. Usa el dashboard de tu plataforma.

### Paso 1: Acceder a la configuración

1. Ve a [vercel.com/dashboard](https://vercel.com/dashboard)
2. Selecciona tu proyecto: `mtg-collection-sinergy`
3. Navega a: **Settings** → **Environment Variables**

### Paso 2: Agregar variables

Agrega cada variable con su valor correspondiente:

| Variable | Valor | Environments |
|----------|-------|--------------|
| `SUPABASE_URL` | `https://tuproyecto.supabase.co` | Production, Preview, Development |
| `SUPABASE_ANON_KEY` | `eyJ...` (tu clave anon) | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (tu clave secreta) | Production, Preview, Development |
| `ADMIN_EMAIL` | `tu-email@ejemplo.com` | Production |

### Paso 3: Redeploy

Después de agregar las variables:
1. Ve a **Deployments**
2. Click en el menú (⋮) del último deployment
3. Selecciona **Redeploy**
4. Las nuevas variables estarán disponibles

---

## ✅ Verificar Configuración

Usa el script de verificación incluido para comprobar que todo está configurado correctamente:

```bash
# Verifica las variables actuales
npm run verify:env

# O directamente
node verify-env.js
```

El script verificará:
- ✅ Que todas las variables requeridas existan
- ✅ Que tengan el formato correcto
- ✅ Que la conexión a Supabase funcione
- ✅ Que la SERVICE_ROLE_KEY tenga permisos correctos

### Ejemplo de salida correcta:

```
╔═══════════════════════════════════════════════════════╗
║  🔍 Verificación de Variables de Entorno            ║
╚═══════════════════════════════════════════════════════╝

📋 Variables Requeridas:
────────────────────────────────────────────────────────

✅ SUPABASE_URL: https://abcdefgh.supabase.co...
✅ SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIsInR5cCI6Ik...

📋 Variables Opcionales:
────────────────────────────────────────────────────────

✅ SUPABASE_SERVICE_ROLE_KEY: ***xyz123
✅ ADMIN_EMAIL: admin@ejemplo.com

🔍 Probando conexión a Supabase...
✅ Conexión exitosa a Supabase

🔐 Probando SERVICE_ROLE_KEY...
✅ SERVICE_ROLE_KEY funciona correctamente

════════════════════════════════════════════════════════

✅ TODAS LAS VARIABLES CONFIGURADAS CORRECTAMENTE
Tu proyecto está listo para funcionar 🚀
```

---

## 📋 Variables Explicadas

### Variables Requeridas

#### `SUPABASE_URL`
- **Descripción:** URL de tu proyecto Supabase
- **Ejemplo:** `https://abcdefgh.supabase.co`
- **Dónde encontrarla:** Supabase Dashboard → Settings → API → Project URL
- **¿Es secreta?** ❌ No, es pública

#### `SUPABASE_ANON_KEY`
- **Descripción:** Clave pública de Supabase (anon/public)
- **Ejemplo:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Dónde encontrarla:** Supabase Dashboard → Settings → API → anon public
- **¿Es secreta?** ❌ No, está diseñada para ser pública
- **Seguridad:** Protegida por Row Level Security (RLS) en Supabase

### Variables Opcionales (pero recomendadas)

#### `SUPABASE_SERVICE_ROLE_KEY`
- **Descripción:** Clave secreta con permisos completos
- **Ejemplo:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Dónde encontrarla:** Supabase Dashboard → Settings → API → service_role (secret)
- **¿Es secreta?** ✅ **SÍ, MUY IMPORTANTE**
- **Uso:** Solo para scripts administrativos
- **⚠️ NUNCA expongas esta clave en el frontend**

#### `ADMIN_EMAIL`
- **Descripción:** Email del primer administrador
- **Ejemplo:** `admin@ejemplo.com`
- **Uso:** Scripts de recuperación y configuración inicial
- **¿Es secreta?** ❌ No

---

## 🔒 Buenas Prácticas de Seguridad

### ✅ Hacer:
- Usar `.env` para desarrollo local
- Mantener `.env` en `.gitignore`
- Usar el dashboard de Vercel para producción
- Rotar claves periódicamente
- Usar `SUPABASE_SERVICE_ROLE_KEY` solo en backend/scripts
- Verificar la configuración con `npm run verify:env`

### ❌ NO Hacer:
- Subir archivos `.env` a GitHub
- Compartir claves en emails o chats
- Usar `SERVICE_ROLE_KEY` en el frontend
- Hardcodear credenciales en el código
- Usar las mismas claves para desarrollo y producción

---

## 🆘 Solución de Problemas

### Error: "Missing required environment variables"

```bash
# Verifica qué variables faltan
npm run verify:env

# Asegúrate de tener el archivo .env o las variables exportadas
ls -la .env
```

### Error: "Failed to connect to Supabase"

- Verifica que `SUPABASE_URL` sea correcta (debe incluir `https://`)
- Verifica que `SUPABASE_ANON_KEY` no tenga espacios ni saltos de línea
- Comprueba en Supabase Dashboard que el proyecto esté activo

### Error: "SERVICE_ROLE_KEY invalid"

- Asegúrate de copiar la clave completa (suelen ser muy largas)
- Verifica que sea la clave `service_role` y no la `anon`
- En Supabase: Settings → API → service_role key

### Las variables no se cargan en desarrollo local

```bash
# Asegúrate de que dotenv esté instalado
npm install dotenv

# Verifica que el archivo .env esté en la raíz del proyecto
pwd
ls -la .env
```

---

## 📚 Recursos Adicionales

- [Documentación de Supabase - API Keys](https://supabase.com/docs/guides/api)
- [Vercel - Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [12-Factor App - Config](https://12factor.net/config)
- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
