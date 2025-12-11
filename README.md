# Torneo de Pádel 2025 - Aplicación Web

Una aplicación web para gestionar torneos de pádel desarrollada con HTML, CSS, JavaScript y Firebase (plan Spark).

## Características

- 🔐 **Sistema de Autenticación**: Login y registro de usuarios
- 👥 **Dos tipos de usuarios**: 
  - **Super Usuario (SU)**: Administra y autoriza miembros
  - **Miembro**: Usuarios regulares del torneo
- 🛡️ **Sistema de Autorización**: Los SU deben aprobar a los miembros antes de que tengan acceso completo
- 📱 **Interfaz Responsiva**: Funciona en móviles y escritorio
- ⚡ **Tiempo Real**: Actualizaciones en tiempo real usando Firestore

## Estructura del Proyecto

```
TORNEO PADEL 2025/
├── index.html              # Página principal
├── css/
│   └── styles.css          # Estilos de la aplicación
├── js/
│   ├── firebase-config.js  # Configuración de Firebase
│   ├── auth.js            # Sistema de autenticación
│   ├── admin.js           # Funciones de administración
│   └── app.js             # Lógica principal de la app
└── README.md              # Este archivo
```

## Configuración Inicial

### 1. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o usa uno existente
3. Habilita **Authentication** con proveedores de Email/Password
4. Habilita **Firestore Database** en modo de prueba
5. Copia la configuración de tu proyecto

### 2. Configurar el Proyecto

1. Abre el archivo `js/firebase-config.js`
2. Reemplaza la configuración de Firebase con tu configuración real:

```javascript
const firebaseConfig = {
    apiKey: "tu-api-key",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto-id",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "tu-app-id"
};
```

### 3. Configurar Reglas de Firestore

En la Firebase Console, configura las siguientes reglas de seguridad para Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Reglas para perfiles de usuario
    match /userProfiles/{userId} {
      // Los usuarios pueden leer su propio perfil
      allow read: if request.auth != null && request.auth.uid == userId;
      
      // Los usuarios pueden crear su propio perfil (solo en registro)
      allow create: if request.auth != null && request.auth.uid == userId;
      
      // Solo Super Usuarios pueden actualizar estados y roles
      allow update: if request.auth != null && 
        (request.auth.uid == userId || 
         get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data.role == 'su');
      
      // Super Usuarios pueden leer todos los perfiles
      allow read: if request.auth != null && 
        get(/databases/$(database)/documents/userProfiles/$(request.auth.uid)).data.role == 'su';
    }
    
    // Agregar más reglas para otras colecciones según sea necesario
  }
}
```

### 4. Crear el Primer Super Usuario

Para crear el primer Super Usuario de forma segura:

1. Ve a [Firebase Console](https://console.firebase.google.com/project/padelpotatos)
2. En **Authentication** > **Users**, crea un usuario manualmente
3. En **Firestore Database**, ve a la colección `userProfiles`
4. Crea un documento con el UID del usuario y estos datos:

```javascript
{
  email: "admin@torneo.com",
  name: "Administrador Principal",
  role: "su",
  status: "approved",
  createdAt: // Timestamp automático
}
```

## Uso de la Aplicación

### Para Usuarios Nuevos

1. **Registro**: Los nuevos usuarios se registran como "Miembros"
2. **Estado Pendiente**: Después del registro, deben esperar aprobación
3. **Aprobación**: Un Super Usuario debe aprobar su solicitud
4. **Acceso**: Una vez aprobados, tienen acceso completo al torneo

### Para Super Usuarios

1. **Panel de Administración**: Acceso completo a la gestión de usuarios
2. **Solicitudes Pendientes**: Ver y gestionar nuevas solicitudes
3. **Miembros Aprobados**: Ver lista de miembros activos
4. **Acciones**: Aprobar, denegar o revocar acceso a usuarios

## Estados de Usuario

- **Pendiente**: Usuario registrado esperando aprobación
- **Aprobado**: Usuario con acceso completo al torneo
- **Denegado**: Usuario sin acceso (solicitud rechazada)

## Pestañas Principales

### 1. Administración
- Gestión de usuarios (solo SU)
- Estado de membresía (para miembros)
- Solicitudes pendientes y aprobadas

### 2. Torneo
- Información del torneo
- Funcionalidades específicas del torneo (a desarrollar)

## Próximas Funcionalidades

La aplicación está preparada para expandirse con:

- 🎾 Gestión de partidos y brackets
- 🏆 Sistema de puntuación
- 📊 Estadísticas de jugadores
- 📅 Calendario de partidos
- 💬 Sistema de notificaciones
- 📱 Aplicación móvil nativa

## Funciones de Debug

En la consola del navegador puedes usar:

```javascript
// Ver información del usuario actual
getCurrentUser()

// Ver estadísticas de usuarios (solo SU)
showUserStats()

// Refrescar la aplicación
refreshApp()
```

## Tecnologías Utilizadas

- **Frontend**: HTML5, CSS3, JavaScript ES6+
- **Backend**: Firebase Authentication + Firestore
- **Hosting**: Compatible con Firebase Hosting, Netlify, Vercel, etc.

## Estructura de Base de Datos

### Colección: `userProfiles`
```javascript
{
  email: "usuario@email.com",
  name: "Nombre Usuario",
  role: "member" | "su",
  status: "pending" | "approved" | "denied",
  createdAt: Timestamp,
  approvedAt: Timestamp (opcional),
  approvedBy: userId (opcional)
}
```

## Soporte

Para problemas o preguntas sobre la aplicación, contacta al administrador del torneo.

---

**Versión**: 1.0.0  
**Última actualización**: Diciembre 2025