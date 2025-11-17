#!/usr/bin/env node
/**
 * Script de verificación de variables de entorno
 * Verifica que todas las credenciales estén configuradas correctamente
 *
 * Uso:
 *   node verify-env.js                    # Verifica variables del sistema
 *   node verify-env.js --file .env        # Verifica desde archivo .env
 */

require('dotenv').config();

const REQUIRED_VARS = {
  SUPABASE_URL: {
    description: 'URL del proyecto Supabase',
    example: 'https://abcdefgh.supabase.co',
    isSecret: false
  },
  SUPABASE_ANON_KEY: {
    description: 'Clave pública anon de Supabase',
    example: 'eyJ... (clave larga)',
    isSecret: false
  }
};

const OPTIONAL_VARS = {
  SUPABASE_SERVICE_ROLE_KEY: {
    description: 'Clave secreta service_role (solo para scripts admin)',
    example: 'eyJ... (clave secreta)',
    isSecret: true,
    required_for: 'Scripts de administración'
  },
  ADMIN_EMAIL: {
    description: 'Email del administrador',
    example: 'admin@ejemplo.com',
    isSecret: false,
    required_for: 'Scripts de recuperación'
  }
};

// Colores para terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkVariable(name, config) {
  const value = process.env[name];

  if (!value) {
    return {
      status: 'missing',
      name,
      config
    };
  }

  // Validaciones básicas
  const validations = [];

  if (name === 'SUPABASE_URL') {
    if (!value.startsWith('https://')) {
      validations.push('❌ Debe empezar con https://');
    }
    if (!value.includes('supabase.co')) {
      validations.push('⚠️  No parece ser una URL de Supabase');
    }
  }

  if (name.includes('KEY')) {
    if (value.length < 50) {
      validations.push('⚠️  La clave parece muy corta');
    }
    if (!value.startsWith('eyJ')) {
      validations.push('⚠️  Las claves de Supabase suelen empezar con "eyJ"');
    }
  }

  if (name === 'ADMIN_EMAIL') {
    if (!value.includes('@')) {
      validations.push('❌ No parece ser un email válido');
    }
  }

  return {
    status: validations.length > 0 ? 'warning' : 'ok',
    name,
    value: config.isSecret ? '***' + value.slice(-4) : value.slice(0, 30) + '...',
    validations,
    config
  };
}

async function testSupabaseConnection() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { status: 'skipped', reason: 'Faltan credenciales' };
  }

  try {
    log('\n🔍 Probando conexión a Supabase...', 'cyan');

    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    if (response.ok) {
      return { status: 'ok', message: '✅ Conexión exitosa a Supabase' };
    } else {
      return {
        status: 'error',
        message: `❌ Error de conexión: ${response.status} ${response.statusText}`
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: `❌ Error: ${error.message}`
    };
  }
}

async function testServiceRoleKey() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return { status: 'skipped', reason: 'SERVICE_ROLE_KEY no configurada (opcional)' };
  }

  try {
    log('\n🔐 Probando SERVICE_ROLE_KEY...', 'cyan');

    const response = await fetch(`${url}/rest/v1/cards?select=count`, {
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`
      }
    });

    if (response.ok) {
      return { status: 'ok', message: '✅ SERVICE_ROLE_KEY funciona correctamente' };
    } else {
      return {
        status: 'error',
        message: `❌ SERVICE_ROLE_KEY no es válida: ${response.status}`
      };
    }
  } catch (error) {
    return {
      status: 'error',
      message: `❌ Error al probar SERVICE_ROLE_KEY: ${error.message}`
    };
  }
}

async function main() {
  log('\n╔═══════════════════════════════════════════════════════╗', 'cyan');
  log('║  🔍 Verificación de Variables de Entorno            ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════╝\n', 'cyan');

  // Verificar variables requeridas
  log('📋 Variables Requeridas:', 'bold');
  log('─'.repeat(60), 'blue');

  const requiredResults = Object.entries(REQUIRED_VARS).map(([name, config]) =>
    checkVariable(name, config)
  );

  requiredResults.forEach(result => {
    if (result.status === 'missing') {
      log(`\n❌ ${result.name}`, 'red');
      log(`   ${result.config.description}`, 'yellow');
      log(`   Ejemplo: ${result.config.example}`, 'cyan');
    } else if (result.status === 'warning') {
      log(`\n⚠️  ${result.name}: ${result.value}`, 'yellow');
      result.validations.forEach(v => log(`   ${v}`, 'yellow'));
    } else {
      log(`\n✅ ${result.name}: ${result.value}`, 'green');
    }
  });

  // Verificar variables opcionales
  log('\n\n📋 Variables Opcionales:', 'bold');
  log('─'.repeat(60), 'blue');

  const optionalResults = Object.entries(OPTIONAL_VARS).map(([name, config]) =>
    checkVariable(name, config)
  );

  optionalResults.forEach(result => {
    if (result.status === 'missing') {
      log(`\n⚪ ${result.name} (opcional)`, 'yellow');
      log(`   ${result.config.description}`, 'cyan');
      log(`   Necesaria para: ${result.config.required_for}`, 'cyan');
    } else if (result.status === 'warning') {
      log(`\n⚠️  ${result.name}: ${result.value}`, 'yellow');
      result.validations.forEach(v => log(`   ${v}`, 'yellow'));
    } else {
      log(`\n✅ ${result.name}: ${result.value}`, 'green');
    }
  });

  // Pruebas de conexión
  const connectionTest = await testSupabaseConnection();
  if (connectionTest.status === 'ok') {
    log(connectionTest.message, 'green');
  } else if (connectionTest.status === 'error') {
    log(connectionTest.message, 'red');
  } else {
    log(`\n⚪ ${connectionTest.reason}`, 'yellow');
  }

  const serviceRoleTest = await testServiceRoleKey();
  if (serviceRoleTest.status === 'ok') {
    log(serviceRoleTest.message, 'green');
  } else if (serviceRoleTest.status === 'error') {
    log(serviceRoleTest.message, 'red');
  } else {
    log(`\n⚪ ${serviceRoleTest.reason}`, 'yellow');
  }

  // Resumen final
  const missingRequired = requiredResults.filter(r => r.status === 'missing');
  const hasWarnings = [...requiredResults, ...optionalResults].some(r =>
    r.status === 'warning'
  );

  log('\n' + '═'.repeat(60), 'cyan');

  if (missingRequired.length > 0) {
    log('\n❌ FALTAN VARIABLES REQUERIDAS', 'red');
    log('\nPara configurar en Vercel:', 'yellow');
    log('1. Ve a https://vercel.com/dashboard', 'cyan');
    log('2. Selecciona tu proyecto', 'cyan');
    log('3. Settings → Environment Variables', 'cyan');
    log('4. Agrega las variables faltantes', 'cyan');
    log('5. Redeploy el proyecto\n', 'cyan');
    process.exit(1);
  } else if (hasWarnings || connectionTest.status === 'error') {
    log('\n⚠️  CONFIGURACIÓN COMPLETA CON ADVERTENCIAS', 'yellow');
    log('Revisa las advertencias arriba\n', 'yellow');
    process.exit(0);
  } else {
    log('\n✅ TODAS LAS VARIABLES CONFIGURADAS CORRECTAMENTE', 'green');
    log('Tu proyecto está listo para funcionar 🚀\n', 'green');
    process.exit(0);
  }
}

main().catch(error => {
  log(`\n❌ Error inesperado: ${error.message}`, 'red');
  process.exit(1);
});
