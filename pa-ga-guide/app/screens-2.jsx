// PA GA Guide — Bills list, Committee detail, Bookmarks, Settings.

// ── SCREEN: Tracked Bills ────────────────────────────────────────
// Shows every bill listed in rea-overlay.json's reaBills, resolved by the
// scraper into trackedBills. This is the authoritative REA tracking view —
// independent of the per-member prime-sponsor cap on billsBySponsor.
function TrackedScreen({ go }) {
  const all = window.TRACKED_BILLS || [];
  const [chamber, setChamber] = React.useState('all');  // all | S | H
  const [statusKind, setStatusKind] = React.useState('all'); // all | go | wait | stop

  const filtered = all.filter(b => {
    if (chamber !== 'all' && b.primeSponsorChamber !== chamber) return false;
    if (statusKind !== 'all' && b.statusKind !== statusKind) return false;
    return true;
  });

  // Sort: most recently active first, then by chamber, then number.
  const sorted = [...filtered].sort((a, b) => {
    const order = { go: 0, wait: 1, stop: 2 };
    if (order[a.statusKind] !== order[b.statusKind]) {
      return (order[a.statusKind] ?? 9) - (order[b.statusKind] ?? 9);
    }
    return a.num.localeCompare(b.num, undefined, { numeric: true });
  });

  return (
    <>
      <div style={{ padding: '8px 16px 4px' }}>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, marginBottom: 4 }}>Tracked Bills</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {all.length} bills tracked · {all.filter(b => b.statusKind === 'go').length} moving · {all.filter(b => b.statusKind === 'stop').length} stalled
        </div>
      </div>
      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
          {[['all','All chambers'],['S','Senate'],['H','House']].map(([id,l]) =>
            <div key={id} className={'chip' + (chamber === id ? ' active' : '')} onClick={() => setChamber(id)}>{l}</div>
          )}
          <div style={{ width: 1, background: 'var(--line)', margin: '6px 4px', flexShrink: 0 }}/>
          {[['all','All status'],['go','Moving'],['wait','Pending'],['stop','Stalled']].map(([id,l]) =>
            <div key={id} className={'chip' + (statusKind === id ? ' active' : '')} onClick={() => setStatusKind(id)}>{l}</div>
          )}
        </div>
      </div>
      <div className="scroll">
        <div className="section-head">
          <span className="label">{sorted.length} bill{sorted.length === 1 ? '' : 's'}</span>
        </div>
        <div className="card" style={{ margin: '0 16px' }}>
          {sorted.map((b, i) => (
            <TrackedBillRow
              key={b.num + '-' + i}
              b={b}
              onSponsor={b.primeSponsorId ? () => go('profile', { id: b.primeSponsorId }) : null}
            />
          ))}
          {sorted.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No bills match these filters
            </div>
          )}
        </div>
        <div className="tab-padding"/>
      </div>
    </>
  );
}

function TrackedBillRow({ b, onSponsor }) {
  const stopProp = (e) => { e.stopPropagation(); e.preventDefault(); };
  return (
    <a href={palegisUrl(b.num)} target="_blank" rel="noopener" style={{ textDecoration: 'none', color: 'inherit' }}>
      <div className="bill rea">
        <div className="head">
          <span className="num">{b.num}</span>
          <span className="tag coop" style={{ height: 16, fontSize: 10, padding: '0 6px' }}>REA</span>
          <div style={{ flex: 1 }}/>
          <Icon name="ext" size={13} color="var(--ink-4)"/>
        </div>
        <div className="summary">{b.title || '(no synopsis on palegis)'}</div>
        <div className={'status ' + statusClass(b.statusKind)} style={{ marginBottom: b.primeSponsorName ? 4 : 0 }}>
          <span className="dot"/>
          <span>{b.status || '—'}</span>
          {b.lastAction && <>
            <span style={{ color: 'var(--ink-4)' }}>·</span>
            <span>{b.lastAction}</span>
          </>}
        </div>
        {b.primeSponsorName && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
            Prime:{' '}
            <span
              onClick={onSponsor ? (e) => { stopProp(e); onSponsor(); } : undefined}
              style={{ color: onSponsor ? 'var(--fed-blue)' : 'var(--ink-3)', cursor: onSponsor ? 'pointer' : 'default', fontWeight: onSponsor ? 500 : 400 }}
            >{b.primeSponsorName}</span>
          </div>
        )}
      </div>
    </a>
  );
}

