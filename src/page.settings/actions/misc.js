/**
 * Load current window info
 */
async function loadCurrentWindowInfo() {
  const win = await browser.windows.getCurrent()
  this.state.private = win.incognito
  this.state.windowId = win.id
}

/**
 * Load platform info
 */
async function loadPlatformInfo() {
  const info = await browser.runtime.getPlatformInfo()
  this.state.osInfo = info
  this.state.os = info.os
}

/**
 * Load browser info
 */
async function loadBrowserInfo() {
  const info = await browser.runtime.getBrowserInfo()
  this.state.ffInfo = info
  this.state.ffVer = parseInt(info.version.slice(0, 2))
  if (isNaN(this.state.ffVer)) this.state.ffVer = 0
}

/**
 * Retrieve current permissions
 */
async function loadPermissions(init) {
  this.state.permAllUrls = await browser.permissions.contains({ origins: ['<all_urls>'] })
  this.state.permTabHide = await browser.permissions.contains({ permissions: ['tabHide'] })

  if (!this.state.permAllUrls) {
    this.state.panels.map(c => {
      if (c.proxified) c.proxified = false
      if (c.proxy) c.proxy.type = 'direct'
      if (c.includeHostsActive) c.includeHostsActive = false
      if (c.excludeHostsActive) c.excludeHostsActive = false
    })
    if (!init) this.actions.savePanels()
  }

  if (!this.state.permTabHide) {
    this.state.hideInact = false
    this.state.hideFoldedTabs = false
    if (!init) this.actions.saveSettings()
  }
}

/**
 * Check url hash and update active view
 */
function updateActiveView() {
  let hash = location.hash ? location.hash.slice(1) : location.hash
  let hashArg = hash.split('.')
  hash = hashArg[0]
  let arg = hashArg[1]
  let scrollHighlightConf = { behavior: 'smooth', block: 'center' }
  let scrollSectionConf = { behavior: 'smooth', block: 'start' }

  if (hash === 'all-urls') {
    setTimeout(() => {
      if (hash !== undefined && this.state.settingsRefs) {
        let el = this.state.settingsRefs.all_urls
        if (el) el.scrollIntoView(scrollHighlightConf)
      }
    }, 250)
    
    document.title = 'Sidebery / Settings'
    this.state.activeView = 'Settings'
    this.state.highlightedField = 'all_urls'
    return
  }

  if (hash === 'tab-hide') {
    setTimeout(() => {
      if (hash !== undefined && this.state.settingsRefs) {
        let el = this.state.settingsRefs.tab_hide
        if (el) el.scrollIntoView(scrollHighlightConf)
      }
    }, 250)

    document.title = 'Sidebery / Settings'
    this.state.activeView = 'Settings'
    this.state.highlightedField = 'tab_hide'
    return
  }

  if (this.__navLockTimeout) clearTimeout(this.__navLockTimeout)
  this.state.navLock = true
  this.state.activeSection = hash
  this.__navLockTimeout = setTimeout(() => {
    this.state.navLock = false
  }, 1250)

  if (hash.startsWith('menu_editor')) {
    setTimeout(() => {
      if (hash !== undefined && this.state.menuEditorRefs) {
        let el = this.state.menuEditorRefs[hash]
        if (el) el.scrollIntoView(scrollSectionConf)
      }
    }, this.state.activeView === 'MenuEditor' ? 0 : 250)

    document.title = 'Sidebery / Menu Editor'
    this.state.activeView = 'MenuEditor'
    this.state.highlightedField = ''
    return
  }

  if (hash.startsWith('styles_editor')) {
    document.title = 'Sidebery / Styles Editor'
    this.state.activeView = 'StylesEditor'
    this.state.activeSection = 'styles_editor'
    this.state.highlightedField = ''
    return
  }

  if (hash.startsWith('snapshots')) {
    document.title = 'Sidebery / Snapshots'
    this.state.activeView = 'Snapshots'
    this.state.activeSection = 'snapshots'
    this.state.highlightedField = ''
    return
  }

  setTimeout(() => {
    if (hash !== undefined && this.state.settingsRefs) {
      let el = this.state.settingsRefs[hash]
      if (el) el.scrollIntoView(scrollSectionConf)
    }

    if (arg && hash === 'settings_panels') {
      setTimeout(() => {
        let panel = this.state.panels.find(p => p.cookieStoreId === arg)
        if (panel) this.state.selectedPanel = panel
      }, 120)
    }
  }, this.state.activeView === 'Settings' ? 0 : 250)

  document.title = 'Sidebery / Settings'
  this.state.activeView = 'Settings'
}

export default {
  loadCurrentWindowInfo,
  loadPlatformInfo,
  loadBrowserInfo,
  loadPermissions,
  updateActiveView,
}