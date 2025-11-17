# 🏗️ Arquitectura del Sistema - MTG Collection Synergy

## 📐 **Esquema Normalizado de Base de Datos**

### **❓ Pregunta Original: ¿Dos usuarios con la misma carta = 2 cartas o 1 carta?**

**RESPUESTA:** Ahora es **1 carta compartida por múltiples usuarios** (esquema normalizado).

---

## 🔄 **Comparación: Antes vs Después**

### **ANTES - Esquema Duplicado** ❌

```
Tabla: cards
┌──────┬──────────┬───────────────────────────────────┐
│  id  │ user_id  │         card_data (JSONB)         │
├──────┼──────────┼───────────────────────────────────┤
│  1   │ Alice    │ {"id": "abc", "name": "Sol Ring", │
│      │          │  "mana_cost": "{1}", ... 8KB}     │
├──────┼──────────┼───────────────────────────────────┤
│  2   │ Bob      │ {"id": "abc", "name": "Sol Ring", │
│      │          │  "mana_cost": "{1}", ... 8KB}     │ ← DUPLICADO
├──────┼──────────┼───────────────────────────────────┤
│  3   │ Charlie  │ {"id": "abc", "name": "Sol Ring", │
│      │          │  "mana_cost": "{1}", ... 8KB}     │ ← DUPLICADO
└──────┴──────────┴───────────────────────────────────┘

🔴 Problema: 3 usuarios × 8KB = 24KB para la misma carta
🔴 Si 1000 usuarios tienen Sol Ring = 8 MB de duplicación
```

---

### **DESPUÉS - Esquema Normalizado** ✅

```
Tabla: master_cards (Cartas únicas del universo MTG)
┌────────────┬──────────┬─────────────────────────────────┐
│     id     │   name   │     card_data (JSONB optimizado)│
├────────────┼──────────┼─────────────────────────────────┤
│ "abc123"   │ Sol Ring │ {"id": "abc", "name": "Sol Ring"│
│            │          │  "mana_cost": "{1}", ... 3KB}   │ ← UNA SOLA VEZ
└────────────┴──────────┴─────────────────────────────────┘

Tabla: user_collections (Solo relaciones)
┌──────┬──────────┬──────────┬────────────┐
│  id  │ user_id  │ card_id  │  added_at  │
├──────┼──────────┼──────────┼────────────┤
│  1   │  Alice   │ "abc123" │ 2024-01-01 │ ← 40 bytes
├──────┼──────────┼──────────┼────────────┤
│  2   │  Bob     │ "abc123" │ 2024-01-02 │ ← 40 bytes
├──────┼──────────┼──────────┼────────────┤
│  3   │ Charlie  │ "abc123" │ 2024-01-03 │ ← 40 bytes
└──────┴──────────┴──────────┴────────────┘

✅ Total: 3KB (carta) + 120 bytes (relaciones) = ~3.12KB
✅ Ahorro: 87% para 3 usuarios
✅ Si 1000 usuarios tienen Sol Ring = 3KB + 40KB = 43KB (vs 8MB antes)
✅ Ahorro para cartas populares: ~99.5%
```

---

## 📊 **Ahorro de Espacio por Tipo de Carta**

| Tipo de Carta | Usuarios | ANTES | DESPUÉS | Ahorro |
|---------------|----------|-------|---------|--------|
| **Sol Ring** (muy popular) | 1000 | 8 MB | 43 KB | **99.5%** |
| **Lightning Bolt** (popular) | 500 | 4 MB | 23 KB | **99.4%** |
| **Carta rara** (pocas copias) | 3 | 24 KB | 3.12 KB | **87%** |
| **Carta única** (1 usuario) | 1 | 8 KB | 3 KB | **62.5%** (por optimización JSONB) |

**Conclusión:** Mientras más popular sea una carta, mayor es el ahorro.

---

## 🗄️ **Esquema Completo de Base de Datos**

