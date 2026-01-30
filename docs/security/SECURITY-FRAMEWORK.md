# Clubiio Security Framework

**Version:** 1.0.0
**Last Updated:** 2026-01-29
**Owner:** Security Team
**Review Cycle:** Quarterly

---

## 1. Executive Summary

Este documento establece el marco de seguridad de Clubiio, alineado con:
- **NIST Cybersecurity Framework (CSF) 2.0** - Estructura del programa
- **CIS Controls v8.1** - Checklist priorizado y accionable
- **ISO/IEC 27001:2022** - Estándar de gestión de seguridad

---

## 2. NIST CSF 2.0 - Estructura del Programa

### 2.1 GOVERN (GV) - Gobernanza

| Control ID | Control | Estado | Responsable | Evidencia |
|------------|---------|--------|-------------|-----------|
| GV.OC-01 | Contexto organizacional documentado | 🟡 Parcial | CTO | Este documento |
| GV.RM-01 | Estrategia de gestión de riesgos | 🔴 Pendiente | CTO | - |
| GV.RM-02 | Tolerancia al riesgo definida | 🔴 Pendiente | CEO/CTO | - |
| GV.PO-01 | Políticas de ciberseguridad | 🟡 Parcial | Security Lead | - |
| GV.RR-01 | Roles y responsabilidades | 🔴 Pendiente | HR/CTO | - |
| GV.SC-01 | Gestión de riesgos de cadena de suministro | 🔴 Pendiente | DevOps | - |

### 2.2 IDENTIFY (ID) - Identificar

| Control ID | Control | Estado | Responsable | Evidencia |
|------------|---------|--------|-------------|-----------|
| ID.AM-01 | Inventario de activos de hardware | 🟢 Implementado | DevOps | Cloud inventory |
| ID.AM-02 | Inventario de activos de software | 🟡 Parcial | DevOps | package.json |
| ID.AM-03 | Mapeo de flujos de datos | 🔴 Pendiente | Arquitecto | - |
| ID.RA-01 | Vulnerabilidades identificadas | 🟡 Parcial | Security | Audit report |
| ID.RA-02 | Inteligencia de amenazas | 🔴 Pendiente | Security | - |

### 2.3 PROTECT (PR) - Proteger

| Control ID | Control | Estado | Responsable | Evidencia |
|------------|---------|--------|-------------|-----------|
| PR.AA-01 | Gestión de identidades | 🟢 Implementado | Backend | JWT + RBAC |
| PR.AA-02 | Autenticación | 🟡 Parcial | Backend | Falta MFA |
| PR.AA-03 | Gestión de accesos | 🟢 Implementado | Backend | RBAC middleware |
| PR.DS-01 | Protección de datos en reposo | 🔴 Pendiente | DevOps | - |
| PR.DS-02 | Protección de datos en tránsito | 🟢 Implementado | DevOps | TLS |
| PR.PS-01 | Configuración segura | 🔴 Pendiente | DevOps | Falta hardening |
| PR.PS-02 | Gestión de software | 🟡 Parcial | DevOps | Falta SCA |
| PR.IR-01 | Gestión de incidentes | 🔴 Pendiente | Security | - |

### 2.4 DETECT (DE) - Detectar

| Control ID | Control | Estado | Responsable | Evidencia |
|------------|---------|--------|-------------|-----------|
| DE.CM-01 | Monitoreo de red | 🔴 Pendiente | DevOps | - |
| DE.CM-02 | Monitoreo de ambiente físico | N/A | - | Cloud-based |
| DE.CM-03 | Monitoreo de personal | 🔴 Pendiente | HR/Security | - |
| DE.AE-01 | Línea base de actividad | 🔴 Pendiente | DevOps | - |
| DE.AE-02 | Análisis de eventos | 🔴 Pendiente | Security | - |

### 2.5 RESPOND (RS) - Responder

| Control ID | Control | Estado | Responsable | Evidencia |
|------------|---------|--------|-------------|-----------|
| RS.MA-01 | Plan de gestión de incidentes | 🔴 Pendiente | Security | - |
| RS.AN-01 | Análisis de incidentes | 🔴 Pendiente | Security | - |
| RS.MI-01 | Mitigación de incidentes | 🔴 Pendiente | Security | - |
| RS.CO-01 | Comunicación de incidentes | 🔴 Pendiente | Legal/PR | - |

