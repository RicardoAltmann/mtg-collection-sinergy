# Guía de Administración - MTG Collection Synergy

Esta guía explica cómo configurar y usar las funciones de administración en la aplicación MTG Collection Synergy.

## Tabla de Contenidos

- [Configuración Inicial](#configuración-inicial)
- [Crear el Primer Administrador](#crear-el-primer-administrador)
- [Panel de Administración](#panel-de-administración)
- [Funciones Disponibles](#funciones-disponibles)
- [API de Administración](#api-de-administración)
- [Seguridad](#seguridad)

## Configuración Inicial

### 1. Configurar la Base de Datos

Antes de usar las funciones de administración, necesitas ejecutar el schema SQL en tu base de datos Supabase:

1. Ve a tu proyecto en Supabase
2. Navega a **SQL Editor**
3. Ejecuta el contenido completo del archivo `supabase-schema.sql`

Esto creará:
- Tabla `admins` para almacenar los administradores
- Funciones helper para verificar privilegios
- Políticas RLS para controlar el acceso

### 2. Configurar Variables de Entorno

Para usar el script de creación de administrador, necesitas la **service role key** de Supabase:

1. Ve a tu proyecto en Supabase
2. Navega a **Settings → API**
3. Copia el valor de **service_role** (es un secreto, ¡no lo compartas!)
4. Agrégalo a tu archivo `.env`:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu_clave_anonima
SUPABASE_SERVICE_ROLE_KEY=tu_clave_service_role
```

## Crear el Primer Administrador

### Opción 1: Usar el Script Automatizado (Recomendado)

El script `make-first-admin.js` facilita la creación del primer administrador:

```bash
# Instalar dependencias si aún no lo has hecho
npm install

# Usar el email por defecto (ricardo.altmann@gmail.com)
npm run admin:make-first

# O especificar un email diferente
node scripts/make-first-admin.js otro.usuario@example.com
```

**Importante:** El usuario debe estar registrado en la aplicación antes de ejecutar este script.

### Opción 2: Manualmente desde SQL Editor

Si prefieres hacerlo manualmente:

1. Encuentra el UUID del usuario en Supabase:
   ```sql
   SELECT id, email FROM auth.users WHERE email = 'tu-email@example.com';
   ```

2. Inserta el registro en la tabla de admins:
   ```sql
   INSERT INTO admins (user_id, granted_by)
   VALUES ('uuid-del-usuario', NULL);
   ```

## Panel de Administración

### Acceder al Panel

Una vez que un usuario es administrador:

1. Inicia sesión con tu cuenta de administrador
2. Verás un botón **🛡️ Admin** en la esquina superior derecha
3. Haz clic en el botón para abrir el panel de administración

### Interfaz del Panel

El panel tiene dos pestañas principales:

#### 1. Estadísticas

Muestra información general del sistema:

- **Usuarios Totales**: Número total de usuarios registrados
- **Cartas en Colecciones**: Total de cartas guardadas en todas las colecciones
- **Cartas Únicas**: Número de cartas diferentes (sin duplicados)
- **Administradores**: Cantidad de usuarios con privilegios de admin
- **Promedio Cartas/Usuario**: Media de cartas por usuario

#### 2. Usuarios

Tabla completa de todos los usuarios con:

- Email
- Número de cartas en su colección
- Estado de administrador
- Fecha de registro
- Último acceso

**Acciones disponibles por usuario:**

- **Ver Colección**: Muestra las cartas en la colección del usuario
- **Hacer Admin**: Otorga privilegios de administrador (solo para usuarios no-admin)
- **Revocar Admin**: Quita privilegios de administrador (no puedes revocarte a ti mismo)

## Funciones Disponibles

### Para Administradores

Los administradores tienen acceso especial a:

1. **Ver todas las colecciones**: Pueden ver las cartas de cualquier usuario
2. **Gestionar otros admins**: Pueden otorgar o revocar privilegios de admin
3. **Estadísticas del sistema**: Acceso a métricas globales
4. **Eliminar cartas de cualquier usuario**: A través de las políticas RLS

### Permisos por Rol

| Acción | Usuario Normal | Administrador |
|--------|---------------|---------------|
| Ver su propia colección | ✅ | ✅ |
| Ver colecciones de otros | ❌ | ✅ |
| Modificar su colección | ✅ | ✅ |
| Eliminar cartas propias | ✅ | ✅ |
| Eliminar cartas de otros | ❌ | ✅ |
| Ver estadísticas globales | ❌ | ✅ |
| Otorgar privilegios admin | ❌ | ✅ |
| Revocar privilegios admin | ❌ | ✅ |

## API de Administración

### Endpoints Disponibles

Todos los endpoints requieren autenticación con token Bearer en el header `Authorization`.

#### `GET /api/admin/check`

Verifica si el usuario actual es administrador.

**Response:**
```json
{
  "isAdmin": true,
  "userId": "uuid-del-usuario",
  "email": "admin@example.com"
}
```

#### `GET /api/admin/stats`

Obtiene estadísticas del sistema (requiere privilegios admin).

**Response:**
```json
{
  "totalUsers": 25,
  "totalCards": 1500,
  "totalAdmins": 2,
  "uniqueCards": 850,
  "averageCardsPerUser": "60.00"
}
```

#### `GET /api/admin/users`

Lista todos los usuarios con sus estadísticas (requiere privilegios admin).

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-15T10:30:00Z",
    "last_sign_in_at": "2024-01-20T14:20:00Z",
    "card_count": 75,
    "is_admin": false
  }
]
```

#### `GET /api/admin/user/:userId/collection`

Obtiene la colección de un usuario específico (requiere privilegios admin).

**Response:**
```json
{
  "userId": "uuid",
  "totalCards": 75,
  "cards": [
    { "name": "Lightning Bolt", "type_line": "Instant", ... }
  ]
}
```

#### `POST /api/admin/grant`

Otorga privilegios de administrador a un usuario (requiere privilegios admin).

**Request:**
```json
{
  "userId": "uuid-del-usuario"
}
```

**Response:**
```json
{
  "message": "Admin privileges granted successfully"
}
```

#### `DELETE /api/admin/revoke/:userId`

Revoca privilegios de administrador (requiere privilegios admin).

**Restricciones:**
- No puedes revocarte a ti mismo

**Response:**
```json
{
  "message": "Admin privileges revoked successfully"
}
```

### Usar la API desde JavaScript

```javascript
// Obtener headers de autenticación
import { getAuthHeaders } from './api/supabase.js';

// Verificar si soy admin
const headers = await getAuthHeaders();
const response = await fetch('/api/admin/check', { headers });
const data = await response.json();
console.log('Soy admin?', data.isAdmin);

// Obtener estadísticas
const statsResponse = await fetch('/api/admin/stats', { headers });
const stats = await statsResponse.json();
console.log('Estadísticas:', stats);

// Hacer a alguien admin
await fetch('/api/admin/grant', {
  method: 'POST',
  headers: {
    ...headers,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ userId: 'uuid-del-usuario' })
});
```

## Seguridad

### Protección de Datos

1. **Row Level Security (RLS)**: Las políticas de RLS en Supabase garantizan que:
   - Los usuarios solo pueden ver sus propias cartas (a menos que sean admin)
   - Los admins pueden ver todas las cartas
   - Solo los admins pueden otorgar privilegios

2. **Autenticación Requerida**: Todos los endpoints admin requieren:
   - Token de autenticación válido
   - Verificación de privilegios de admin en cada request

3. **Service Role Key**:
   - Solo se usa en scripts del lado del servidor
   - NUNCA debe exponerse al cliente
   - Permite operaciones administrativas sin restricciones RLS

### Mejores Prácticas

1. **Limitación de Admins**:
   - Solo otorga privilegios admin a usuarios de confianza
   - Mantén un número mínimo de administradores

2. **Auditoría**:
   - La tabla `admins` registra quién otorgó los privilegios (`granted_by`)
   - Revisa regularmente la lista de administradores

3. **Service Role Key**:
   - Guárdala en variables de entorno
   - No la incluyas en el control de versiones
   - Rotarla periódicamente desde el dashboard de Supabase

4. **Monitoreo**:
   - Revisa los logs de Supabase regularmente
   - Verifica actividad inusual en las tablas admin

## Troubleshooting

### "relation admins does not exist"

**Problema**: La tabla de admins no existe en la base de datos.

**Solución**: Ejecuta el archivo `supabase-schema.sql` completo en el SQL Editor de Supabase.

### "User not found"

**Problema**: El usuario no está registrado en la aplicación.

**Solución**: El usuario debe registrarse primero en la aplicación antes de poder ser marcado como admin.

### "Admin privileges required"

**Problema**: Intentas acceder a un endpoint admin sin privilegios.

**Solución**: Verifica que tu usuario esté en la tabla `admins`:
```sql
SELECT * FROM admins WHERE user_id = 'tu-user-id';
```

### El botón Admin no aparece

**Problema**: No ves el botón de admin en la UI.

**Solución**:
1. Verifica que estés autenticado
2. Comprueba que tu usuario esté en la tabla `admins`
3. Recarga la página después de ser marcado como admin

## Soporte

Si encuentras problemas o tienes preguntas sobre las funciones de administración, por favor:

1. Revisa esta documentación
2. Verifica los logs del servidor
3. Consulta los logs de Supabase en el Dashboard
4. Abre un issue en el repositorio del proyecto
