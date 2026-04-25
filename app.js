/* ═══════════════════════════════════════════════════════════
   Daily Briefings PWA — Application Logic
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── State ──────────────────────────────────────────────
  const state = {
    mode: 'auto',         // 'auto' | 'morning' | 'evening'
    dark: false,
    view: 'widgets',      // 'widgets' | 'full'
    screen: 'main',       // 'main' | { category object }
    scrollY: 0,
    morningData: null,
    eveningData: null,
    loading: true,
    settingsOpen: false,
    lastUpdated: null,
    dataUrl: '',          // configurable base URL (empty = use ./data)
  };

  // ─── Computed ───────────────────────────────────────────
  function effectiveMode() {
    if (state.mode === 'auto') {
      return new Date().getHours() < 17 ? 'morning' : 'evening';
    }
    return state.mode;
  }

  function currentData() {
    return effectiveMode() === 'morning' ? state.morningData : state.eveningData;
  }

  // ─── Data Loading ───────────────────────────────────────
  function getDataBaseUrl() {
    return (state.dataUrl && state.dataUrl.trim()) || './data';
  }

  async function loadData() {
    state.loading = true;
    render();

    const base = getDataBaseUrl().replace(/\/$/, '');
    const candidates = ['morning.json', 'evening.json', 'sample-morning.json', 'sample-evening.json'];
    const urls = {
      morning: [`${base}/morning.json`, `${base}/sample-morning.json`],
      evening: [`${base}/evening.json`, `${base}/sample-evening.json`],
    };

    async function tryFetch(list) {
      for (const u of list) {
        try {
          const r = await fetch(`${u}?t=${Date.now()}`);
          if (r.ok) return await r.json();
        } catch {}
      }
      return null;
    }

    try {
      const [m, e] = await Promise.all([tryFetch(urls.morning), tryFetch(urls.evening)]);
      if (m) state.morningData = m;
      if (e) state.eveningData = e;

      if (state.morningData) localStorage.setItem('db_morning', JSON.stringify(state.morningData));
      if (state.eveningData) localStorage.setItem('db_evening', JSON.stringify(state.eveningData));
      state.lastUpdated = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch (e) {
      console.warn('Fetch failed', e);
    }

    if (!state.morningData) {
      try { state.morningData = JSON.parse(localStorage.getItem('db_morning')); } catch {}
    }
    if (!state.eveningData) {
      try { state.eveningData = JSON.parse(localStorage.getItem('db_evening')); } catch {}
    }

    state.loading = false;
    render();
  }

  // ─── Persistence ────────────────────────────────────────
  function loadPrefs() {
    try {
      const saved = JSON.parse(localStorage.getItem('db_prefs') || '{}');
      if (saved.mode) state.mode = saved.mode;
      if (saved.dark !== undefined) state.dark = saved.dark;
      if (saved.view) state.view = saved.view;
      if (saved.dataUrl !== undefined) state.dataUrl = saved.dataUrl;
    } catch {}
    applyTheme();
  }

  function savePrefs() {
    localStorage.setItem('db_prefs', JSON.stringify({
      mode: state.mode,
      dark: state.dark,
      view: state.view,
      dataUrl: state.dataUrl,
    }));
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.dark ? 'dark' : 'light');
  }

  // ─── Helpers ────────────────────────────────────────────
  function formatDate(dateStr) {
    if (!dateStr) {
      const now = new Date();
      return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  }

  function shortDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len - 1) + '…' : str;
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function formatTime(timeStr) {
    if (!timeStr) return '';
    return timeStr.replace(' AM', 'a').replace(' PM', 'p');
  }

  // ─── Chevron SVG ────────────────────────────────────────
  const chevronBack = `<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // ─── Render Engine ──────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);

  function render() {
    const app = $('#app');
    if (!app) return;

    const mode = effectiveMode();
    const data = currentData();
    const dateStr = data?.date ? formatDate(data.date) : formatDate();

    app.innerHTML = `
      <div class="status-bar-spacer"></div>
      ${renderHeaderBar(dateStr)}
      <div class="content-scroll" id="content-scroll">
        ${state.view === 'full' ? renderMasthead(mode, dateStr) : ''}
        ${state.loading ? renderLoading() : renderScreen(mode, data)}
      </div>
      ${renderSettingsOverlay()}
    `;

    bindEvents();
  }

  function renderHeaderBar(dateStr) {
    const mode = effectiveMode();
    return `
      <div class="header-bar">
        <div class="header-bar__date">${escapeHtml(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))}</div>
        <div class="header-bar__actions">
          <div class="view-toggle">
            <button class="view-toggle__btn ${state.view === 'widgets' ? 'view-toggle__btn--active' : ''}"
                    data-action="set-view" data-view="widgets">Widgets</button>
            <button class="view-toggle__btn ${state.view === 'full' ? 'view-toggle__btn--active' : ''}"
                    data-action="set-view" data-view="full">Full</button>
          </div>
          <div class="mode-toggle">
            <button class="mode-toggle__btn ${mode === 'morning' ? 'mode-toggle__btn--active' : ''}"
                    data-action="set-mode" data-mode="morning">☀</button>
            <button class="mode-toggle__btn ${mode === 'evening' ? 'mode-toggle__btn--active' : ''}"
                    data-action="set-mode" data-mode="evening">◑</button>
          </div>
          <button class="header-bar__btn" data-action="toggle-settings" aria-label="Settings">⚙</button>
        </div>
      </div>
    `;
  }

  function renderMasthead(mode, dateStr) {
    return `
      <div class="masthead" id="masthead">
        <div class="masthead__border">
          <div class="masthead__title">${mode === 'morning' ? 'Morning Briefing' : 'Evening Briefing'}</div>
        </div>
        <div class="masthead__date">${escapeHtml(dateStr)}</div>
      </div>
    `;
  }

  function renderLoading() {
    return `
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading briefing…</div>
      </div>
    `;
  }

  function renderScreen(mode, data) {
    if (!data) return renderEmpty(mode);

    if (typeof state.screen === 'object') {
      return renderCategoryDetail(state.screen);
    }

    if (state.view === 'widgets') {
      return renderWidgetHome(mode, data);
    }

    return mode === 'morning' ? renderMorning(data) : renderEvening(data);
  }

  function renderEmpty(mode) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">${mode === 'morning' ? '☀️' : '🌙'}</div>
        <div class="empty-state__title">No briefing available</div>
        <div class="empty-state__subtitle">Your ${mode} briefing hasn't been generated yet today.</div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // WIDGET HOME — stack of Large + Medium + Small cards
  // ═══════════════════════════════════════════════════════════

  function renderWidgetHome(mode, data) {
    return `
      <div class="screen widget-stack">
        ${renderWidgetLarge(mode, data)}
        ${renderWidgetMedium(mode, data)}
        ${renderWidgetSmall(mode, data)}
        ${state.lastUpdated ? `<div class="last-updated">Updated ${state.lastUpdated}</div>` : ''}
      </div>
    `;
  }

  function widgetMasthead(mode, compact = true) {
    return `
      <div class="widget-masthead ${compact ? 'widget-masthead--compact' : ''}">
        <div class="widget-masthead__border">
          <div class="widget-masthead__title">${mode === 'morning' ? 'Morning Briefing' : 'Evening Briefing'}</div>
        </div>
      </div>
    `;
  }

  // ─── Widget: Large ──────────────────────────────────────
  function renderWidgetLarge(mode, data) {
    if (mode === 'morning') {
      const sections = data.sections || [];
      const top = sections[0]?.stories?.[0];
      const topLabel = sections[0]?.label || '';
      return `
        <div class="widget-card widget-card--large">
          ${widgetMasthead(mode, false)}
          ${top ? `
            <div class="widget-top-story" data-action="open-category" data-index="0">
              <div class="widget-label">Top Story</div>
              <div class="widget-top-story__headline">${escapeHtml(top.headline)}</div>
              <div class="widget-mono">${escapeHtml(top.source || '')} · ${escapeHtml(top.time || '')}</div>
            </div>
          ` : ''}
          <div class="widget-rule widget-rule--thick"></div>
          <div class="widget-cat-grid">
            ${sections.map((cat, i) => {
              const isRight = i % 2 === 1;
              const isBottom = i >= sections.length - (sections.length % 2 === 0 ? 2 : 1);
              return `
                <div class="widget-cat-cell ${!isRight ? 'widget-cat-cell--border-right' : ''} ${!isBottom ? 'widget-cat-cell--border-bottom' : ''}"
                     data-action="open-category" data-index="${i}">
                  <div class="widget-cat-cell__name">${escapeHtml(cat.label)}</div>
                  <div class="widget-mono">${cat.count || cat.stories?.length || 0}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }
    // Evening
    const weather = data.weather || {};
    const home = weather.home || {};
    const travel = weather.travel || null;
    const calendar = data.calendar || [];
    const dueToday = (data.tasks?.due_tomorrow || []).slice(0, 3);
    return `
      <div class="widget-card widget-card--large" data-action="open-full">
        ${widgetMasthead(mode, false)}
        <div class="widget-weather-row">
          <div class="widget-weather">
            <div class="widget-weather__city">${escapeHtml(home.city || 'Home')}</div>
            <div class="widget-weather__temp">${home.hi ?? '--'}° / ${home.lo ?? '--'}°</div>
            <div class="widget-weather__cond">${escapeHtml(home.condition || '')}</div>
          </div>
          ${travel && travel.city ? `
            <div class="widget-weather widget-weather--travel">
              <div class="widget-weather__city">✈ ${escapeHtml(travel.city)}</div>
              <div class="widget-weather__temp">${travel.hi ?? '--'}° / ${travel.lo ?? '--'}°</div>
              <div class="widget-weather__cond">${escapeHtml(travel.condition || '')}</div>
            </div>
          ` : ''}
        </div>
        <div class="widget-rule widget-rule--thick"></div>
        ${calendar.length ? `
          <div class="widget-section">
            <div class="widget-label">Tomorrow</div>
            ${calendar.slice(0, 4).map(ev => `
              <div class="widget-event">
                <span class="widget-event__time">${escapeHtml(formatTime(ev.time))}</span>
                <span class="widget-event__title">${escapeHtml(ev.title)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${dueToday.length ? `
          <div class="widget-rule"></div>
          <div class="widget-section">
            <div class="widget-label">Asana — Due Today</div>
            ${dueToday.map(t => `
              <div class="widget-task">
                <div class="widget-task__check"></div>
                <div class="widget-task__name">${escapeHtml(t.task)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // ─── Widget: Medium ─────────────────────────────────────
  function renderWidgetMedium(mode, data) {
    if (mode === 'morning') {
      const sections = data.sections || [];
      const top = sections[0]?.stories?.[0];
      const topLabel = sections[0]?.label || '';
      const cats = sections.slice(0, 4);
      return `
        <div class="widget-card widget-card--medium">
          ${widgetMasthead(mode)}
          <div class="widget-medium-body">
            ${top ? `
              <div class="widget-medium-left" data-action="open-category" data-index="0">
                <div class="widget-label">Top Story</div>
                <div class="widget-medium-left__headline">${escapeHtml(truncate(top.headline, 90))}</div>
                <div class="widget-mono">${escapeHtml(topLabel)} · ${escapeHtml(top.time || '')}</div>
              </div>
            ` : ''}
            <div class="widget-medium-right">
              ${cats.map((cat, i) => `
                <div class="widget-medium-cat ${i < cats.length - 1 ? 'widget-medium-cat--border' : ''}"
                     data-action="open-category" data-index="${i}">
                  <span class="widget-medium-cat__name">${escapeHtml(cat.label)}</span>
                  <span class="widget-mono">${cat.count || cat.stories?.length || 0}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }
    // Evening
    const weather = data.weather || {};
    const home = weather.home || {};
    const travel = weather.travel || null;
    const calendar = (data.calendar || []).slice(0, 3);
    return `
      <div class="widget-card widget-card--medium" data-action="open-full">
        ${widgetMasthead(mode)}
        <div class="widget-medium-body">
          <div class="widget-medium-weather">
            <div class="widget-weather__city">${escapeHtml(home.city || 'Home')}</div>
            <div class="widget-medium-weather__temp">${home.hi ?? '--'}°</div>
            <div class="widget-weather__cond">${escapeHtml(home.condition || '')}</div>
            ${travel && travel.city ? `
              <div class="widget-medium-weather__divider"></div>
              <div class="widget-weather__city">✈ ${escapeHtml(travel.city)}</div>
              <div class="widget-medium-weather__temp widget-medium-weather__temp--small">${travel.hi ?? '--'}°</div>
              <div class="widget-weather__cond">${escapeHtml(travel.condition || '')}</div>
            ` : ''}
          </div>
          <div class="widget-medium-right">
            <div class="widget-label">Tomorrow</div>
            ${calendar.length ? calendar.map(ev => `
              <div class="widget-event">
                <span class="widget-event__time">${escapeHtml(formatTime(ev.time))}</span>
                <span class="widget-event__title">${escapeHtml(truncate(ev.title, 28))}</span>
              </div>
            `).join('') : '<div class="widget-mono widget-mono--muted">Nothing scheduled</div>'}
          </div>
        </div>
      </div>
    `;
  }

  // ─── Widget: Small ──────────────────────────────────────
  function renderWidgetSmall(mode, data) {
    if (mode === 'morning') {
      const sections = data.sections || [];
      const top = sections[0]?.stories?.[0];
      const totalStories = sections.reduce((sum, s) => sum + (s.count || s.stories?.length || 0), 0);
      const totalCats = sections.length;
      return `
        <div class="widget-card widget-card--small" data-action="open-category" data-index="0">
          ${widgetMasthead(mode)}
          <div class="widget-small-body">
            <div class="widget-small__headline">${escapeHtml(truncate(top?.headline || '', 70))}</div>
            <div class="widget-small__footer">
              <div class="widget-mono">${totalCats} categories</div>
              <div class="widget-small__count">${totalStories}</div>
              <div class="widget-small__count-label">stories today</div>
            </div>
          </div>
        </div>
      `;
    }
    // Evening
    const weather = data.weather || {};
    const home = weather.home || {};
    const calendar = data.calendar || [];
    const next = calendar[0];
    return `
      <div class="widget-card widget-card--small" data-action="open-full">
        ${widgetMasthead(mode)}
        <div class="widget-small-body">
          <div class="widget-small__big-temp">${home.hi ?? '--'}°</div>
          <div class="widget-small__cond">${escapeHtml(home.condition || '')}</div>
          <div class="widget-rule"></div>
          ${next ? `
            <div class="widget-small__next">
              <div class="widget-small__next-title">${escapeHtml(truncate(next.title, 22))}</div>
              <div class="widget-mono">${escapeHtml(formatTime(next.time))}</div>
            </div>
          ` : `<div class="widget-mono widget-mono--muted">Nothing scheduled</div>`}
        </div>
      </div>
    `;
  }

  // ═══════════════════════════════════════════════════════════
  // FULL VIEW — existing newspaper layout
  // ═══════════════════════════════════════════════════════════

  function renderMorning(data) {
    const sections = data.sections || [];
    const topSection = sections[0];
    const topStory = topSection?.stories?.[0];

    return `
      <div class="screen content-padding">
        ${topStory ? `
          <div class="top-story">
            <div class="top-story__label">Top Story</div>
            <div class="top-story__content" data-action="open-category" data-index="0">
              <div class="top-story__headline">${escapeHtml(topStory.headline)}</div>
              <div class="top-story__meta">
                <span class="top-story__source">${escapeHtml(topStory.source || '')} · ${escapeHtml(topStory.time || '')}</span>
                <span class="top-story__category">${escapeHtml(topSection.label)} →</span>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="category-grid-header">
          <div class="category-grid-header__label">All Sections</div>
        </div>
        <div class="category-grid">
          ${sections.map((cat, i) => {
            const isRight = i % 2 === 1;
            const isLastRow = i >= sections.length - 2;
            const isLastSingle = sections.length % 2 === 1 && i === sections.length - 1;
            return `
              <div class="category-cell ${isRight ? 'category-cell--right' : ''} ${!isRight ? 'category-cell--border-right' : ''} ${!isLastRow && !isLastSingle ? 'category-cell--border-bottom' : ''}"
                   data-action="open-category" data-index="${i}">
                <div class="category-cell__top">
                  <div class="category-cell__name">${escapeHtml(cat.label)}</div>
                  <div class="category-cell__badge">${cat.count || cat.stories?.length || 0}</div>
                </div>
                <div class="category-cell__preview">${escapeHtml(truncate(cat.stories?.[0]?.headline || '', 65))}</div>
              </div>
            `;
          }).join('')}
        </div>

        ${state.lastUpdated ? `<div class="last-updated">Updated ${state.lastUpdated}</div>` : ''}
      </div>
    `;
  }

  function renderCategoryDetail(cat) {
    return `
      <div class="screen screen--slide-in content-padding">
        <div class="category-back" data-action="go-back">
          ${chevronBack}
          <span class="category-back__text">Briefing</span>
        </div>
        <div class="category-detail">
          <div class="category-detail__count">${cat.count || cat.stories?.length || 0} Stories</div>
          <div class="category-detail__title">${escapeHtml(cat.label)}</div>
        </div>
        ${(cat.stories || []).map(s => `
          <div class="story-item">
            <div class="story-item__headline">
              ${escapeHtml(s.headline)}
              ${s.flagged ? '<span class="story-item__flag">⚡</span>' : ''}
            </div>
            ${s.summary ? `<div class="story-item__summary">${escapeHtml(s.summary)}</div>` : ''}
            <div class="story-item__meta">
              <span class="story-item__source">${escapeHtml(s.source || '')}</span>
              <span class="story-item__dot">·</span>
              <span class="story-item__time">${escapeHtml(s.time || '')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderEvening(data) {
    const weather = data.weather || {};
    const calendar = data.calendar || [];
    const tasks = data.tasks || {};
    const hasTravel = weather.travel && weather.travel.city;

    return `
      <div class="screen content-padding">
        ${renderWeather(weather, hasTravel)}
        <div class="hard-rule"></div>
        ${renderCalendar(calendar)}
        <div class="hard-rule"></div>
        ${renderTasks(tasks)}
        ${state.lastUpdated ? `<div class="last-updated">Updated ${state.lastUpdated}</div>` : ''}
      </div>
    `;
  }

  function renderWeather(weather, hasTravel) {
    const home = weather.home || {};
    const travel = weather.travel || {};
    return `
      <div class="weather-section">
        <div class="section-header">Weather</div>
        <div class="weather-blocks" style="margin-top: 10px;">
          <div class="weather-block ${hasTravel ? '' : 'weather-block--full'}" style="${hasTravel ? 'padding-right:14px;' : ''}">
            <div class="weather-block__city">${escapeHtml(home.city || 'Home')}</div>
            <div class="weather-block__temp">
              <span class="weather-block__hi">${home.hi || '--'}°</span>
              <span class="weather-block__lo">/ ${home.lo || '--'}°</span>
            </div>
            <div class="weather-block__condition">${escapeHtml(home.condition || '')}</div>
          </div>
          ${hasTravel ? `
            <div class="weather-block weather-block--travel">
              <div class="weather-block__city">✈ ${escapeHtml(travel.city)}</div>
              <div class="weather-block__temp">
                <span class="weather-block__hi">${travel.hi || '--'}°</span>
                <span class="weather-block__lo">/ ${travel.lo || '--'}°</span>
              </div>
              <div class="weather-block__condition">${escapeHtml(travel.condition || '')}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  function renderCalendar(calendar) {
    if (!calendar.length) return '';
    return `
      <div class="calendar-section">
        <div class="section-header">Tomorrow</div>
        ${calendar.map(ev => `
          <div class="calendar-event">
            <div class="calendar-event__time">${escapeHtml(formatTime(ev.time))}</div>
            <div class="calendar-event__info">
              <div class="calendar-event__title">${escapeHtml(ev.title)}</div>
              <div class="calendar-event__cal">
                <div class="calendar-event__dot" style="background: ${ev.color || '#999'}"></div>
                <span class="calendar-event__cal-name">${escapeHtml(ev.calendar || '')}</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderTasks(tasks) {
    const dueTomorrow = tasks.due_tomorrow || [];
    const overdue = tasks.overdue || [];
    if (!dueTomorrow.length && !overdue.length) return '';

    return `
      <div class="tasks-section">
        <div class="section-header">Asana — Due Today</div>
        ${dueTomorrow.length ? `
          ${dueTomorrow.map(t => `
            <div class="task-item">
              <div class="task-item__check"></div>
              <div class="task-item__info">
                <div class="task-item__name">${escapeHtml(t.task)}</div>
                ${t.project ? `<div class="task-item__project">${escapeHtml(t.project)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        ` : ''}
        ${overdue.length ? `
          <div class="task-group-label">Overdue</div>
          ${overdue.map(t => `
            <div class="task-item task-item--overdue">
              <div class="task-item__check"></div>
              <div class="task-item__info">
                <div class="task-item__name">${escapeHtml(t.task)}</div>
                ${t.project ? `<div class="task-item__project">${escapeHtml(t.project)}</div>` : ''}
                ${t.due ? `<div class="task-item__due">Due ${shortDate(t.due)}</div>` : ''}
              </div>
            </div>
          `).join('')}
        ` : ''}
      </div>
    `;
  }

  // ─── Settings Overlay ───────────────────────────────────
  function renderSettingsOverlay() {
    return `
      <div class="settings-overlay ${state.settingsOpen ? 'settings-overlay--visible' : ''}" id="settings-overlay">
        <div class="settings-panel">
          <div class="settings-panel__handle"></div>
          <div class="settings-panel__title">Settings</div>

          <div class="settings-row">
            <span class="settings-row__label">View</span>
            <div class="view-toggle">
              <button class="view-toggle__btn ${state.view === 'widgets' ? 'view-toggle__btn--active' : ''}"
                      data-action="set-view" data-view="widgets">Widgets</button>
              <button class="view-toggle__btn ${state.view === 'full' ? 'view-toggle__btn--active' : ''}"
                      data-action="set-view" data-view="full">Full</button>
            </div>
          </div>

          <div class="settings-row">
            <span class="settings-row__label">Mode</span>
            <div class="mode-toggle">
              <button class="mode-toggle__btn ${state.mode === 'auto' ? 'mode-toggle__btn--active' : ''}"
                      data-action="set-pref-mode" data-pmode="auto">Auto</button>
              <button class="mode-toggle__btn ${state.mode === 'morning' ? 'mode-toggle__btn--active' : ''}"
                      data-action="set-pref-mode" data-pmode="morning">☀</button>
              <button class="mode-toggle__btn ${state.mode === 'evening' ? 'mode-toggle__btn--active' : ''}"
                      data-action="set-pref-mode" data-pmode="evening">◑</button>
            </div>
          </div>

          <div class="settings-row">
            <span class="settings-row__label">Dark Mode</span>
            <button class="toggle-switch ${state.dark ? 'toggle-switch--on' : ''}"
                    data-action="toggle-dark">
              <div class="toggle-switch__knob"></div>
            </button>
          </div>

          <div class="settings-row settings-row--stack">
            <span class="settings-row__label">Briefings URL</span>
            <input class="settings-row__input"
                   type="text"
                   inputmode="url"
                   placeholder="./data  (or https://you.github.io/repo/data)"
                   value="${escapeHtml(state.dataUrl)}"
                   data-action="set-data-url" />
            <span class="settings-row__hint">Base URL holding morning.json + evening.json</span>
          </div>

          <div class="settings-row">
            <span class="settings-row__label">Refresh</span>
            <button class="settings-row__action" data-action="refresh">Reload now</button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── Event Binding ──────────────────────────────────────
  function bindEvents() {
    const scroll = $('#content-scroll');
    const masthead = $('#masthead');
    if (scroll && masthead) {
      scroll.addEventListener('scroll', () => {
        const y = scroll.scrollTop;
        masthead.style.opacity = Math.max(0, 1 - y / 60);
      }, { passive: true });
    }

    const overlay = $('#settings-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          state.settingsOpen = false;
          render();
        }
      });
    }

    // Bind URL input change without re-rendering on every keystroke
    const urlInput = document.querySelector('.settings-row__input');
    if (urlInput) {
      urlInput.addEventListener('change', (e) => {
        state.dataUrl = e.target.value.trim();
        savePrefs();
        loadData();
      });
    }
  }

  function handleClick(e) {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    // Skip clicks on the URL input (it has its own change handler)
    if (target.tagName === 'INPUT') return;

    const action = target.dataset.action;

    switch (action) {
      case 'set-mode': {
        state.mode = target.dataset.mode;
        state.screen = 'main';
        savePrefs();
        render();
        const scroll = $('#content-scroll');
        if (scroll) scroll.scrollTop = 0;
        break;
      }

      case 'set-view': {
        state.view = target.dataset.view;
        state.screen = 'main';
        savePrefs();
        render();
        const scroll = $('#content-scroll');
        if (scroll) scroll.scrollTop = 0;
        break;
      }

      case 'open-category': {
        const idx = parseInt(target.dataset.index);
        const data = currentData();
        if (data?.sections?.[idx]) {
          state.screen = data.sections[idx];
          render();
          const scroll = $('#content-scroll');
          if (scroll) scroll.scrollTop = 0;
        }
        break;
      }

      case 'open-full': {
        state.view = 'full';
        state.screen = 'main';
        savePrefs();
        render();
        const scroll = $('#content-scroll');
        if (scroll) scroll.scrollTop = 0;
        break;
      }

      case 'go-back': {
        state.screen = 'main';
        render();
        break;
      }

      case 'toggle-settings': {
        state.settingsOpen = !state.settingsOpen;
        render();
        break;
      }

      case 'set-pref-mode': {
        state.mode = target.dataset.pmode;
        state.screen = 'main';
        savePrefs();
        render();
        break;
      }

      case 'toggle-dark': {
        state.dark = !state.dark;
        applyTheme();
        savePrefs();
        render();
        break;
      }

      case 'refresh': {
        loadData();
        break;
      }
    }
  }

  document.addEventListener('click', handleClick);

  // ─── Init ───────────────────────────────────────────────
  function init() {
    loadPrefs();
    render();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
