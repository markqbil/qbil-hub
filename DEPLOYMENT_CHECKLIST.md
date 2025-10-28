# 🚀 Deployment Checklist

Pre-deployment checklist voor Qbil Hub om een succesvolle productie deployment te garanderen.

## 📋 Pre-Deployment

### Environment & Configuration
- [ ] `.env` file aangemaakt met productie waarden
- [ ] `JWT_SECRET` is een **sterke**, **unieke** random string (min. 32 characters)
- [ ] `NODE_ENV=production` is ingesteld
- [ ] `CORS_ORIGIN` bevat **alleen** de toegestane productie origins
- [ ] Database path is correct geconfigureerd
- [ ] SMTP credentials zijn ingesteld (als email enabled)
- [ ] Upload directory heeft correcte permissions
- [ ] Logs directory heeft correcte permissions

### Security
- [ ] Alle **demo credentials** zijn verwijderd of gewijzigd
- [ ] Rate limiting is geconfigureerd (default settings zijn veilig)
- [ ] File upload limits zijn ingesteld
- [ ] CORS is correct geconfigureerd voor productie
- [ ] Helmet.js security headers zijn actief
- [ ] Geen hardcoded secrets in code
- [ ] `.env` file staat **NIET** in git
- [ ] `.gitignore` is compleet

### Database
- [ ] Database migratie is uitgevoerd: `npm run migrate`
- [ ] Database heeft correcte permissions
- [ ] Backup strategie is ingesteld
- [ ] WAL mode is actief (automatisch bij migratie)

### Dependencies
- [ ] Alle dependencies zijn geïnstalleerd: `npm ci` (productie)
- [ ] Geen security vulnerabilities: `npm audit`
- [ ] Dependencies zijn up-to-date

### Testing
- [ ] Alle tests passeren: `npm test`
- [ ] Test coverage is >80%: `npm run test:coverage`
- [ ] Health check werkt: `GET /health`
- [ ] API endpoints zijn getest

## 🔧 Deployment

### Server Setup
- [ ] Node.js 18+ is geïnstalleerd
- [ ] PM2 of andere process manager is geconfigureerd
- [ ] Server heeft voldoende resources (min. 2GB RAM aanbevolen)
- [ ] Firewall regels zijn ingesteld (alleen nodige poorten open)
- [ ] HTTPS/TLS certificaten zijn geïnstalleerd (aanbevolen)

### Application Start
- [ ] Application start correct: `npm start`
- [ ] Logs worden correct weggeschreven
- [ ] Cleanup service start automatisch
- [ ] Health check endpoint is bereikbaar
- [ ] API endpoints responderen correct

### Monitoring
- [ ] Logging is actief en verzameld
- [ ] Error tracking is ingesteld (optioneel: Sentry, etc.)
- [ ] Performance monitoring is actief
- [ ] Disk space monitoring is ingesteld
- [ ] Database growth wordt gemonitord

## 📊 Post-Deployment

### Verification
- [ ] Health check succesvol: `curl https://yourdomain.com/health`
- [ ] Login werkt met correcte credentials
- [ ] Document upload werkt
- [ ] Email notifications werken (als enabled)
- [ ] Audit logs worden correct weggeschreven
- [ ] Rate limiting werkt (test door veel requests te doen)

### Performance
- [ ] Response times zijn acceptabel (<200ms gemiddeld)
- [ ] Cache werkt (check in `/health` endpoint)
- [ ] Database queries zijn snel (<50ms gemiddeld)
- [ ] Memory usage is stabiel

### Backup
- [ ] Database backup is gemaakt
- [ ] Upload directory is backed up
- [ ] `.env` file is veilig opgeslagen (NIET in git!)
- [ ] Backup restore is getest

## 🔄 Maintenance

### Daily
- [ ] Check error logs
- [ ] Monitor disk space
- [ ] Verify backups

### Weekly
- [ ] Review audit logs
- [ ] Check performance metrics
- [ ] Update dependencies (if needed)

### Monthly
- [ ] Security audit
- [ ] Database optimization (VACUUM)
- [ ] Clean old uploads (automatisch via cleanup service)
- [ ] Review and update documentation

## 🆘 Rollback Plan

Als er problemen zijn na deployment:

1. **Stop de application**
   ```bash
   pm2 stop qbil-hub
   ```

2. **Restore database backup**
   ```bash
   cp qbil_hub.db.backup qbil_hub.db
   ```

3. **Checkout previous version**
   ```bash
   git checkout <previous-commit>
   npm ci
   ```

4. **Restart application**
   ```bash
   npm start
   ```

## 📞 Support

- **Documentation**: README.md, SECURITY.md, PERFORMANCE.md
- **Issues**: GitHub Issues
- **Security**: Zie SECURITY.md voor responsible disclosure

---

✅ **Alle items gecheckt?** Je bent klaar voor deployment! 🚀


