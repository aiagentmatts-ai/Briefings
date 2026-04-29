// Stylized "official portrait" SVG — generated per-legislator.
// Hash the id → consistent palette + features. No real photos.

(function() {
  const PALETTES = [
    { bg:['#3a4d6b','#1f3a68'], skin:'#e8c8a8', hair:'#3a2a1c', tie:'#7a1c1c' },
    { bg:['#5a6b88','#3a4d6b'], skin:'#d8a070', hair:'#1a1a1a', tie:'#1a3a6b' },
    { bg:['#4a3a5b','#2a1f3a'], skin:'#f0d5b8', hair:'#7a4a2a', tie:'#1a4a3a' },
    { bg:['#6b5a4a','#3a2f1c'], skin:'#e0b890', hair:'#5a3a1c', tie:'#3a3a3a' },
    { bg:['#3a5b4a','#1f3a2a'], skin:'#e8c8a8', hair:'#a08060', tie:'#6b1c1c' },
    { bg:['#5b4a3a','#2a1f1c'], skin:'#d8b090', hair:'#2a2a2a', tie:'#1a3a6b' },
  ];
  function hash(s) { let h = 0; for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  function Portrait({ id, gender = 'auto', initials, w = 96, h = 120, square = true }) {
    const seed = hash(id);
    const p = PALETTES[seed % PALETTES.length];
    const fem = gender === 'f' || (gender === 'auto' && seed % 3 === 0);
    const headTilt = ((seed >> 3) % 5) - 2;
    return (
      <svg viewBox="0 0 96 120" width={w} height={h} preserveAspectRatio="xMidYMid slice"
        style={{ borderRadius: square ? 4 : '50%', display: 'block' }}>
        <defs>
          <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p.bg[0]}/>
            <stop offset="100%" stopColor={p.bg[1]}/>
          </linearGradient>
          <radialGradient id={`vig-${id}`} cx="0.5" cy="0.4" r="0.7">
            <stop offset="60%" stopColor="rgba(0,0,0,0)"/>
            <stop offset="100%" stopColor="rgba(0,0,0,0.35)"/>
          </radialGradient>
        </defs>
        {/* backdrop */}
        <rect width="96" height="120" fill={`url(#bg-${id})`}/>
        <rect width="96" height="120" fill={`url(#vig-${id})`}/>

        {/* shoulders / suit */}
        <g transform={`translate(0, 0)`}>
          <path d="M 8 120 C 16 92 28 86 48 86 C 68 86 80 92 88 120 Z" fill="#1a1a1a"/>
          {/* collar */}
          <path d="M 36 92 L 48 102 L 60 92 L 60 120 L 36 120 Z" fill="#f5f1e8"/>
          {/* tie */}
          {!fem && <>
            <path d="M 46 100 L 50 100 L 51 110 L 48 116 L 45 110 Z" fill={p.tie}/>
            <path d="M 45 99 L 51 99 L 50 102 L 46 102 Z" fill={p.tie} opacity="0.8"/>
          </>}
          {fem && <path d="M 38 96 C 42 100 54 100 58 96 L 60 120 L 36 120 Z" fill="#d8c8a0"/>}
        </g>

        {/* neck */}
        <path d="M 42 76 L 54 76 L 54 88 C 54 92 50 94 48 94 C 46 94 42 92 42 88 Z" fill={p.skin} opacity="0.92"/>

        {/* head */}
        <g transform={`rotate(${headTilt} 48 60)`}>
          {/* hair back */}
          {!fem && <path d="M 30 50 C 30 36 38 28 48 28 C 58 28 66 36 66 50 L 66 56 C 64 50 60 48 56 48 L 40 48 C 36 48 32 50 30 56 Z" fill={p.hair}/>}
          {fem && <path d="M 28 56 C 26 36 36 22 48 22 C 60 22 70 36 68 56 C 68 64 64 70 64 70 L 60 60 L 56 60 L 54 50 L 42 50 L 40 60 L 36 60 L 32 70 C 32 70 28 64 28 56 Z" fill={p.hair}/>}
          {/* face */}
          <ellipse cx="48" cy="58" rx="14" ry="17" fill={p.skin}/>
          {/* hair front */}
          {!fem && <path d="M 34 52 C 36 44 42 38 48 38 C 54 38 60 42 62 50 C 58 46 52 46 48 48 C 44 46 38 48 34 52 Z" fill={p.hair}/>}
          {fem && <path d="M 34 50 C 38 40 50 38 56 44 C 60 48 62 52 62 56 C 58 50 52 48 48 50 C 44 48 38 52 34 50 Z" fill={p.hair}/>}
          {/* eyes */}
          <ellipse cx="42" cy="60" rx="1.2" ry="1.5" fill="#1a1a1a"/>
          <ellipse cx="54" cy="60" rx="1.2" ry="1.5" fill="#1a1a1a"/>
          {/* brows */}
          <path d="M 39 56 L 45 55" stroke={p.hair} strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M 51 55 L 57 56" stroke={p.hair} strokeWidth="1.2" strokeLinecap="round"/>
          {/* nose */}
          <path d="M 48 62 L 47 67 L 49 68" stroke="#a07050" strokeWidth="0.8" fill="none" strokeLinecap="round"/>
          {/* mouth */}
          <path d="M 44 72 Q 48 74 52 72" stroke="#7a3a3a" strokeWidth="0.9" fill="none" strokeLinecap="round"/>
          {/* cheek shading */}
          <ellipse cx="40" cy="66" rx="3" ry="2" fill="#c89070" opacity="0.25"/>
          <ellipse cx="56" cy="66" rx="3" ry="2" fill="#c89070" opacity="0.25"/>
        </g>

        {/* film grain overlay */}
        <rect width="96" height="120" fill="url(#vig-${id})" opacity="0.4"/>
      </svg>
    );
  }

  // tiny avatar variant — round, just face
  function PortraitAvatar({ id, size = 44 }) {
    return (
      <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
        background: '#3a4d6b', boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.1)' }}>
        <div style={{ width: size, height: size * 1.25, marginTop: -size * 0.05 }}>
          <Portrait id={id} w={size} h={size * 1.25} square={true}/>
        </div>
      </div>
    );
  }

  Object.assign(window, { Portrait, PortraitAvatar });
})();
