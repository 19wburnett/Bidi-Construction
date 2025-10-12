# Integrating Takeoff System into Bidi Dashboard

## Adding to Navigation

### Option 1: Add to Dashboard Navbar

Update `components/dashboard-navbar.tsx` to include a Takeoff link:

```tsx
import { Calculator } from 'lucide-react' // Add to imports

// Inside your navbar links:
<Link 
  href="/dashboard/takeoff" 
  className="nav-link"
>
  <Calculator className="h-5 w-5" />
  Takeoffs
</Link>
```

### Option 2: Add to Dashboard Home

Update `app/dashboard/page.tsx` to show a Takeoff card:

```tsx
// Add to your dashboard cards
<Card 
  className="cursor-pointer hover:shadow-lg"
  onClick={() => router.push('/dashboard/takeoff')}
>
  <CardHeader>
    <CardTitle className="flex items-center">
      <Calculator className="h-5 w-5 mr-2" />
      AI Takeoffs
    </CardTitle>
    <CardDescription>
      Generate quantity takeoffs with AI
    </CardDescription>
  </CardHeader>
  <CardContent>
    <Button className="w-full">
      View Takeoffs
    </Button>
  </CardContent>
</Card>
```

### Option 3: Add to Job Details Page

In `app/dashboard/jobs/[id]/page.tsx`, add a "Create Takeoff" button:

```tsx
<Button
  onClick={() => router.push(`/dashboard/takeoff/new?projectId=${jobId}`)}
  variant="outline"
>
  <Calculator className="h-4 w-4 mr-2" />
  Create Takeoff
</Button>
```

## Linking with Existing Projects

### Display Takeoffs on Job Page

Show related takeoffs on the job details page:

```tsx
'use client'

import { useEffect, useState } from 'react'

function JobTakeoffs({ projectId }: { projectId: string }) {
  const [takeoffs, setTakeoffs] = useState([])

  useEffect(() => {
    fetch(`/api/takeoff/create?projectId=${projectId}`)
      .then(res => res.json())
      .then(data => setTakeoffs(data.takeoffs || []))
  }, [projectId])

  if (takeoffs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Takeoffs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            No takeoffs created yet
          </p>
          <Button 
            onClick={() => router.push(`/dashboard/takeoff/new?projectId=${projectId}`)}
          >
            Create First Takeoff
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Takeoffs ({takeoffs.length})</CardTitle>
          <Button 
            size="sm"
            onClick={() => router.push(`/dashboard/takeoff/new?projectId=${projectId}`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {takeoffs.map(takeoff => (
            <div 
              key={takeoff.id}
              className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => router.push(`/dashboard/takeoff/${takeoff.id}`)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{takeoff.name}</p>
                  <p className="text-sm text-gray-500">
                    Version {takeoff.version} • {takeoff.status}
                  </p>
                </div>
                <Badge variant={
                  takeoff.ai_analysis_status === 'completed' 
                    ? 'default' 
                    : 'secondary'
                }>
                  {takeoff.ai_analysis_status === 'completed' ? 'AI Analyzed' : 'Draft'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

## Adding Quick Actions

### Create from Plans Viewer

In `components/plans-viewer.tsx`, add a "Create Takeoff" button:

```tsx
<Button
  onClick={() => {
    router.push(`/dashboard/takeoff/new?projectId=${jobRequestId}&planFile=${planFiles[0]}`)
  }}
  variant="outline"
>
  <Calculator className="h-4 w-4 mr-2" />
  Create Takeoff
</Button>
```

## Mobile Menu Integration

If you have a mobile menu, add:

```tsx
<Link 
  href="/dashboard/takeoff"
  className="mobile-menu-item"
>
  <Calculator className="h-5 w-5" />
  <span>Takeoffs</span>
</Link>
```

## Breadcrumb Integration

For better navigation, add breadcrumbs:

```tsx
// In takeoff pages
<nav className="breadcrumbs">
  <Link href="/dashboard">Dashboard</Link>
  <ChevronRight className="h-4 w-4" />
  <Link href="/dashboard/takeoff">Takeoffs</Link>
  {takeoffId && (
    <>
      <ChevronRight className="h-4 w-4" />
      <span>{takeoffName}</span>
    </>
  )}
</nav>
```

## User Permissions

If you have role-based access, add checks:

```tsx
// Check if user can create takeoffs
const canCreateTakeoffs = user?.role === 'GC' || user?.role === 'admin'

{canCreateTakeoffs && (
  <Button onClick={() => router.push('/dashboard/takeoff/new')}>
    New Takeoff
  </Button>
)}
```

## Notification Integration

### Notify when AI analysis completes

```tsx
// In your notification system
{
  type: 'takeoff_completed',
  title: 'Takeoff Analysis Complete',
  message: 'AI has analyzed your plan and detected 45 items',
  link: `/dashboard/takeoff/${takeoffId}`,
  created_at: new Date().toISOString()
}
```

### Notify on collaboration events

```tsx
{
  type: 'takeoff_edited',
  title: 'Takeoff Updated',
  message: `${userName} edited items in ${takeoffName}`,
  link: `/dashboard/takeoff/${takeoffId}`,
  created_at: new Date().toISOString()
}
```

## Analytics Integration

### Track Takeoff Events

If using PostHog or similar:

```tsx
import posthog from 'posthog-js'

