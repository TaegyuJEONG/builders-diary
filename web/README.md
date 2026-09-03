# Builder's Diary - Web Portfolio Visualization

A Next.js 14 web application that visualizes your local portfolio folder structure with 3-layer hierarchy (Project → Goal → Record), tag-based filtering, and markdown rendering.

## Features Implemented

### 1. ✅ File System Access API Integration
- **selectFolder()**: Opens browser file picker to select portfolio folder
- **scanFolderStructure()**: Recursively scans `content/projects-*/goals/*/records/*.md`
- **saveFolderHandleToStorage()**: Persists folder handle in IndexedDB for auto-loading
- **loadFolderHandleFromStorage()**: Retrieves saved folder handle on revisit
- **verifyFolderPermission()**: Requests/validates read permissions

### 2. ✅ Portfolio Parser
- **parseFrontMatter()**: Extracts YAML front matter (id, title, tags, created_at, etc.)
- **renderMarkdown()**: Converts markdown to HTML with syntax highlighting
- Error handling for malformed files
- Supports all markdown elements: headings, bold, italic, lists, code blocks, links

### 3. ✅ 3-Layer Tree Component (ProjectTree.tsx)
- Project list (expandable)
- Goals under each project (expandable)
- Records under each goal (clickable/selectable)
- Empty levels automatically hidden
- Copy resume link buttons for each level
- Smooth expand/collapse animation

### 4. ✅ Record Detail Component (RecordDetail.tsx)
- Full markdown rendering with HTML styling
- Displays metadata: created_at, updated_at, tags
- Summary section with blue highlight
- "Copy Resume Link" button with visual feedback
- Responsive layout for all screen sizes

### 5. ✅ Tag Filter Component (TagFilter.tsx)
- Extracts all tags from all records
- Desktop: shows all tags as buttons
- Mobile: dropdown with checkboxes
- Multi-select UI with clear all option
- Real-time filtering of tree
- Hides empty projects/goals automatically

### 6. ✅ Deep Linking & Resume Links
- **generateResumeLink()**: Creates shareable URLs
  - `/r/{record_id}` for records
  - `/p/{project_slug}` for projects
  - `/p/{project_slug}/g/{goal_slug}` for goals
- **parseDeepLink()**: Handles navigation from URLs
- **copyToClipboard()**: Copies links with fallback for older browsers

### 7. ✅ Caching & Persistence
- **getCachedPortfolio()**: Retrieves portfolio with TTL (1 hour)
- **setCachedPortfolio()**: Stores portfolio in localStorage
- **clearCache()**: Manual cache invalidation
- Auto-loads on revisit

### 8. ✅ Responsive Design
- **Desktop (1200px+)**: 2-column layout (tree 30%, detail 70%)
- **Tablet (768-1199px)**: Stacked layout (full width each)
- **Mobile (<768px)**: Accordion tree + full-screen detail
- Touch-friendly UI with larger tap targets
- Tailwind CSS responsive utilities

### 9. ✅ Error Handling
- FSA permission errors with clear messages
- Markdown parsing errors with graceful fallback
- Folder structure validation
- File read error handling
- Bracket Try/catch blocks in all critical functions

## Project Structure

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with metadata
│   │   ├── page.tsx             # Wrapper with Suspense
│   │   ├── home-content.tsx     # Main app logic (client)
│   │   └── globals.css          # Tailwind + custom styles
│   │
│   ├── components/
│   │   ├── Header.tsx           # Top bar with buttons (39 lines)
│   │   ├── ProjectTree.tsx      # 3-level tree view (191 lines)
│   │   ├── RecordDetail.tsx     # Markdown viewer (109 lines)
│   │   └── TagFilter.tsx        # Tag multi-select (102 lines)
│   │
│   ├── lib/
│   │   ├── types.ts             # TypeScript interfaces (47 lines)
│   │   ├── fileSystem.ts        # FSA API wrapper (263 lines)
│   │   ├── parser.ts            # Markdown & YAML parser (116 lines)
│   │   └── filter.ts            # Tag filtering logic (71 lines)
│   │
│   └── utils/
│       ├── resumeLink.ts        # Deep links & clipboard (48 lines)
│       └── cache.ts             # localStorage + TTL (43 lines)
│
├── next.config.js               # Next.js config
├── tailwind.config.ts           # Tailwind styling
├── postcss.config.js            # PostCSS for Tailwind
├── tsconfig.json                # TypeScript config
├── package.json                 # Dependencies
└── README.md                    # This file
```

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **UI Library**: React 18
- **Language**: TypeScript 5.3
- **Styling**: Tailwind CSS 3.4 + PostCSS
- **File Access**: W3C File System Access API
- **Storage**: localStorage + IndexedDB
- **Markdown**: Custom parser with regex transformations

## Type Safety

All components and functions are fully typed:

```typescript
interface Portfolio {
  path: string;
  projects: Project[];
}

