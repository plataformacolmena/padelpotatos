# 🔧 SOLUCIÓN RÁPIDA: Error de Permisos en Partidos

## ❌ Error: "Missing or insufficient permissions"

Este error aparece porque la colección `matches` no tiene permisos configurados en Firestore.

## ✅ SOLUCIÓN INMEDIATA (3 pasos)

### 📋 PASO 1: Ve a Firebase Console
Accede a: https://console.firebase.google.com/project/padelpotatos/firestore/rules

### 📋 PASO 2: Reemplaza las reglas actuales
**Borra todo** el contenido actual y **copia exactamente esto**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // REGLAS TEMPORALES PARA DESARROLLO
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 📋 PASO 3: Publicar las reglas
1. Haz clic en **"Publish"** 
2. Espera la confirmación
3. Recarga la aplicación: https://padelpotatos.web.app

## ⚠️ IMPORTANTE

**Estas reglas son temporales y muy permisivas.**  
Son perfectas para desarrollo inicial, pero deberás usar reglas más restrictivas en producción.

## 🧪 VERIFICACIÓN

Después de aplicar las reglas:

1. **Recarga la app**: https://padelpotatos.web.app
2. **Inicia sesión** como Super Usuario
3. **Ve a Administración** → debería cargar sin errores
4. **Ve a Torneo** → debería mostrar "No hay partidos programados"

## 📱 Si el error persiste:

### Opción A: Verificar Authentication
- Firebase Console → Authentication
- Asegúrate que "Email/Password" esté habilitado

### Opción B: Limpiar cache del navegador
- Ctrl+Shift+R (Windows/Linux)
- Cmd+Shift+R (Mac)

### Opción C: Verificar en Consola del navegador
1. F12 → Console
2. Busca errores adicionales
3. Reporta cualquier error diferente

## 🎯 Reglas de Producción (Para más adelante)

Una vez que tengas todo funcionando, puedes usar reglas más seguras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Perfiles de usuario
    match /userProfiles/{userId} {
      allow read, write: if request.auth != null;
    }
    
    // Partidos - acceso completo para usuarios autenticados
    match /matches/{matchId} {
      allow read, write: if request.auth != null;
    }
    
    // Denegar todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 💬 ¿Necesitas ayuda?

Si el error continúa:
1. Comparte screenshot de Firebase Console → Firestore → Rules
2. Comparte cualquier error de la Consola del navegador (F12)
3. Confirma que Authentication está habilitado

**¡Con estos pasos el sistema de partidos debería funcionar perfectamente!** 🎾