### 2.6 RECOVER (RC) - Recuperar

| Control ID | Control | Estado | Responsable | Evidencia |
|------------|---------|--------|-------------|-----------|
| RC.RP-01 | Plan de recuperación | 🔴 Pendiente | DevOps | - |
| RC.CO-01 | Comunicación de recuperación | 🔴 Pendiente | PR | - |

---

## 3. CIS Controls v8.1 - Checklist Priorizado

### Grupo de Implementación 1 (IG1) - Higiene Básica

| CIS # | Control | Prioridad | Estado | Sprint | Owner |
|-------|---------|-----------|--------|--------|-------|
| 1.1 | Inventario de activos empresariales | Alta | 🟡 | Q1 | DevOps |
| 2.1 | Inventario de software autorizado | Alta | 🟡 | Q1 | DevOps |
| 3.1 | Protección de datos | Crítica | 🔴 | **S1** | Backend |
| 4.1 | Configuración segura de activos | Alta | 🔴 | S2 | DevOps |
| 4.2 | Configuración segura de software | Alta | 🔴 | S2 | Backend |
| 5.1 | Gestión de cuentas | Crítica | 🟢 | - | Backend |
| 5.2 | Usar contraseñas únicas | Alta | 🟢 | - | Backend |
| 5.3 | Deshabilitar cuentas inactivas | Media | 🔴 | S3 | Backend |
| 5.4 | Restringir privilegios de admin | Alta | 🟢 | - | Backend |
| 6.1 | Gestión de accesos | Crítica | 🟢 | - | Backend |
| 6.2 | MFA para acceso externo | **Crítica** | 🔴 | **S1** | Backend |
| 6.3 | MFA para acceso administrativo | **Crítica** | 🔴 | **S1** | Backend |
| 7.1 | Proceso de gestión de vulnerabilidades | Alta | 🔴 | S2 | Security |
| 8.1 | Gestión de logs de auditoría | **Crítica** | 🔴 | **S1** | Backend |
| 8.2 | Recolección de logs | Alta | 🔴 | S2 | DevOps |
| 9.1 | Protección de email y navegador | Media | N/A | - | - |
| 10.1 | Defensa contra malware | Media | 🟡 | S3 | DevOps |
| 11.1 | Recuperación de datos | Alta | 🔴 | S2 | DevOps |
| 12.1 | Gestión de infraestructura de red | Media | 🟡 | S3 | DevOps |
| 13.1 | Monitoreo de red | Alta | 🔴 | S3 | DevOps |
| 14.1 | Concientización de seguridad | Media | 🔴 | Q2 | HR |
| 15.1 | Gestión de proveedores de servicios | Media | 🔴 | Q2 | Legal |
| 16.1 | Seguridad de software de aplicación | **Crítica** | 🔴 | **S1** | Backend |
| 17.1 | Gestión de respuesta a incidentes | Alta | 🔴 | S2 | Security |
| 18.1 | Pruebas de penetración | Alta | 🔴 | Q2 | Security |

### Leyenda de Estado
- 🟢 Implementado
- 🟡 Parcialmente implementado
- 🔴 No implementado / Pendiente
- **S1** = Sprint 1 (Urgente - 2 semanas)
- S2 = Sprint 2 (Alto - 1 mes)
- S3 = Sprint 3 (Medio - 2 meses)
- Q2 = Quarter 2

---

## 4. Roadmap de Implementación

### Sprint 1 - CRÍTICO (Semanas 1-2)

**Objetivo:** Corregir vulnerabilidades críticas antes de producción

| # | Tarea | CIS Control | Archivo | Esfuerzo |
|---|-------|-------------|---------|----------|
| 1 | Eliminar JWT secret por defecto | 4.2 | config/index.ts | 0.5h |
| 2 | Implementar rate limiting | 16.1 | middleware/rate-limit.ts | 4h |
| 3 | Autenticar Socket.io | 6.1 | index.ts | 3h |
| 4 | Agregar Helmet.js | 4.2 | index.ts | 1h |
| 5 | Implementar CSRF protection | 16.1 | middleware/csrf.ts | 2h |
| 6 | Audit logging básico | 8.1 | middleware/audit.ts | 4h |
| 7 | Account lockout | 5.3, 6.2 | auth.service.ts | 3h |
| 8 | Sanitización XSS | 16.1 | middleware/sanitize.ts | 2h |