// When creating takeoff
posthog.capture('takeoff_created', {
  takeoff_id: takeoffId,
  project_id: projectId,
  auto_analyze: autoAnalyze
})

// When AI analysis completes
posthog.capture('takeoff_analysis_completed', {
  takeoff_id: takeoffId,
  items_detected: itemsCount,
  confidence_score: avgConfidence
})

// When user interacts with chat
posthog.capture('takeoff_chat_message', {
  takeoff_id: takeoffId,
  message_length: message.length
})
```

## Search Integration

### Add to Global Search

If you have a global search, include takeoffs:

```tsx
// In your search API/component
const searchResults = {
  takeoffs: await supabase
    .from('takeoffs')
    .select('*')
    .ilike('name', `%${query}%`)
    .limit(5)
}

// Render in results
{searchResults.takeoffs.map(takeoff => (
  <SearchResult
    icon={<Calculator />}
    title={takeoff.name}
    subtitle={`Takeoff • ${takeoff.status}`}
    href={`/dashboard/takeoff/${takeoff.id}`}
  />
))}
```

## Dashboard Stats Widget

### Show Takeoff Statistics

```tsx
function TakeoffStatsWidget() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    ai_analyzed: 0,
    total_cost: 0
  })

  useEffect(() => {
    // Fetch stats
    fetch('/api/takeoff/create')
      .then(res => res.json())
      .then(data => {
        const takeoffs = data.takeoffs || []
        setStats({
          total: takeoffs.length,
          active: takeoffs.filter(t => t.status === 'active').length,
          ai_analyzed: takeoffs.filter(t => t.ai_analysis_status === 'completed').length,
          total_cost: 0 // Calculate from items
        })
      })
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Takeoff Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-gray-600">Total Takeoffs</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{stats.ai_analyzed}</p>
            <p className="text-sm text-gray-600">AI Analyzed</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## Quick Create from Upload

### Auto-create takeoff on plan upload

```tsx
// After uploading plan in new job form
async function handlePlanUpload(file: File) {
  // 1. Upload to Supabase Storage
  const { data: uploadData } = await supabase.storage
    .from('plans')
    .upload(`${userId}/${projectId}/${file.name}`, file)

  // 2. Auto-create takeoff (optional)
  if (autoCreateTakeoff) {
    await fetch('/api/takeoff/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        planFileUrl: uploadData.path,
        name: `Takeoff - ${file.name}`,
        autoAnalyze: true
      })
    })
  }
}
```

## Sidebar Integration

### Add to Dashboard Sidebar

```tsx
// In your sidebar component
const sidebarItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard' },
  { icon: Briefcase, label: 'Jobs', href: '/dashboard/jobs' },
  { icon: Calculator, label: 'Takeoffs', href: '/dashboard/takeoff', badge: takeoffCount },
  { icon: Users, label: 'Contacts', href: '/dashboard/contacts' },
  // ... more items
]
```

## Complete Example

Here's a complete integration in your dashboard:

```tsx
'use client'

import { Calculator } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [recentTakeoffs, setRecentTakeoffs] = useState([])

  useEffect(() => {
    fetch('/api/takeoff/create')
      .then(res => res.json())
      .then(data => setRecentTakeoffs(data.takeoffs?.slice(0, 3) || []))
  }, [])

  return (
    <div className="dashboard">
      {/* Header with quick action */}
      <div className="flex justify-between items-center mb-8">
        <h1>Dashboard</h1>
        <Link href="/dashboard/takeoff/new">
          <Button>
            <Calculator className="h-4 w-4 mr-2" />
            New Takeoff
          </Button>
        </Link>
      </div>

      {/* Recent Takeoffs Section */}
      <section>
        <div className="flex justify-between items-center mb-4">
          <h2>Recent Takeoffs</h2>
          <Link href="/dashboard/takeoff">
            View All
          </Link>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {recentTakeoffs.map(takeoff => (
            <Card key={takeoff.id}>
              {/* Takeoff card content */}
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
```

## Testing Integration

### Test Checklist

- [ ] Navigation links work
- [ ] Create new takeoff from dashboard
- [ ] Create takeoff from project page
- [ ] View takeoff list
- [ ] Open individual takeoff
- [ ] Search finds takeoffs
- [ ] Breadcrumbs work
- [ ] Mobile menu includes takeoffs
- [ ] Permissions respected
- [ ] Analytics events fire

## Next Steps

1. Choose your preferred navigation integration
2. Add links to existing pages
3. Test the user flow
4. Add analytics tracking
5. Update user documentation

Your takeoff system is now fully integrated with the Bidi dashboard! 🎉

