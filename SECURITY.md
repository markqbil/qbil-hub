# Security Policy

## Ondersteunde Versies

De volgende versies van Qbil Hub worden momenteel ondersteund met security updates:

| Versie | Ondersteund        |
| ------ | ------------------ |
| 1.0.x  | :white_check_mark: |

## Security Features

### Authenticatie & Autorisatie
- JWT-based authenticatie met access en refresh tokens
- Bcrypt password hashing met 10 rounds
- Role-based access control (RBAC)
- Session management met token rotation
- Password reset met tijdelijke tokens

### Netwerk Beveiliging
- Helmet.js voor security headers
- Strikte CORS policy (productie modus)
- Rate limiting: 100 requests per 15 minuten per IP
- Optionele HTTPS enforcement
- Preflight request caching

### File Upload Beveiliging
- MIME type validatie
- File extension whitelist
- Magic number (file signature) checking
- Cryptographisch veilige filename generatie
- Path traversal protection
- Null byte filtering
- Zero-byte file rejection
- Configureerbare file size limits

### Data Beveiliging
- SQL injection preventie via parameterized queries
- XSS protection via input/output encoding
- Audit logging van alle kritieke acties
- Secure file storage met unique filenames
- Database encryption at rest (optioneel)

### Email Beveiliging
- SMTP authenticatie via Nodemailer
- Template sanitization
- Rate limiting voor email verzending
- SPF/DKIM/DMARC ready (configureerbaar)

## Security Best Practices voor Deployment

### Productie Environment Variables

**Verplicht te wijzigen:**
```bash
# Genereer een sterke random string (64+ karakters)
JWT_SECRET=<gebruik-crypto-random-string>

# Gebruik een veilig wachtwoord
SMTP_PASS=<gebruik-app-specific-password>
```

**Aanbevolen productie settings:**
```bash
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
FORCE_HTTPS=true
LOG_LEVEL=warn
EMAIL_ENABLED=true
```

### Database Beveiliging
- Gebruik SQLite WAL modus voor betere concurrency
- Overweeg PostgreSQL voor grotere deployments
- Implementeer regelmatige backups
- Encrypt database bestanden at rest
- Beperk file system toegang tot database

### HTTPS/TLS
- **Gebruik altijd HTTPS in productie**
- Gebruik Let's Encrypt voor gratis SSL certificaten
- Configureer strong cipher suites
- Implementeer HSTS headers
- Overweeg certificate pinning voor API clients

### Rate Limiting
De default rate limit is 100 requests per 15 minuten. Voor productie:
```bash
# Pas aan op basis van verwacht verkeer
RATE_LIMIT_WINDOW_MS=900000  # 15 minuten
RATE_LIMIT_MAX_REQUESTS=100   # Verhoog indien nodig
```

### File Upload Hardening
```bash
# Beperk file sizes
MAX_FILE_SIZE=5242880  # 5MB voor productie

# Beperk toegestane types
ALLOWED_FILE_TYPES=application/pdf,text/plain
```

**Extra aanbevelingen:**
- Implementeer virus scanning (bijv. ClamAV)
- Sla uploads op buiten de webroot
- Gebruik object storage (S3, Azure Blob) voor schaalbaarheid
- Implementeer content scanning voor sensitive data

### Logging & Monitoring
- Review audit logs regelmatig
- Stel alerts in voor security events:
  - Gefaalde login pogingen
  - Rate limit violations
  - File upload rejections
  - CORS violations
- Gebruik centralized logging (ELK, Splunk)
- Implementeer SIEM voor threat detection

### Secrets Management
- **Sla NOOIT .env files op in Git**
- Gebruik secrets management tools:
  - HashiCorp Vault
  - AWS Secrets Manager
  - Azure Key Vault
  - Docker Secrets (voor containers)
- Roteer secrets regelmatig
- Gebruik verschillende secrets per environment

### Network Security
- Gebruik een firewall (UFW, iptables)
- Implementeer DDoS protection (Cloudflare, AWS Shield)
- Gebruik VPN voor admin toegang
- Beperk database toegang tot localhost
- Gebruik security groups/network ACLs in cloud

### Container Security (indien van toepassing)
- Gebruik officiële Node.js base images
- Run als non-root user
- Scan images voor vulnerabilities
- Gebruik multi-stage builds
- Implementeer security scanning in CI/CD

## Vulnerability Reporting

Als je een security vulnerability in Qbil Hub ontdekt, **meld dit dan verantwoord**:

### Hoe te melden:
1. **NIET** via publieke GitHub issues
2. Email naar: **security@qbil.com**
3. Encrypt je bericht (PGP key beschikbaar op aanvraag)

### Wat te includeren:
- Beschrijving van de vulnerability
- Stappen om te reproduceren
- Potentiële impact
- Mogelijk fix of mitigatie (optioneel)

### Response tijden:
- **Eerste response**: Binnen 48 uur
- **Status update**: Binnen 7 dagen
- **Fix timeline**: Afhankelijk van severity
  - Critical: 24-48 uur
  - High: 7 dagen
  - Medium: 30 dagen
  - Low: 90 dagen

### Severity Levels

| Severity | Criteria | Response Time |
|----------|----------|---------------|
| Critical | Remote code execution, authentication bypass | 24-48 uur |
| High | Data exposure, privilege escalation | 7 dagen |
| Medium | XSS, CSRF, information disclosure | 30 dagen |
| Low | Security best practice violations | 90 dagen |

## Security Checklist voor Deployment

- [ ] Alle environment variables zijn geconfigureerd
- [ ] JWT_SECRET is een sterke random string
- [ ] NODE_ENV is ingesteld op "production"
- [ ] CORS_ORIGIN bevat alleen trusted domains
- [ ] HTTPS is geactiveerd en geforceerd
- [ ] Database is beveiligd en backed-up
- [ ] Logs worden gemonitord
- [ ] Rate limiting is actief
- [ ] File upload validatie is actief
- [ ] Email SMTP credentials zijn veilig opgeslagen
- [ ] Firewall regels zijn geconfigureerd
- [ ] Updates en patches zijn toegepast
- [ ] Security audit is uitgevoerd
- [ ] Incident response plan is gedocumenteerd

## Verantwoordelijke Disclosure

We volgen een responsible disclosure beleid:
- We erkennen alle security researchers
- We publiceren security advisories na fixes
- We geven credit (indien gewenst)
- We overwegen bug bounties in de toekomst

## Security Updates

Security updates worden aangekondigd via:
- GitHub Security Advisories
- CHANGELOG.md
- Email notificaties (indien geregistreerd)

## Contact

Voor security gerelateerde vragen:
- **Email**: security@qbil.com
- **PGP Key**: Op aanvraag beschikbaar

---

**Laatst bijgewerkt**: 28 oktober 2025
**Versie**: 1.0.0


