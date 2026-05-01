// PA GA Guide — Committee detail, Settings.
// All bill rendering moved out: per-member legislation now links out
// to palegis.us; per-committee active-bill rendering is replaced with
// a link to the committee's palegis page where current bill activity
// and co-sponsorship memos live.

function CommitteeScreen({ name, go }) {
  const c = COMMITTEES.find(x => x.name === name) || COMMITTEES[0];
  const members = c.members.map(id => LEGISLATORS.find(m => m.id === id)).filter(Boolean);
  const chair = members.find(m => m.id === c.chair);
  const minChair = members.find(m => m.id === c.minChair);
  const others = members
    .filter(m => m.id !== c.chair && m.id !== c.minChair)
    .sort((a, b) => lastName(a.name).localeCompare(lastName(b.name)));

  return (
    <>
      <div className="navbar">
        <div className="back" onClick={() => go('back')}><Icon name="back" size={18}/></div>
        <div className="title">Committee</div>
        <div className="actions"/>
      </div>

      <div className="scroll">
        <div style={{ padding: '0 16px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
            {c.chamber === 'S' ? 'Senate' : 'House'} Standing Committee
          </div>
          <div className="serif" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.1, letterSpacing: -0.5 }}>
            {c.name}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
            {members.length} members
          </div>
        </div>

        {chair && (
          <>
            <div className="section-head"><span className="label">Chair</span></div>
            <div className="card" style={{ margin: '0 16px' }}>
              <MemberRow m={chair} onClick={() => go('profile', { id: chair.id })}/>
            </div>
          </>
        )}
        {minChair && (
          <>
            <div className="section-head"><span className="label">Minority Chair</span></div>
            <div className="card" style={{ margin: '0 16px' }}>
              <MemberRow m={minChair} onClick={() => go('profile', { id: minChair.id })}/>
            </div>
          </>
        )}
        <div className="section-head"><span className="label">Members</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          {others.map(m => <MemberRow key={m.id} m={m} onClick={() => go('profile', { id: m.id })}/>)}
        </div>

        <div className="tab-padding"/>
      </div>
    </>
  );
}

function CommitteesScreen({ go }) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  const senate = COMMITTEES.filter(c => c.chamber === 'S').sort(byName);
  const house = COMMITTEES.filter(c => c.chamber === 'H').sort(byName);
  return (
    <>
      <div style={{ padding: '8px 16px 4px' }}>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, marginBottom: 4 }}>Committees</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{COMMITTEES.length} standing committees</div>
      </div>
      <div className="scroll">
        <div className="section-head"><span className="label">Senate</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          {senate.map(c => (
            <div key={c.id} className="row" onClick={() => go('committee', { name: c.name })}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {c.members.length} members
                </div>
              </div>
              <Icon name="chev-r" size={16} color="var(--ink-4)"/>
            </div>
          ))}
        </div>
        <div className="section-head"><span className="label">House</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          {house.map(c => (
            <div key={c.id} className="row" onClick={() => go('committee', { name: c.name })}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {c.members.length} members
                </div>
              </div>
              <Icon name="chev-r" size={16} color="var(--ink-4)"/>
            </div>
          ))}
        </div>
        <div className="tab-padding"/>
      </div>
    </>
  );
}

function SettingsScreen({ go }) {
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastSync, setLastSync] = React.useState(LAST_SYNC);
  const refresh = () => {
    setRefreshing(true);
    setTimeout(() => { setLastSync(new Date().toISOString()); setRefreshing(false); }, 1400);
  };
  return (
    <>
      <div style={{ padding: '8px 16px 4px' }}>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, marginBottom: 4 }}>Settings</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>PA GA Guide · v1.0 · Pa. Rural Electric Assn.</div>
      </div>
      <div className="scroll">
        <div className="section-head"><span className="label">Data</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          <div className="row" onClick={refresh}>
            <Icon name="refresh" size={20} color="var(--fed-blue)"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{refreshing ? 'Refreshing…' : 'Refresh now'}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Last synced {fmtDate(lastSync)} · auto-syncs monthly</div>
            </div>
          </div>
          <div className="row">
            <Icon name="ext" size={20} color="var(--ink-3)"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Source</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>palegis.us · official</div>
            </div>
            <Icon name="chev-r" size={16} color="var(--ink-4)"/>
          </div>
          <div className="row">
            <Icon name="circle" size={20} color="var(--ink-3)"/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Offline cache</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>4.2 MB · {LEGISLATORS.length} members</div>
            </div>
          </div>
        </div>

        <div className="section-head"><span className="label">REA settings</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Co-op territory tags</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Show on cards & lists</div>
            </div>
            <div style={{ width: 44, height: 26, borderRadius: 13, background: 'var(--rea-green)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
            </div>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Highlight REA-relevant bills</div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>Energy, telecom, ROW, ag</div>
            </div>
            <div style={{ width: 44, height: 26, borderRadius: 13, background: 'var(--rea-green)', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: 11, background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
            </div>
          </div>
        </div>

        <div className="section-head"><span className="label">About</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Privacy</div>
            </div>
            <Icon name="chev-r" size={16} color="var(--ink-4)"/>
          </div>
          <div className="row">
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Send feedback</div>
            </div>
            <Icon name="chev-r" size={16} color="var(--ink-4)"/>
          </div>
        </div>

        <div className="tab-padding"/>
      </div>
    </>
  );
}

window.CommitteeScreen = CommitteeScreen;
window.CommitteesScreen = CommitteesScreen;
window.SettingsScreen = SettingsScreen;
