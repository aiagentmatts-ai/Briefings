// PA GA Guide — By-Co-op browser.
// Each co-op gets a card with a count of state + federal members.
// Tapping opens CoopDetailScreen, which lists every official whose
// territory touches that co-op (state + federal in two sections).

// ── SCREEN: By Co-op (overview) ──────────────────────────────────
function ByCoopScreen({ go }) {
  const coops = window.COOPS || [];
  const rows = coops.map(name => {
    const members = LEGISLATORS.filter(m => (m.coops || []).includes(name));
    const state   = members.filter(m => !FEDERAL_IDS.has(m.id));
    const federal = members.filter(m =>  FEDERAL_IDS.has(m.id));
    return { name, total: members.length, state: state.length, federal: federal.length };
  }).sort((a, b) => b.total - a.total);

  const totalCovered = LEGISLATORS.filter(m => m.coop).length;

  return (
    <>
      <div style={{ padding: '8px 16px 4px' }}>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, marginBottom: 4 }}>
          By Co-op
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {coops.length} co-ops · {totalCovered} elected officials covering co-op territory
        </div>
      </div>
      <div className="scroll" style={{ marginTop: 12 }}>
        <a href="https://www.prea.com/member-cooperatives" target="_blank" rel="noopener" style={{ display: 'block', margin: '0 16px 12px', textDecoration: 'none' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <img src="./data/images/prea-coop-map.jpg" alt="Pennsylvania electric cooperative service territories" style={{ display: 'block', width: '100%', height: 'auto' }}/>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--line)' }}>
              <Icon name="ext" size={13} color="var(--ink-4)"/>
              <div style={{ flex: 1, fontSize: 12, color: 'var(--ink-3)' }}>
                Service territories · prea.com
              </div>
            </div>
          </div>
        </a>
        <div className="card" style={{ margin: '0 16px' }}>
          {rows.map(r => (
            <div key={r.name} className="row" onClick={() => go('coop', { name: r.name })}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--rea-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="bolt" size={18} color="var(--rea-green)"/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: -0.2 }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {r.total} member{r.total === 1 ? '' : 's'}
                  {' · '}{r.state} state{r.federal > 0 ? ` · ${r.federal} federal` : ''}
                </div>
              </div>
              <Icon name="chev-r" size={16} color="var(--ink-4)"/>
            </div>
          ))}
          {rows.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No co-op territory data yet
            </div>
          )}
        </div>
        <div className="tab-padding"/>
      </div>
    </>
  );
}

// ── SCREEN: Co-op Detail ─────────────────────────────────────────
// Members for one specific co-op, split into Federal / State sections.
// State members sorted Senate first, then House by district number.
function CoopDetailScreen({ name, go }) {
  const members = LEGISLATORS.filter(m => (m.coops || []).includes(name));
  const byLastName = (a, b) => lastName(a.name).localeCompare(lastName(b.name));
  const federal = members.filter(m => FEDERAL_IDS.has(m.id)).sort(byLastName);
  const state   = members.filter(m => !FEDERAL_IDS.has(m.id)).sort(byLastName);

  return (
    <>
      <div className="navbar">
        <div className="back" onClick={() => go('back')}><Icon name="back" size={18}/></div>
        <div className="title">Co-op</div>
        <div className="actions"/>
      </div>

      <div className="scroll">
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--rea-green)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
            Cooperative
          </div>
          <div className="serif" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.5 }}>
            {name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {members.length} elected official{members.length === 1 ? '' : 's'} covering this territory
            {' · '}{state.length} state{federal.length > 0 ? ` · ${federal.length} federal` : ''}
          </div>
        </div>

        {federal.length > 0 && (
          <>
            <div className="section-head"><span className="label">Federal</span><span className="meta">{federal.length}</span></div>
            <div className="card" style={{ margin: '0 16px' }}>
              {federal.map(m => <MemberRow key={m.id} m={m} onClick={() => go('profile', { id: m.id })}/>)}
            </div>
          </>
        )}

        {state.length > 0 && (
          <>
            <div className="section-head"><span className="label">State</span><span className="meta">{state.length}</span></div>
            <div className="card" style={{ margin: '0 16px' }}>
              {state.map(m => <MemberRow key={m.id} m={m} onClick={() => go('profile', { id: m.id })}/>)}
            </div>
          </>
        )}

        {members.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
            No members tagged with {name} yet
          </div>
        )}
        <div className="tab-padding"/>
      </div>
    </>
  );
}

window.ByCoopScreen = ByCoopScreen;
window.CoopDetailScreen = CoopDetailScreen;
