# insight platform — Logo & Favicon

insight 제품군 · 3계층 컬러(가족 네이비 "sight" / 제품 액센트). 코드에서 바로 사용하세요.

## Files
| File | Use |
|------|-----|
| `favicon.svg` | 컬러 타일 + 화이트 글리프 (아이콘/파비콘/아바타) |
| `favicon-32.png` | 브라우저 탭 |
| `favicon-180.png` | apple-touch-icon |
| `favicon-512.png` | PWA / 고해상 |
| `logo.svg` | 가로 락업 — **라이트 배경용** |
| `logo-dark.svg` | 가로 락업 — **다크 배경용** |

## Favicon (HTML head)
```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/favicon-180.png" />
```

## Logo (auto 라이트/다크)
```html
<picture>
  <source srcset="/logo-dark.svg" media="(prefers-color-scheme: dark)" />
  <img src="/logo.svg" alt="insight platform" height="28" />
</picture>
```

## Tokens
```css
--accent: #7ba1fc;   /* 제품 액센트 (dark) */
--sight-light: #26418d;  --sight-dark: #7ba1fc;   /* 가족 네이비 */
```