```sql
-- ================================
-- TABLA 1: master_cards
-- ================================
-- Almacena cada carta única del universo MTG UNA SOLA VEZ
CREATE TABLE master_cards (
    id TEXT PRIMARY KEY,              -- Scryfall ID único
    name TEXT NOT NULL,               -- Nombre de la carta (búsquedas)
    card_data JSONB NOT NULL,         -- Datos optimizados (~3KB vs ~8KB)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_master_cards_name ON master_cards (LOWER(name));
CREATE INDEX idx_master_cards_updated ON master_cards (updated_at);

-- ================================
-- TABLA 2: user_collections
-- ================================
-- Relación N:N entre usuarios y cartas (solo referencias)
CREATE TABLE user_collections (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    card_id TEXT NOT NULL REFERENCES master_cards(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, card_id)          -- Prevenir duplicados
);

CREATE INDEX idx_user_collections_user_id ON user_collections (user_id);
CREATE INDEX idx_user_collections_card_id ON user_collections (card_id);

-- ================================
-- TABLA 3: user_limits
-- ================================
-- Límites personalizados por usuario (default: 500 cartas)
CREATE TABLE user_limits (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    max_cards INTEGER NOT NULL DEFAULT 500,
    custom_limit_reason TEXT,         -- Por qué tiene límite especial
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id)
);

-- ================================
-- TABLA 4: admins (ya existía)
-- ================================
CREATE TABLE admins (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id)
);
```

---

## 🔐 **Row Level Security (RLS)**

### **master_cards**
- ✅ **SELECT**: Cualquier usuario autenticado puede leer
- ❌ **INSERT/UPDATE/DELETE**: Solo el sistema (via backend)

### **user_collections**
- ✅ **SELECT**: Solo tu propia colección (+ admins ven todo)
- ✅ **INSERT**: Solo puedes agregar a tu propia colección
- ✅ **DELETE**: Solo puedes borrar de tu propia colección

### **user_limits**
- ✅ **SELECT**: Usuarios ven su propio límite (+ admins ven todos)
- ✅ **UPDATE/INSERT**: Solo admins pueden modificar límites

---

## 🚀 **Flujo de Agregar Carta**

### **ANTES (Duplicación)**
```
1. Usuario agrega "Sol Ring"
2. Backend llama a Scryfall API → obtiene ~8KB de JSON
3. Inserta en tabla `cards` con user_id
   ├─ Si 100 usuarios tienen Sol Ring
   └─ Se guarda 100 veces (800KB)
```

### **DESPUÉS (Normalizado)**
```
1. Usuario agrega "Sol Ring"
2. Backend llama a Scryfall API → obtiene ~8KB de JSON
3. Optimiza el JSON → reduce a ~3KB (solo campos necesarios)
4. UPSERT en master_cards:
   ├─ Si Sol Ring ya existe → no hace nada
   └─ Si Sol Ring es nueva → la guarda
5. INSERT en user_collections:
   └─ Solo guarda (user_id + card_id) → 40 bytes
```

**Resultado:**
- Primera vez que alguien agrega Sol Ring: 3KB guardados
- Usuario #1000 que agrega Sol Ring: solo 40 bytes adicionales

---

## 📈 **Capacidad del Sistema**

### **Con Esquema Antiguo (Duplicado)**
```
Free Tier Supabase: 500 MB

Escenario 1: Colecciones casuales (100 cartas/usuario)
  - 100 cartas × 8KB × 100 usuarios = 80 MB
  - Capacidad: ~600 usuarios

Escenario 2: Coleccionistas (1000 cartas/usuario)
  - 1000 cartas × 8KB × 50 usuarios = 400 MB
  - Capacidad: ~60 usuarios
```

### **Con Esquema Nuevo (Normalizado)**
```
Free Tier Supabase: 500 MB

Escenario 1: Colecciones casuales (100 cartas/usuario)
  - Cartas únicas: ~5000 cartas × 3KB = 15 MB
  - Relaciones: 100 × 100 usuarios × 40 bytes = 0.4 MB
  - Total: ~15.4 MB
  - Capacidad: ~3000 usuarios ✅ (5x mejora)

Escenario 2: Coleccionistas (1000 cartas/usuario)
  - Cartas únicas: ~15000 cartas × 3KB = 45 MB
  - Relaciones: 1000 × 100 usuarios × 40 bytes = 4 MB
  - Total: ~49 MB
  - Capacidad: ~1000 usuarios ✅ (16x mejora)
```

---

## 🎯 **Límites Recomendados por Usuario**

| Tipo de Usuario | Límite Sugerido | Razón |
|-----------------|----------------|-------|
| **Casual** | 500 cartas | Default seguro para usuarios normales |
| **Regular** | 1000 cartas | Coleccionistas activos |
| **Premium/Beta** | 2500 cartas | Usuarios especiales |
| **Comerciantes** | 5000 cartas | Tiendas o usuarios avanzados |
| **Máximo técnico** | 50,000 cartas | Límite absoluto (PostgreSQL) |

