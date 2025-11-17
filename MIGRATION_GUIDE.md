# 🚀 Guía de Migración - Esquema Normalizado + Límites de Usuario

Esta guía te ayudará a migrar tu aplicación MTG Collection Synergy al nuevo esquema normalizado con paginación y límites por usuario.

---

## 📋 **Resumen de Cambios**

### **¿Qué cambia?**

#### **ANTES (Esquema Antiguo)**
```
Usuario A: Sol Ring (8KB completo)
Usuario B: Sol Ring (8KB completo) ← DUPLICADO
Usuario C: Sol Ring (8KB completo) ← DUPLICADO
---
Total: 24KB para la misma carta
```

#### **DESPUÉS (Esquema Nuevo)**
```
master_cards: Sol Ring (guardado UNA vez, 3KB optimizado)
user_collections:
  - user_a → sol_ring_id (40 bytes)
  - user_b → sol_ring_id (40 bytes)
  - user_c → sol_ring_id (40 bytes)
---
Total: ~3.12KB (ahorro del 87%)
```

### **Beneficios**
- ✅ **Ahorro de espacio**: 60-90% menos storage para cartas populares
- ✅ **Paginación**: Cargas rápidas incluso con 1000+ cartas
- ✅ **Límites configurables**: 500 cartas por defecto, personalizable desde admin
- ✅ **Optimización JSONB**: Cartas reducidas de ~8KB a ~3KB

---

## ⚠️ **ANTES DE EMPEZAR**

### **Prerequisitos**
1. ✅ Acceso al panel de Supabase SQL Editor
2. ✅ Backup de tu base de datos (recomendado)
3. ✅ Detener el servidor si está corriendo

### **Hacer Backup** (RECOMENDADO)
```bash
# Desde el SQL Editor de Supabase, ejecuta:
-- Backup de la tabla cards
CREATE TABLE cards_backup_manual AS SELECT * FROM cards;

-- Verificar que se copió correctamente
SELECT COUNT(*) FROM cards_backup_manual;
```

---

## 📝 **PASO 1: Ejecutar Migración SQL**

