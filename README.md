# 🎉 Clubio

Sistema integral de gestión para discotecas y clubes nocturnos.

## 🚀 Quick Start

### Prerrequisitos

- Node.js 20+
- pnpm 9+
- Docker y Docker Compose

### 1. Instalar dependencias

```bash
# Instalar pnpm si no lo tienes
npm install -g pnpm

# Instalar dependencias del proyecto
pnpm install
```

### 2. Levantar servicios (PostgreSQL, Redis)

```bash
docker-compose up -d
```

### 3. Configurar base de datos

```bash
# Generar cliente de Prisma
pnpm db:generate

# Crear tablas en la base de datos
pnpm db:push

# (Opcional) Cargar datos de prueba
pnpm --filter @clubio/api db:seed
```

### 4. Iniciar el servidor de desarrollo

```bash
# Solo API
pnpm api:dev

# O todos los servicios
pnpm dev
```

### 5. Verificar que funciona

```bash
# Health check
curl http://localhost:3000/api/health

# Login con usuario demo
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"admin123"}'
```

## 📁 Estructura del Proyecto

```
clubio/
├── apps/
│   ├── api/          # Backend Node.js + Express
│   ├── desktop/      # App Electron (TPV)
│   └── mobile/       # App React Native (Admin)
├── packages/
│   ├── shared-types/ # TypeScript types compartidos
│   └── shared-utils/ # Utilidades compartidas
├── docker-compose.yml
└── package.json
```

## 🔧 Scripts Disponibles

```bash
# Desarrollo
pnpm dev              # Iniciar todos los servicios
pnpm api:dev          # Solo API
pnpm desktop:dev      # Solo Desktop
pnpm mobile:dev       # Solo Mobile

# Base de datos
pnpm db:generate      # Generar Prisma Client
pnpm db:push          # Push schema a DB
pnpm db:migrate       # Crear migración
pnpm db:studio        # Abrir Prisma Studio

# Build
pnpm build            # Build de todos los proyectos
pnpm lint             # Linting
pnpm test             # Tests
```

## 🔑 API Endpoints

### Auth
- `POST /api/auth/register` - Registrar tenant + usuario
- `POST /api/auth/login` - Login con email/password
- `POST /api/auth/pin-login` - Login con PIN (para POS)
- `GET /api/auth/me` - Usuario actual
- `POST /api/auth/change-password` - Cambiar contraseña

### Venues
- `GET /api/venues` - Listar venues
- `GET /api/venues/:id` - Detalle de venue
- `POST /api/venues` - Crear venue
- `PUT /api/venues/:id` - Actualizar venue
- `DELETE /api/venues/:id` - Eliminar venue

### Users
- `GET /api/users` - Listar usuarios
- `GET /api/users/:id` - Detalle de usuario
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

### Health
- `GET /api/health` - Health check básico
- `GET /api/health/db` - Check de base de datos
- `GET /api/health/full` - Check completo

## 🔐 Autenticación

El API usa JWT para autenticación. Incluir el token en el header:

```
Authorization: Bearer <token>
```

## 🛠️ Herramientas de Desarrollo

- **Prisma Studio**: `pnpm db:studio` → http://localhost:5555
- **Adminer** (DB UI): http://localhost:8080
  - Sistema: PostgreSQL
  - Servidor: postgres (o localhost si accedes fuera de Docker)
  - Usuario: clubio
  - Contraseña: clubio123
  - Base de datos: clubio

## 📝 Credenciales de Demo

```
Email: admin@demo.com
Password: admin123
PIN: 1234
```

## 🤝 Contribuir

1. Crear branch: `git checkout -b feature/nueva-funcionalidad`
2. Commit: `git commit -m 'feat: agregar nueva funcionalidad'`
3. Push: `git push origin feature/nueva-funcionalidad`
4. Crear Pull Request

## 📄 Licencia

Propietario - Todos los derechos reservados.