function BillsScreen({ id, go }) {
  const m = LEGISLATORS.find(x => x.id === id);
  const all = (BILLS_BY_SPONSOR[id] || []);
  const [role, setRole] = React.useState('all');     // all | prime | cosp
  const [topic, setTopic] = React.useState('all');   // all | Energy | Telecom | Ag | Tax

  const filtered = all.filter(b => {
    if (role === 'prime' && b.role !== 'PRIME') return false;
    if (role === 'cosp'  && b.role !== 'CO-SPONSOR') return false;
    if (topic !== 'all' && b.topic !== topic) return false;
    return true;
  });

  const topics = Array.from(new Set(all.map(b => b.topic)));

  return (
    <>
      <div className="navbar">
        <div className="back" onClick={() => go('back')}><Icon name="back" size={18}/></div>
        <div className="title">{lastName(m.name)} · Bills</div>
        <div className="actions"/>
      </div>

      <div style={{ padding: '0 16px 8px' }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 6 }}>
          {[['all','All'],['prime','Prime'],['cosp','Co-sponsor']].map(([id,l]) =>
            <div key={id} className={'chip' + (role === id ? ' active' : '')} onClick={() => setRole(id)}>{l}</div>
          )}
          <div style={{ width: 1, background: 'var(--line)', margin: '6px 4px', flexShrink: 0 }}/>
          <div className={'chip' + (topic === 'all' ? ' active' : '')} onClick={() => setTopic('all')}>All topics</div>
          {topics.map(t => (
            <div key={t} className={'chip' + (topic === t ? ' active' : '')} onClick={() => setTopic(t)}>{t}</div>
          ))}
        </div>
      </div>

      <div className="scroll">
        <div className="section-head">
          <span className="label">{filtered.length} bills</span>
          <span className="meta">{filtered.filter(b => b.rea).length} REA-relevant</span>
        </div>
        <div className="card" style={{ margin: '0 16px' }}>
          {filtered.map((b, i) => <BillRow key={i} b={b}/>)}
          {filtered.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              No bills match these filters
            </div>
          )}
        </div>
        <div className="tab-padding"/>
      </div>
    </>
  );
}

function CommitteeScreen({ name, go }) {
  const c = COMMITTEES.find(x => x.name === name) || COMMITTEES[0];
  const members = c.members.map(id => LEGISLATORS.find(m => m.id === id)).filter(Boolean);
  const chair = members.find(m => m.id === c.chair);
  const minChair = members.find(m => m.id === c.minChair);
  const others = members.filter(m => m.id !== c.chair && m.id !== c.minChair);

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
            {members.length} members · {c.activeBills.length} active bills
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

        <div className="section-head"><span className="label">Active legislation</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          {c.activeBills.map((billNum, i) => {
            // find a sample of this bill
            let sample = null;
            for (const sponsor in BILLS_BY_SPONSOR) {
              const b = BILLS_BY_SPONSOR[sponsor].find(x => x.num === billNum);
              if (b) { sample = b; break; }
            }
            if (!sample) return null;
            return <BillRow key={i} b={sample}/>;
          })}
        </div>
        <div className="tab-padding"/>
      </div>
    </>
  );
}

function CommitteesScreen({ go }) {
  const senate = COMMITTEES.filter(c => c.chamber === 'S');
  const house = COMMITTEES.filter(c => c.chamber === 'H');
  return (
    <>
      <div style={{ padding: '8px 16px 4px' }}>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, marginBottom: 4 }}>Committees</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{COMMITTEES.length} committees · {COMMITTEES.reduce((a,c)=>a+c.activeBills.length,0)} active bills</div>
      </div>
      <div className="scroll">
        <div className="section-head"><span className="label">Senate</span></div>
        <div className="card" style={{ margin: '0 16px' }}>
          {senate.map(c => (
            <div key={c.id} className="row" onClick={() => go('committee', { name: c.name })}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                  {c.members.length} members · {c.activeBills.length} active bills
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
                  {c.members.length} members · {c.activeBills.length} active bills
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

function BookmarksScreen({ go }) {
  const starred = LEGISLATORS.filter(m => m.starred);
  const coop = LEGISLATORS.filter(m => m.coop);
  return (
    <>
      <div style={{ padding: '8px 16px 4px' }}>
        <div className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5, marginBottom: 4 }}>Bookmarks</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{starred.length} starred · {coop.length} in co-op territory</div>
      </div>
      <div className="scroll">
        <div className="section-head">
          <span className="label">Starred</span>
          <span className="meta">{starred.length}</span>
        </div>
        <div className="card" style={{ margin: '0 16px' }}>
          {starred.map(m => <MemberRow key={m.id} m={m} onClick={() => go('profile', { id: m.id })}/>)}
          {starred.length === 0 && <div style={{ padding: 24, textAlign:'center', color:'var(--ink-3)', fontSize: 13 }}>No starred members yet</div>}
        </div>

        <div className="section-head">
          <span className="label">Co-op territory</span>
          <span className="meta">{coop.length}</span>
        </div>
        <div className="card" style={{ margin: '0 16px' }}>
          {coop.map(m => <MemberRow key={m.id} m={m} onClick={() => go('profile', { id: m.id })}/>)}
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
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>4.2 MB · 253 members · 187 bills</div>
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

        <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 11, color: 'var(--ink-4)' }}>
          Built for the Pennsylvania Rural Electric Association
        </div>
        <div className="tab-padding"/>
      </div>
    </>
  );
}

window.BillsScreen = BillsScreen;
window.CommitteeScreen = CommitteeScreen;
window.CommitteesScreen = CommitteesScreen;
window.BookmarksScreen = BookmarksScreen;
window.SettingsScreen = SettingsScreen;