interface Project {
  id: string;
  slug: string;
  title: string;
  goals: Goal[];
}

interface Goal {
  id: string;
  slug: string;
  title: string;
  records: Record[];
}

interface Record {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
  content: string;
  file_path: string;
  status?: string;
}
```

## Development

### Prerequisites
- Node.js 18+ (LTS)
- npm or yarn

### Installation
```bash
cd web
npm install
```

### Development Server
```bash
npm run dev
```
Starts on http://localhost:3000

### Production Build
```bash
npm run build
npm start
```

### Type Checking
```bash
npm run build  # Runs TypeScript check
```

## Browser Support

| Browser | FSA Support | Status |
|---------|------------|--------|
| Chrome 86+ | ✓ | Recommended |
| Edge 86+ | ✓ | Recommended |
| Firefox 48+ | ⚠️ | Limited |
| Safari 13+ | ✗ | Not supported (V2 fallback) |

## Key Features & Components

### Header Component
- "Select Folder" button - opens FSA dialog
- "Refresh" button - re-scans portfolio
- Loading state indication
- Title and description

### ProjectTree Component
- 3-level expandable tree
- Project/Goal/Record navigation
- Selected item highlighting
- Copy link buttons for each level
- Empty levels hidden automatically

### RecordDetail Component
- Full markdown rendering
- Metadata display (dates, tags)
- Summary highlight box
- Copy resume link button
- Responsive layout

### TagFilter Component
- Extract all tags automatically
- Desktop: tag buttons
- Mobile: dropdown UI
- Multi-select with clear option
- Real-time filtering

## Performance Optimizations

1. **Lazy Loading**: Record detail only rendered when selected
2. **Caching**: 1-hour TTL in localStorage
3. **Memoization**: useCallback for tag filtering to prevent re-renders
4. **Code Splitting**: Next.js automatic chunking
5. **Efficient Rendering**: Conditional rendering of components

## Error Handling

All critical functions include try/catch blocks:

```typescript
try {
  // Operation
} catch (error) {
  console.error('Error message:', error);
  // User-friendly fallback
}
```

Errors handled:
- FSA permission denied
- File read failures
- Markdown parsing failures
- Invalid folder structure
- localStorage access errors
- Clipboard API fallback

## Testing Checklist

- [x] Build succeeds with no errors
- [x] TypeScript compilation passes
- [x] All components export properly
- [x] FSA API integration (selectFolder, scanFolder)
- [x] Markdown parsing (front matter + content)
- [x] Tree rendering (3 levels)
- [x] Tag filtering (multiple tags)
- [x] Resume links (clipboard copy)
- [x] Deep linking (/r/id, /p/id)
- [x] Responsive design (desktop/tablet/mobile)
- [x] Error messages display
- [x] Performance optimizations

## Deployment

Ready for deployment on:
- **Vercel** (recommended) - `vercel deploy`
- **Netlify** - supported
- **Self-hosted** - Node.js 18+

## Future Enhancements (V2+)

- [ ] Advanced search functionality
- [ ] Data export (PDF, JSON)
- [ ] Public sharing via URL
- [ ] Multi-user support
- [ ] Dark mode
- [ ] PWA offline support
- [ ] Full-text search
- [ ] Analytics tracking
- [ ] Social media sharing
- [ ] Browser sync across devices

## License

MIT - See LICENSE file

## Contributing

This is a personal portfolio tool. For feature requests or bug reports, contact the author.
