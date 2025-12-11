# 🗄️ Base de Datos de Usuarios - Torneo Pádel 2025

## ¿La app crea una base de datos de usuarios? ¡SÍ! 

La aplicación utiliza **Firebase Firestore** como base de datos para almacenar toda la información de los usuarios.

## 📊 Estructura de la Base de Datos

### Colección: `userProfiles`

Cada usuario registrado crea automáticamente un documento en esta colección:

```javascript
// Documento por usuario (ID = Firebase Auth UID)
{
  email: "usuario@ejemplo.com",           // Email del usuario
  name: "Juan Pérez",                     // Nombre completo
  role: "member" | "su",                  // Rol: "member" o "su" (Super Usuario)
  status: "pending" | "approved" | "denied", // Estado de membresía
  createdAt: Timestamp,                   // Fecha de registro
  
  // Campos opcionales que se agregan según acciones:
  approvedAt: Timestamp,                  // Cuando fue aprobado
  approvedBy: "uid_del_admin",           // Quién lo aprobó
  deniedAt: Timestamp,                   // Cuando fue denegado
  deniedBy: "uid_del_admin",             // Quién lo denegó
  revokedAt: Timestamp,                  // Si se revocó el acceso
  revokedBy: "uid_del_admin"             // Quién revocó
}
```

## 🔄 Flujo de Creación de Usuarios

### 1. **Registro de Nuevo Usuario**
```
Usuario se registra → Firebase Auth crea cuenta → 
App crea documento en Firestore con status: "pending"
```

### 2. **Aprobación por Super Usuario**
```
SU revisa solicitud → Aprueba/Deniega → 
Firestore actualiza status y timestamp correspondiente
```

### 3. **Estados Posibles**
- **`pending`**: Usuario nuevo esperando aprobación
- **`approved`**: Miembro con acceso completo al torneo
- **`denied`**: Acceso denegado/revocado

## 🛡️ Seguridad de la Base de Datos

Las **reglas de Firestore** (en `firestore.rules`) garantizan que:

- ✅ Los usuarios solo pueden leer su propio perfil
- ✅ Los usuarios solo pueden crear perfiles como "member" con status "pending"
- ✅ Solo Super Usuarios pueden modificar roles y estados
- ✅ Los Super Usuarios pueden leer todos los perfiles
- ❌ Nadie puede modificarse su propio rol o status

## 📈 Funciones de la Base de Datos

### **Lectura Automática:**
- Al hacer login, se carga automáticamente el perfil del usuario
- Los Super Usuarios ven listas actualizadas en tiempo real

### **Escritura Controlada:**
- Nuevos registros: Solo como "member" + "pending"
- Actualizaciones de estado: Solo por Super Usuarios
- Timestamps automáticos para auditoría

### **Consultas Optimizadas:**
```javascript
// Usuarios pendientes
db.collection('userProfiles')
  .where('status', '==', 'pending')
  .orderBy('createdAt', 'desc')

// Miembros aprobados
db.collection('userProfiles')
  .where('status', '==', 'approved')
  .where('role', '==', 'member')
```

## 💾 Datos que se Almacenan

### **Al Registrarse:**
- Email, nombre, fecha de registro
- Rol automático: "member"
- Status automático: "pending"

### **Durante Administración:**
- Fechas de aprobación/denegación
- ID del administrador que tomó la decisión
- Historial de cambios de estado

### **En el Futuro (expansión):**
- Estadísticas de partidos
- Historial de torneos
- Puntuaciones y rankings
- Configuraciones personales

## 🔒 Privacidad y Cumplimiento

- **Solo se almacena información esencial** para el funcionamiento
- **No se almacenan contraseñas** (manejadas por Firebase Auth)
- **Acceso controlado** por reglas de seguridad
- **Auditoría completa** con timestamps de todas las acciones

La base de datos está diseñada para ser **escalable**, **segura** y **eficiente** para manejar el crecimiento del torneo. 🚀