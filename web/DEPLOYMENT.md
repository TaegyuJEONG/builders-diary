# Deployment Guide: Builder's Diary Website

## Quick Start

### Local Testing
```bash
cd web
npm install
npm run dev
```
Open http://localhost:3000

### Production Build
```bash
npm run build
npm start
```

---

## Deployment Options

### Option 1: Vercel (Recommended) ⭐

**Why Vercel?**
- Native Next.js optimization
- Automatic deployments from Git
- Edge caching & CDN
- Zero-configuration

**Steps:**
1. Push to GitHub:
   ```bash
   cd ~/work/builders-diary
   git add .
   git commit -m "Website production ready"
   git push origin main
   ```

2. Connect to Vercel:
   - Visit https://vercel.com
   - Import repository
   - Select "web" folder as root
   - Click Deploy

3. Your site goes live at: `https://builders-diary.vercel.app`

**Environment Setup**: None needed (local-only app)

### Option 2: Netlify

**Steps:**
1. Build locally:
   ```bash
   npm run build
   ```

2. Deploy to Netlify:
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=.next/standalone/public
   ```

### Option 3: Self-Hosted

**Requirements:**
- Node.js 18+
- PM2 or similar process manager

**Setup:**
```bash
cd /var/www/builders-diary
npm install --production
npm run build
pm2 start "npm start" --name "builders-diary"
pm2 save
```

**Nginx Reverse Proxy:**
```nginx
server {
    listen 80;
    server_name builders-diary.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Pre-Deployment Checklist

### Code
- [x] Build succeeds: `npm run build`
- [x] No TypeScript errors
- [x] All components render
- [x] Tests pass locally

### Browser Compatibility
- [ ] Chrome 86+ (test FSA)
- [ ] Edge 86+ (test FSA)
- [ ] Firefox 48+ (test graceful degradation)
- [ ] Mobile responsive (iPhone, Android)

### Performance
- [ ] First Load JS < 100 kB ✓ (92.9 kB)
- [ ] Lighthouse score check
- [ ] No console errors
- [ ] No memory leaks

### Security
- [ ] No hardcoded secrets ✓
- [ ] No XSS vulnerabilities ✓
- [ ] HTTPS enabled (Vercel default)
- [ ] CSP headers set

### Content
- [ ] README.md complete ✓
- [ ] Error messages user-friendly ✓
- [ ] Favicon set (optional)
- [ ] Meta tags updated ✓

---

## Post-Deployment

### Monitoring

1. **Error Tracking** (Optional):
   ```bash
   npm install @sentry/nextjs
   ```

2. **Analytics** (Optional):
   Add Google Analytics to `_document.tsx`:
   ```typescript
   <Script
     src="https://www.googletagmanager.com/gtag/js?id=GA_ID"
     strategy="afterInteractive"
   />
   ```

### Testing

1. **Manual Test Cases**:
   - [ ] Visit https://deployed-url.com
   - [ ] Click "Select Folder"
   - [ ] Choose portfolio folder
   - [ ] Verify tree renders
   - [ ] Click record → detail shows
   - [ ] Select tag → tree filters
   - [ ] Copy resume link → clipboard ✓
   - [ ] Refresh page → auto-loads ✓
   - [ ] Check mobile responsive
   - [ ] Test error case (invalid folder)

2. **Automated Monitoring**:
   ```bash
   # Monitor deployment logs
   vercel logs
   
   # Check function performance
   vercel telemetry
   ```

### Maintenance

**Daily:**
- Monitor error logs
- Check performance metrics

**Weekly:**
- Review usage patterns
- Test all features

**Monthly:**
- Update dependencies: `npm update`
- Review code for improvements
- Plan V2 features

---

## Troubleshooting

### Issue: "File System Access API is not supported"

**Cause**: Browser doesn't support FSA (Safari, old Firefox)

**Solution**: Show fallback message:
```typescript
if (!('showDirectoryPicker' in window)) {
  alert('Your browser does not support File System Access API.\n\nPlease use Chrome, Edge, or Firefox.');
}
```

### Issue: "Permission denied" when selecting folder

**Cause**: Browser permission denied or folder moved

**Solution**: Clear saved handle and re-select:
```typescript
localStorage.removeItem('builders-diary-portfolio-cache');
// User clicks "Select Folder" again
```

### Issue: Slow initial load with large portfolio

**Cause**: 100+ records with large markdown files

**Solution** (V2):
- Implement pagination
- Use virtual scrolling
- Add progress indicator during scan

### Issue: Cache stale data

**Cause**: Portfolio changed but cache not cleared

**Solution**: Click "Refresh" button to re-scan

---

## Environment Variables

**Not needed for V1** (local-only app)

**For future versions** (V2+ with backend):
```
NEXT_PUBLIC_API_URL=https://api.builders-diary.com
NEXT_PUBLIC_VERCEL_URL=https://builders-diary.vercel.app
```

---

## Rollback Procedure

**If deployment fails:**

### Vercel:
```bash
vercel rollback
# or manually re-deploy previous commit
git revert <bad-commit>
git push
```

### Manual Servers:
```bash
pm2 restart builders-diary --update-env
```

---

## Domain Setup (Optional)

### Add Custom Domain

**Vercel:**
1. Go to Project Settings → Domains
2. Enter domain (e.g., builders-diary.com)
3. Update DNS records (CNAME or A record)
4. Wait 24-48 hours for propagation

**Netlify:**
1. Domain settings → Custom domain
2. Point DNS records to Netlify nameservers
3. Auto-SSL certificate issued

### DNS Configuration Example:
```
# For builders-diary.com
Type  Name                Value
CNAME builders-diary       cname.vercel-dns.com
```

---

## Performance Optimization

### Current Status:
- Build time: ~45 seconds
- Bundle size: 92.9 kB First Load JS
- Runtime: Optimized with useCallback

### Future Improvements (V2):
```bash
# Enable image optimization (if adding images)
npm install next-image-optimization

# Add compression
npm install compression

# Monitor Lighthouse
npm install lighthouse
npx lighthouse https://builders-diary.vercel.app
```

---

## Documentation for Users

### How to Use

**First Visit:**
1. Open https://builders-diary.com
2. Click "Select Folder"
3. Choose your portfolio folder (~/portfolio)
4. Approve file access in browser
5. Folder data loads automatically

**Subsequent Visits:**
1. Folder data auto-loads from cache
2. Click "Refresh" to re-scan folder
3. Use "Select Folder" to switch portfolios

**Filtering:**
1. Click tags to select (multi-select enabled)
2. Tree updates to show matching records
3. Click "Clear all" to reset

**Resume Links:**
1. Click "📋 Copy Resume Link" on any record
2. Paste in browser to navigate
3. Share link with recruiters

---

## Support

### Common Questions

**Q: Will my data be uploaded to a server?**  
A: No. All data stays on your computer. No backend.

**Q: Can I access my portfolio on other devices?**  
A: Not with V1 (local-only). V2 will have cloud sync.

**Q: Can I share my portfolio with others?**  
A: V2 will have sharing. V1 is personal only.

**Q: What if my computer crashes?**  
A: Your portfolio folder is safe (you own it). Bookmark the site.

**Q: Which browsers work?**  
A: Chrome, Edge (FSA support). Firefox limited. Safari not supported.

---

## Version History

### v1.0.0 (Current)
- ✅ File System Access API
- ✅ 3-layer tree visualization
- ✅ Tag filtering
- ✅ Markdown rendering
- ✅ Resume links
- ✅ Responsive design

### v1.1.0 (Planned)
- [ ] Improved markdown parser (remark/rehype)
- [ ] Keyboard shortcuts
- [ ] Search functionality
- [ ] Accessibility improvements

### v2.0.0 (Future)
- [ ] Cloud synchronization
- [ ] Data sharing & public links
- [ ] Multi-user support
- [ ] Advanced analytics
- [ ] Mobile app

---

## Contact & Support

- **Issues**: GitHub Issues
- **Feature Requests**: Discussions
- **Email**: support@builders-diary.com (future)
- **Twitter**: @builders_diary (future)

---

## License

MIT License - See LICENSE file

---

**Deployment Status**: ✅ Ready  
**Last Updated**: 2026-09-03  
**Maintained By**: Builder's Diary Team
