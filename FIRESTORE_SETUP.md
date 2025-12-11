# 🔥 Configuración de Firestore Rules

## ⚠️ IMPORTANTE: Configura las reglas en Firebase Console

### 1. Ve a Firebase Console
- https://console.firebase.google.com/project/padelpotatos
- Firestore Database > Rules

### 2. Copia y pega estas reglas TEMPORALES para desarrollo:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // REGLAS TEMPORALES PARA DESARROLLO INICIAL
    // Permitir lectura y escritura para usuarios autenticados
    match /userProfiles/{userId} {
      allow read, write: if request.auth != null;
    }
    
    // Denegar todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 3. Después de crear el primer Super Usuario, usa estas reglas PRODUCTIVAS:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    match /userProfiles/{userId} {
      // Los usuarios pueden leer su propio perfil
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Los usuarios pueden crear su propio perfil
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // Los usuarios pueden actualizar su propio nombre
      allow update: if request.auth != null && 
                      request.auth.uid == userId &&
                      request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(['name']);
      
      // Super Usuarios pueden leer todos los perfiles
      allow read: if request.auth != null && 
                    exists(/databases/$(database)/documents/userProfiles/$(request.auth.uid)) &&
                    get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data.role == 'su';
      
      // Super Usuarios pueden actualizar cualquier perfil
      allow update: if request.auth != null && 
                      exists(/databases/$(database)/documents/userProfiles/$(request.auth.uid)) &&
                      get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data.role == 'su';
      
      // Permitir listado para Super Usuarios
      allow list: if request.auth != null && 
                    exists(/databases/$(database)/documents/userProfiles/$(request.auth.uid)) &&
                    get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data.role == 'su';
    }
    
    // Denegar todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 🚀 Pasos para Solucionar el Error:

1. **Configura las reglas temporales** (arriba) en Firebase Console
2. **Habilita Authentication** con Email/Password
3. **Prueba el registro** de un nuevo usuario
4. **Crea el primer Super Usuario** manualmente en Firebase Console
5. **Actualiza a las reglas productivas** una vez que tengas el primer SU

## 📋 Crear Primer Super Usuario Manualmente:

1. **Authentication > Users > Add user**
   - Email: admin@tudominio.com
   - Password: (elige una segura)

2. **Firestore > userProfiles > Add document**
   - Document ID: (copia el UID del usuario de Authentication)
   - Fields:
     ```
     email: "admin@tudominio.com"
     name: "Administrador"
     role: "su"
     status: "approved"
     createdAt: (timestamp actual)
     ```

¡Esto solucionará el error de permisos! 🎯