**Total estimado:** 19.5 horas

### Sprint 2 - ALTO (Semanas 3-4)

| # | Tarea | CIS Control | Esfuerzo |
|---|-------|-------------|----------|
| 1 | Implementar MFA (TOTP) | 6.2, 6.3 | 8h |
| 2 | Refresh tokens | 6.1 | 4h |
| 3 | Secret rotation | 4.2 | 4h |
| 4 | Structured logging (Winston) | 8.2 | 4h |
| 5 | Error handling mejorado | 16.1 | 3h |
| 6 | SAST en CI/CD | 16.1 | 4h |
| 7 | Dependency scanning | 2.1 | 2h |

**Total estimado:** 29 horas

### Sprint 3 - MEDIO (Semanas 5-8)

| # | Tarea | CIS Control | Esfuerzo |
|---|-------|-------------|----------|
| 1 | WAF configuration | 13.1 | 8h |
| 2 | Database encryption at rest | 3.1 | 4h |
| 3 | Secrets Manager integration | 4.2 | 6h |
| 4 | Network segmentation | 12.1 | 8h |
| 5 | Backup & recovery testing | 11.1 | 6h |
| 6 | Incident response plan | 17.1 | 8h |

**Total estimado:** 40 horas

---

## 5. Controles Técnicos Específicos

### 5.1 Identidad y Accesos (IAM)

#### Implementado ✅
- JWT-based authentication
- Password hashing (bcrypt, 12 rounds)
- Role-Based Access Control (RBAC)
- Tenant isolation
- PIN authentication for POS

#### Pendiente 🔴
```
[ ] MFA obligatorio para admins
[ ] MFA opcional para staff
[ ] Account lockout (5 intentos = 15 min bloqueo)
[ ] Login attempt tracking
[ ] Refresh token rotation
[ ] Session revocation
[ ] SSO/OIDC integration
[ ] Just-in-time access elevation
```

### 5.2 API Security (OWASP API Top 10 2023)

| # | Vulnerabilidad | Estado | Mitigación |
|---|---------------|--------|------------|
| API1 | BOLA (Broken Object Level Auth) | 🟢 | Tenant filtering |
| API2 | Broken Authentication | 🟡 | JWT ok, falta MFA/rate limit |
| API3 | BOPLA (Broken Object Property Level Auth) | 🟢 | Zod validation |
| API4 | Unrestricted Resource Consumption | 🔴 | Sin rate limiting |
| API5 | BFLA (Broken Function Level Auth) | 🟢 | RBAC middleware |
| API6 | Unrestricted Access to Sensitive Flows | 🔴 | Sin CSRF |
| API7 | Server Side Request Forgery | 🟢 | Sin URLs externas |
| API8 | Security Misconfiguration | 🔴 | Sin headers |
| API9 | Improper Inventory Management | 🔴 | Sin documentación |
| API10 | Unsafe Consumption of APIs | 🟢 | Sin APIs externas |

### 5.3 Base de Datos

#### Implementado ✅
- TLS en tránsito
- Parameterized queries (Prisma ORM)
- Row-level tenant isolation

#### Pendiente 🔴
```
[ ] Encryption at rest
[ ] KMS key management
[ ] Backup encryption
[ ] WORM backups (inmutables)
[ ] Data classification
[ ] PII masking in logs
[ ] GDPR data deletion
```

---

## 6. SDLC Seguro

### 6.1 Gates de CI/CD

```yaml
# .github/workflows/security.yml
security-gates:
  - name: SAST (Semgrep)
    stage: pre-commit
    blocking: true

  - name: Dependency Scan (npm audit)
    stage: pre-build
    blocking: critical

  - name: Secret Scanning (GitLeaks)
    stage: pre-commit
    blocking: true

  - name: Container Scan (Trivy)
    stage: post-build
    blocking: high+critical

  - name: DAST (OWASP ZAP)
    stage: staging
    blocking: false
```

### 6.2 OWASP ASVS 5.0 Checklist

