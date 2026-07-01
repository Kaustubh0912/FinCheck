/**
 * Full-screen skeleton shown while silently verifying a stored auth token.
 * Mimics the dashboard layout (sidenav + content area) so the user sees a
 * seamless loading state instead of a flash of the Login page.
 */
export function AppSkeleton() {
  return (
    <div className="app-skeleton">
      {/* Progress bar at the very top */}
      <div className="auth-hydrating-bar" />

      {/* Ghost sidenav — only visible on desktop via the same breakpoint */}
      <aside className="app-skel-side">
        <div className="skel-side-brand">
          <div className="skel-block" style={{ width: 36, height: 36, borderRadius: 10 }} />
          <div className="skel-block" style={{ width: 90, height: 16, borderRadius: 6 }} />
        </div>
        <div className="skel-block" style={{ width: '100%', height: 46, borderRadius: 12, marginTop: 8 }} />
        <div className="skel-side-links">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skel-block" style={{ width: `${60 + i * 6}%`, height: 14, borderRadius: 6 }} />
          ))}
        </div>
      </aside>

      {/* Ghost content area */}
      <div className="app-skel-content">
        {/* Greeting + heading */}
        <div className="skel-block" style={{ width: 100, height: 12, borderRadius: 5 }} />
        <div className="skel-block" style={{ width: 160, height: 28, borderRadius: 8, marginTop: 6 }} />

        {/* Balance hero */}
        <div className="skel-block" style={{ width: 80, height: 10, borderRadius: 4, marginTop: 32 }} />
        <div className="skel-block" style={{ width: 220, height: 40, borderRadius: 10, marginTop: 8 }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <div className="skel-block" style={{ width: 72, height: 24, borderRadius: 20 }} />
          <div className="skel-block" style={{ width: 72, height: 24, borderRadius: 20 }} />
          <div className="skel-block" style={{ width: 72, height: 24, borderRadius: 20 }} />
        </div>

        {/* Stat cards row */}
        <div style={{ display: 'flex', gap: 16, marginTop: 30 }}>
          <div className="skel-stat-card">
            <div className="skel-block" style={{ width: 50, height: 10, borderRadius: 4 }} />
            <div className="skel-block" style={{ width: 100, height: 22, borderRadius: 6, marginTop: 8 }} />
          </div>
          <div className="skel-stat-card">
            <div className="skel-block" style={{ width: 40, height: 10, borderRadius: 4 }} />
            <div className="skel-block" style={{ width: 100, height: 22, borderRadius: 6, marginTop: 8 }} />
          </div>
        </div>

        {/* Category breakdown rows */}
        <div style={{ marginTop: 30, display: 'grid', gap: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div className="skel-block" style={{ width: `${70 + i * 10}px`, height: 12, borderRadius: 5 }} />
                <div className="skel-block" style={{ width: 50, height: 12, borderRadius: 5 }} />
              </div>
              <div className="skel-block" style={{ width: '100%', height: 6, borderRadius: 3 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
