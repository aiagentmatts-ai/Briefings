// PA GA Guide — Search (home), Profile (briefing), Bills, Committee, Bookmarks, Settings.

// ── Tab bar ───────────────────────────────────────────────────────
function TabBar({ active, go }) {
  const tabs = [
    { id: 'search',    label: 'Search',    icon: 'search' },
    { id: 'tracked',   label: 'Tracked',   icon: 'bill' },
    { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
    { id: 'committees',label: 'Committees',icon: 'cmt' },
    { id: 'settings',  label: 'Settings',  icon: 'gear' },
  ];
  return (
    <div className="tabbar">
      {tabs.map(t => (
        <div key={t.id} className={'tab' + (active === t.id ? ' active' : '')} onClick={() => go(t.id)}>
          <Icon name={t.icon} size={22} stroke={active === t.id ? 2 : 1.6}/>
          <span>{t.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Member row (used in search results & lists) ─────────────────
function MemberRow({ m, onClick, showCmte }) {
  return (
    <div className="row" onClick={onClick}>
      <PortraitAvatar id={m.id} photo={m.photo} size={48}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {chamberPrefix(m.chamber)} {m.name}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ink-3)' }}>
          <span className={'tag ' + (m.party === 'R' ? 'r' : 'd')} style={{ height: 16, fontSize: 10, padding: '0 6px' }}>{m.party}</span>
          <span className="mono">{districtLabel(m)}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <Icon name="pin" size={11}/>
          <span>{officeShort(m.office)}</span>
          {m.coop && <span className="tag coop" style={{ marginLeft: 'auto', height: 16, fontSize: 10, padding: '0 6px' }}>CO-OP</span>}
        </div>
        {showCmte && m.committees[0] && (
          <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 3 }}>
            {m.committees[0].name}{m.committees[0].role ? ` · ${m.committees[0].role}` : ''}
          </div>
        )}
      </div>
      <Icon name="chev-r" size={16} color="var(--ink-4)"/>
    </div>
  );
}

// ── SCREEN: Search (home) ────────────────────────────────────────
function SearchScreen({ go }) {
  const [q, setQ] = React.useState('');
  const [scope, setScope] = React.useState('all'); // all | senate | house | coop

  const filtered = React.useMemo(() => {
    let list = LEGISLATORS;
    if (scope === 'senate') list = list.filter(m => m.chamber === 'S');
    else if (scope === 'house') list = list.filter(m => m.chamber === 'H');
    else if (scope === 'coop') list = list.filter(m => m.coop);
    if (q.trim()) {
      const needle = q.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(needle) ||
        m.counties.some(c => c.toLowerCase().includes(needle)) ||
        String(m.district).includes(needle) ||
        officeShort(m.office).toLowerCase().includes(needle)
      );
    }
    return list;
  }, [q, scope]);

  const recent = LEGISLATORS.filter(m => ['causer','yaw','phillipshill','nelson'].includes(m.id));

  return (
    <>
      <div style={{ padding: '8px 16px 0' }}>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, marginBottom: 12 }}>
          PA General Assembly
        </div>
        <div className="search">
          <Icon name="search" size={18} color="var(--ink-3)"/>
          <input
            placeholder="Name, district, county, or room"
            value={q} onChange={(e) => setQ(e.target.value)} autoFocus={false}
          />
          {q && <div onClick={() => setQ('')} style={{ cursor: 'pointer', display: 'flex' }}>
            <Icon name="close" size={16} color="var(--ink-3)"/>
          </div>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {[['all','All'],['senate','Senate'],['house','House'],['coop','Co-op only']].map(([id,l]) => (
            <div key={id} className={'chip' + (scope === id ? ' active' : '') + (id==='coop'?' coop':'')} onClick={() => setScope(id)}>
              {id === 'coop' && <span style={{ width:6, height:6, borderRadius:3, background: scope==='coop'?'white':'var(--rea-green)', marginRight: 6 }}/>}
              {l}
            </div>
          ))}
        </div>
      </div>

      <div className="scroll" style={{ marginTop: 8 }}>
        {!q && (
          <>
            <div className="section-head"><span className="label">Recent</span></div>
            <div className="card" style={{ margin: '0 16px' }}>
              {recent.map((m, i) => (
                <MemberRow key={m.id} m={m} onClick={() => go('profile', { id: m.id })}/>
              ))}
            </div>
          </>
        )}

        <div className="section-head">
          <span className="label">{q ? `${filtered.length} results` : `All members · ${filtered.length}`}</span>
          {!q && <span className="meta">{LEGISLATORS.filter(m=>m.coop).length} in co-op territory</span>}
        </div>
        <div className="card" style={{ margin: '0 16px' }}>
          {filtered.map(m => (
            <MemberRow key={m.id} m={m} onClick={() => go('profile', { id: m.id })} showCmte/>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No members match "{q}"
            </div>
          )}
        </div>
        <div className="tab-padding"/>
      </div>
    </>
  );
}

// ── SCREEN: Profile (D1 briefing) ────────────────────────────────
function ProfileScreen({ id, go }) {
  const m = LEGISLATORS.find(x => x.id === id);
  const [starred, setStarred] = React.useState(m.starred);
  if (!m) return null;
  const bills = (BILLS_BY_SPONSOR[id] || []);
  const reaBills = bills.filter(b => b.rea);

  return (
    <>
      <div className="navbar">
        <div className="back" onClick={() => go('back')}><Icon name="back" size={18}/></div>
        <div className="title"></div>
        <div className="actions">
          <div className="icon-btn" onClick={() => setStarred(s => !s)}>
            <Icon name={starred ? 'star-fill' : 'star'} size={18} color={starred ? 'var(--brass)' : 'var(--ink)'}/>
          </div>
        </div>
      </div>

      <div className="scroll">
        {/* Hero */}
        <div style={{ padding: '4px 16px 16px' }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
            <div className="brief-photo">
              <Portrait id={m.id} photo={m.photo} w={96} h={120}/>
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
                {chamberLabel(m.chamber)} · {districtLabel(m)}
              </div>
              <div className="serif" style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.05, letterSpacing: -0.5 }}>
                {chamberPrefix(m.chamber)} {m.name}
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
                <span className={'tag ' + (m.party === 'R' ? 'r' : 'd')}>{m.party === 'R' ? 'Republican' : 'Democrat'}</span>
                {m.role && <span className="tag brass">{m.role}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Office hero block */}
        <div style={{ padding: '0 16px 12px' }}>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div className="room-hero">
              <div>
                <div className="label">Office</div>
                <div className="value">{m.office.room} {buildingShort(m.office.building)}</div>
              </div>
              <div style={{ flex: 1 }}/>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="label">Floor</div>
                <div className="floor-val">{m.office.floor}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
              {m.office.building}{m.office.wing ? ` · ${m.office.wing}` : ''}
            </div>
            <hr className="hr" style={{ margin: '12px 0' }}/>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href={`tel:${m.phone.replace(/\D/g,'')}`} style={{ flex: 1, textDecoration: 'none' }}>
                <div className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-2)' }}>
                  <Icon name="phone" size={16} color="var(--fed-blue)"/>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Capitol</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--ink)' }}>{m.phone}</div>
                  </div>
                </div>
              </a>
              <a href={`mailto:${m.email}`} style={{ flex: 1, textDecoration: 'none' }}>
                <div className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--card-2)' }}>
                  <Icon name="mail" size={16} color="var(--fed-blue)"/>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Email</div>
                    <div style={{ fontSize: 11, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.email}</div>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* District / counties */}
        <div style={{ padding: '0 16px 12px' }}>
          <div className="card" style={{ padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>District</div>
            <div style={{ fontSize: 14, lineHeight: 1.4 }}>{m.counties.join(' · ')}</div>
          </div>
        </div>

        {/* CO-OP banner */}
        {m.coop && (
          <div style={{ padding: '0 16px 12px' }}>
            <div className="coop-banner">
              <span className="dot"/>
              <div className="text">
                <b>Co-op service territory.</b> {m.coopDetail}
              </div>
            </div>
          </div>
        )}

        {/* Committees */}
        <div className="section-head">
          <span className="label">Committees</span>
        </div>
        <div className="card" style={{ margin: '0 16px' }}>
          {m.committees.map((c, i) => (
            <div key={i} className="row" onClick={() => go('committee', { name: c.name })}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div>
                {c.role && <div style={{ fontSize: 11, color: 'var(--brass)', fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 }}>{c.role}</div>}
              </div>
              <Icon name="chev-r" size={16} color="var(--ink-4)"/>
            </div>
          ))}
        </div>

        {/* Recent legislation */}
        <div className="section-head">
          <span className="label">Recent legislation</span>
          <span className="meta">Updated {fmtDate(LAST_SYNC)}</span>
        </div>
        <div className="card" style={{ margin: '0 16px' }}>
          {bills.slice(0, 3).map((b, i) => (
            <BillRow key={i} b={b}/>
          ))}
          {bills.length > 3 && (
            <div className="row" onClick={() => go('bills', { id: m.id })} style={{ justifyContent: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fed-blue)' }}>
                See all {bills.length} bills{reaBills.length > 0 ? ` · ${reaBills.length} REA-relevant` : ''}
              </div>
            </div>
          )}
        </div>

        <div className="tab-padding"/>
      </div>
    </>
  );
}

// Bill row (used in profile + bills screen)
function BillRow({ b }) {
  return (
    <a href={palegisUrl(b.num)} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className={'bill' + (b.rea ? ' rea' : '')}>
        <div className="head">
          <span className="num">{b.num}</span>
          <span className="role">{b.role}</span>
          {b.rea && <span className="tag coop" style={{ height: 16, fontSize: 10, padding: '0 6px' }}>REA</span>}
          <div style={{ flex: 1 }}/>
          <Icon name="ext" size={13} color="var(--ink-4)"/>
        </div>
        <div className="summary">{b.title}</div>
        <div className={'status ' + statusClass(b.statusKind)}>
          <span className="dot"/>
          <span>{b.status}</span>
          <span style={{ color: 'var(--ink-4)' }}>·</span>
          <span>{b.lastAction}</span>
        </div>
      </div>
    </a>
  );
}

window.TabBar = TabBar;
window.MemberRow = MemberRow;
window.SearchScreen = SearchScreen;
window.ProfileScreen = ProfileScreen;
window.BillRow = BillRow;