### **¿Por qué límites?**
1. **Prevenir abuso**: Sin límites, un usuario podría llenar la BD
2. **Garantizar UX**: Con 10,000+ cartas, la UI se vuelve lenta
3. **Fair usage**: Distribuir recursos equitativamente
4. **Monetización futura**: Premium users → límites más altos

---

## ⚡ **Paginación**

### **Problema Anterior**
```javascript
// Sin paginación - carga TODO
GET /api/collection
→ Retorna 1000 cartas × 8KB = 8MB de JSON en una sola respuesta
→ Tiempo de carga: 5-10 segundos en mobile
→ Navegador se traba procesando JSON
```

### **Solución Actual**
```javascript
// Con paginación
GET /api/collection?limit=50&offset=0
→ Retorna solo 50 cartas = ~150KB
→ Tiempo de carga: <1 segundo
→ Infinite scroll o botones de paginación

// Parámetros disponibles
?limit=50         // Cartas por página (max: 200)
?offset=0         // Cartas a saltar
?sortBy=name      // name | type | date
?sortOrder=asc    // asc | desc
```

---

## 🔧 **Optimización del JSONB**

### **Campos Guardados (Necesarios)**
```javascript
{
  id: "abc123",              // Scryfall ID
  name: "Lightning Bolt",
  mana_cost: "{R}",
  cmc: 1,
  type_line: "Instant",
  oracle_text: "...",
  colors: ["R"],
  color_identity: ["R"],
  keywords: [],
  legalities: {...},
  set: "lea",
  set_name: "Limited Edition Alpha",
  rarity: "common",
  image_uris: {...},
  prices: {...},
  scryfall_uri: "...",
  edhrec_rank: 123
}
// ~3KB
```

### **Campos Eliminados (Innecesarios)**
```javascript
// Estos campos de Scryfall NO se guardan:
- artist, artist_ids
- border_color, frame, layout
- multiverse_ids, mtgo_id, tcgplayer_id
- reserved, oversized, promo
- variation, digital
- full_art, textless
- ...y ~30 campos más

// Ahorro: ~5KB por carta
```

---

## 📊 **Queries Útiles**

### **Ver cartas más populares**
```sql
SELECT * FROM get_popular_cards(20);
-- Retorna las 20 cartas que más usuarios tienen
```

### **Ver espacio usado**
```sql
SELECT
    pg_size_pretty(pg_total_relation_size('master_cards')) AS master_cards_size,
    pg_size_pretty(pg_total_relation_size('user_collections')) AS collections_size;
```

### **Ver usuarios cerca del límite**
```sql
SELECT
    au.email,
    uc.card_count,
    ul.max_cards,
    ROUND((uc.card_count::NUMERIC / ul.max_cards * 100), 1) AS usage_pct
FROM auth.users au
LEFT JOIN (
    SELECT user_id, COUNT(*) as card_count
    FROM user_collections
    GROUP BY user_id
) uc ON au.id = uc.user_id
LEFT JOIN user_limits ul ON au.id = ul.user_id
WHERE (uc.card_count::NUMERIC / COALESCE(ul.max_cards, 500) * 100) > 90
ORDER BY usage_pct DESC;
```

---

## 🎉 **Resumen**

### **✅ Ventajas del Nuevo Esquema**
1. **Ahorro de espacio**: 60-99% dependiendo de popularidad de cartas
2. **Escalabilidad**: Soporta 10x más usuarios con mismo storage
3. **Rendimiento**: Paginación elimina cargas lentas
4. **Control**: Límites personalizables por usuario
5. **Mantenimiento**: Actualizar precios/datos es centralizado

### **❌ Desventajas (Mínimas)**
1. **Complejidad**: JOINs en queries (pero transparente para la app)
2. **Migración**: Requiere downtime de ~5 minutos

### **📈 ROI (Return on Investment)**
- Tiempo de migración: ~30 minutos
- Beneficio: Sistema soporta 10-16x más usuarios
- Ahorro de costos: Retrasa upgrade a plan pago por meses/años

---

## 🚀 **Próximos Pasos Sugeridos**

1. ✅ **Ejecutar migración** (ver MIGRATION_GUIDE.md)
2. ⚡ **Actualizar frontend** para mostrar barra de progreso de límite
3. 🎨 **Agregar UI de admin** para gestionar límites visualmente
4. 📧 **Notificaciones** cuando usuario está al 90% del límite
5. 💰 **Plan Premium** con límites más altos (monetización)