### **1.1 - Ve a Supabase SQL Editor**
1. Abre tu proyecto en [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Click en "SQL Editor" en el menú lateral
3. Click en "New query"

### **1.2 - Ejecuta la migración principal**

Copia y pega el contenido de `migrations/001_normalize_and_add_limits.sql` en el editor y ejecuta.

**⏱️ Tiempo estimado:** 1-5 minutos dependiendo del tamaño de tu BD

### **1.3 - Ejecuta la función de cartas populares**

Copia y pega el contenido de `migrations/002_add_popular_cards_function.sql` y ejecuta.

### **1.4 - Verificar migración exitosa**

Ejecuta este query para verificar:

```sql
-- Verificar que las tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('master_cards', 'user_collections', 'user_limits');

-- Debería retornar 3 filas

-- Contar datos migrados
SELECT
    (SELECT COUNT(*) FROM master_cards) AS unique_cards,
    (SELECT COUNT(*) FROM user_collections) AS total_in_collections,
    (SELECT COUNT(*) FROM user_limits) AS users_with_limits;

-- Verificar que no hay cartas duplicadas
SELECT card_id, user_id, COUNT(*)
FROM user_collections
GROUP BY card_id, user_id
HAVING COUNT(*) > 1;
-- Debería retornar 0 filas
```

---

## 🚀 **PASO 2: Desplegar Código Actualizado**

### **2.1 - Asegúrate de tener todos los cambios**

```bash
# Verifica que el server.js se actualizó
git status

# Debería mostrar modificaciones en:
# - server.js
# - migrations/001_normalize_and_add_limits.sql
# - migrations/002_add_popular_cards_function.sql
```

### **2.2 - Reiniciar el servidor**

```bash
# Si usas npm
npm start

# Si usas PM2
pm2 restart mtg-collection

# Si usas Docker
docker-compose restart
```

### **2.3 - Verificar que el servidor inició correctamente**

```bash
# Deberías ver en los logs:
# ✓ Server running on port 3000
# ✓ Using Supabase for data storage
```

---

## ✅ **PASO 3: Verificar Funcionamiento**

### **3.1 - Prueba la API de colección con paginación**

```bash
# Test: Obtener colección paginada (50 primeras cartas)
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/collection?limit=50&offset=0"

# Debería retornar:
# {
#   "cards": [...],
#   "total": X,
#   "hasMore": true/false,
#   "userLimit": {
#     "max_cards": 500,
#     "current_count": X,
#     "remaining": Y,
#     "usage_percentage": Z
#   }
# }
```

### **3.2 - Prueba los límites**

```bash
# Test: Ver tu límite actual
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/user/limit"

# Debería retornar:
# {
#   "max_cards": 500,
#   "current_count": X,
#   "remaining": Y,
#   "usage_percentage": Z
# }
```

### **3.3 - Prueba agregar cartas (con verificación de límite)**

```bash
# Test: Intentar agregar cartas
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cardNames": ["Lightning Bolt", "Sol Ring"]}' \
  "http://localhost:3000/api/collection"

# Si excedes el límite, debería retornar 403:
# {
#   "error": "Card limit exceeded",
#   "message": "You can only add 10 more card(s). You tried to add 50.",
#   "currentCount": 490,
#   "limit": 500,
#   "remaining": 10
# }
```

---

## 🔧 **PASO 4: Configurar Límites (Admin)**

### **4.1 - Verificar que eres admin**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3000/api/admin/check"

# Debería retornar: {"isAdmin": true}
```

### **4.2 - Ver estadísticas del sistema**

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/stats"

# Retorna ahorro de espacio y estadísticas
```

### **4.3 - Actualizar límite de un usuario**

```bash
curl -X PUT -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_cards": 1000,
    "reason": "Usuario premium - coleccionista activo"
  }' \
  "http://localhost:3000/api/admin/users/USER_UUID/limit"
```

### **4.4 - Ver todos los usuarios con límites**

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:3000/api/admin/users"

# Retorna lista con:
# - card_count
# - max_cards
# - usage_percentage
# - has_custom_limit
# - custom_limit_reason
```

---

## 📊 **Monitoreo Post-Migración**

### **Query útiles para monitorear**

```sql
-- Cartas más populares (más usuarios las tienen)
SELECT * FROM get_popular_cards(20);

-- Usuarios cerca del límite (>90% uso)
SELECT
    au.email,
    COUNT(uc.id) AS current_cards,
    COALESCE(ul.max_cards, 500) AS limit,
    ROUND((COUNT(uc.id)::NUMERIC / COALESCE(ul.max_cards, 500) * 100), 1) AS percent_used
FROM auth.users au
LEFT JOIN user_collections uc ON au.id = uc.user_id
LEFT JOIN user_limits ul ON au.id = ul.user_id
GROUP BY au.id, au.email, ul.max_cards
HAVING (COUNT(uc.id)::NUMERIC / COALESCE(ul.max_cards, 500) * 100) > 90
ORDER BY percent_used DESC;

-- Ahorro de espacio real
SELECT
    pg_size_pretty(pg_total_relation_size('cards_backup_old_schema')) AS old_schema_size,
    pg_size_pretty(
        pg_total_relation_size('master_cards') +
        pg_total_relation_size('user_collections')
    ) AS new_schema_size,
    ROUND(
        (1 - (
            (pg_total_relation_size('master_cards')::NUMERIC +
             pg_total_relation_size('user_collections')::NUMERIC) /
            pg_total_relation_size('cards_backup_old_schema')::NUMERIC
        )) * 100,
        2
    ) AS savings_percentage;
```

---

## 🐛 **Troubleshooting**

### **Error: "relation master_cards does not exist"**
- ✅ **Solución**: Ejecuta la migración `001_normalize_and_add_limits.sql`

### **Error: "function get_user_card_limit does not exist"**
- ✅ **Solución**: Ejecuta la migración completa (incluye las funciones SQL)

### **Las colecciones se ven vacías**
- ✅ **Verificación**:
  ```sql
  -- Ver si hay datos en user_collections
  SELECT COUNT(*) FROM user_collections;

  -- Ver si el JOIN funciona
  SELECT * FROM user_collection_with_cards LIMIT 5;
  ```

### **Los límites no se respetan**
- ✅ **Verificación**:
  ```sql
  -- Ver límites configurados
  SELECT * FROM user_limits;

  -- Probar la función manualmente
  SELECT get_user_card_limit('TU_USER_ID');
  SELECT can_user_add_cards('TU_USER_ID', 10);
  ```

---

## 🗑️ **Limpieza (Después de Verificar)**

Una vez que todo funcione correctamente por **al menos 1 semana**, puedes eliminar la tabla vieja:

```sql
-- ⚠️ SOLO DESPUÉS DE VERIFICAR QUE TODO FUNCIONA
DROP TABLE IF EXISTS cards_backup_old_schema;
```

---

## 📞 **Soporte**

Si encuentras problemas:
1. Revisa los logs del servidor: `pm2 logs` o `docker logs`
2. Verifica los queries en la sección de Troubleshooting
3. Abre un issue en GitHub con:
   - Mensaje de error completo
   - Query que estabas ejecutando
   - Versión de PostgreSQL (desde Supabase settings)

---

## 🎉 **¡Listo!**

Tu aplicación ahora tiene:
- ✅ Esquema normalizado (ahorro de 60-90% de espacio)
- ✅ Paginación (cargas rápidas)
- ✅ Límites configurables por usuario
- ✅ Optimización de almacenamiento JSONB

**Próximos pasos sugeridos:**
- Actualizar el frontend para mostrar barra de progreso de límite
- Agregar panel de admin UI para gestionar límites visualmente
- Implementar notificaciones cuando un usuario está cerca del límite