| Level | Descripción | Objetivo Clubiio |
|-------|-------------|------------------|
| L1 | Verificación básica | ✅ Mínimo requerido |
| L2 | Verificación estándar | 🎯 Target Q2 2026 |
| L3 | Verificación avanzada | 🔮 Future |

### 6.3 Entornos

| Entorno | Datos | Acceso | Propósito |
|---------|-------|--------|-----------|
| Development | Sintéticos | Developers | Feature dev |
| Staging | Anonimizados | Team | Testing |
| Production | Reales | Limited | Live |

**Regla:** Datos de producción NUNCA en dev/staging.

---

## 7. Infraestructura

### 7.1 Arquitectura de Seguridad

```
                                    ┌─────────────────┐
                                    │   CloudFlare    │
                                    │   (WAF + DDoS)  │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   Load Balancer │
                                    │   (TLS Term)    │
                                    └────────┬────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          │                  │                  │
                 ┌────────▼────────┐ ┌───────▼───────┐ ┌────────▼────────┐
                 │   API Server    │ │  API Server   │ │   API Server    │
                 │   (Container)   │ │  (Container)  │ │   (Container)   │
                 └────────┬────────┘ └───────┬───────┘ └────────┬────────┘
                          │                  │                  │
                          └──────────────────┼──────────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │   Database      │
                                    │   (Private VPC) │
                                    │   Encrypted     │
                                    └─────────────────┘
```

### 7.2 Controles de Red

| Control | Estado | Implementación |
|---------|--------|----------------|
| WAF | 🔴 | CloudFlare o AWS WAF |
| DDoS Protection | 🔴 | CloudFlare |
| TLS 1.3 | 🟢 | Let's Encrypt |
| Private Subnets | 🔴 | VPC config |
| Egress Control | 🔴 | Security groups |
| mTLS (service-to-service) | 🔴 | Future |

### 7.3 Secrets Management

| Secret | Ubicación Actual | Objetivo |
|--------|-----------------|----------|
| JWT_SECRET | .env | Vault/KMS |
| DATABASE_URL | .env | Vault/KMS |
| API Keys | .env | Vault/KMS |

---

## 8. Métricas y KPIs

### 8.1 Security KPIs

| Métrica | Objetivo | Actual | Frecuencia |
|---------|----------|--------|------------|
| Vulnerabilidades críticas abiertas | 0 | 3 | Diario |
| Tiempo medio de remediación (críticas) | <24h | N/A | Semanal |
| Cobertura de MFA (admins) | 100% | 0% | Mensual |
| Dependencias con CVE conocido | 0 | ? | Semanal |
| Tiempo de respuesta a incidentes | <1h | N/A | Por evento |

### 8.2 Compliance Status

| Framework | Status | Target |
|-----------|--------|--------|
| NIST CSF 2.0 | 35% | 80% Q4 |
| CIS Controls IG1 | 40% | 100% Q2 |
| ISO 27001:2022 | 20% | Certificación Q1 2027 |
| SOC 2 Type II | 0% | Iniciar Q3 2026 |

---

## 9. Responsabilidades

| Rol | Responsabilidades |
|-----|-------------------|
| CTO | Sponsor ejecutivo, aprobación de riesgos |
| Security Lead | Implementación, auditorías, respuesta a incidentes |
| Backend Lead | Seguridad de aplicación, autenticación, APIs |
| DevOps Lead | Infraestructura, CI/CD, monitoreo |
| Legal | Compliance, privacidad, contratos |
| HR | Concientización, políticas de personal |

---

## 10. Revisión y Actualización

- **Revisión trimestral** de este documento
- **Actualización inmediata** ante nuevas vulnerabilidades críticas
- **Auditoría externa anual** (penetration testing)
- **Simulacros de incidentes** semestrales

---

## Apéndice A: Referencias

- [NIST CSF 2.0](https://www.nist.gov/cyberframework)
- [CIS Controls v8.1](https://www.cisecurity.org/controls)
- [ISO/IEC 27001:2022](https://www.iso.org/standard/27001)
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/)
- [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/)

---

## Apéndice B: Contactos de Emergencia

| Tipo | Contacto | Escalación |
|------|----------|------------|
| Incidente de seguridad | security@clubiio.com | CTO → CEO |
| Brecha de datos | dpo@clubiio.com | Legal → CEO |
| Disponibilidad | ops@clubiio.com | DevOps → CTO |
