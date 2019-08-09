import Logs from '../../logs'

/**
 * Load platform info
 */
function loadPlatformInfo() {
  browser.runtime.getPlatformInfo()
    .then(osInfo => {
      this.state.osInfo = osInfo
      this.state.os = osInfo.os
    })
}

/**
 * Load windows info
 */
async function loadWindowInfo() {
  let currentWindow = await browser.windows.getCurrent()
  this.state.private = currentWindow.incognito
  this.state.windowId = currentWindow.id
  browser.windows.getAll()
    .then(windows => {
      this.state.otherWindows = windows.filter(w => w.id !== this.state.windowId)
    })
}

/**
 * Connect to background script
 */
function connectToBG() {
  const connectInfo = JSON.stringify({
    instanceType: this.state.instanceType,
    windowId: this.state.windowId,
  })
  this.state.bg = browser.runtime.connect({ name: connectInfo })
}

/**
 * Show window-select panel
 */
async function chooseWin() {
  this.state.winChoosing = []
  this.state.panelIndex = -5
  let wins = await browser.windows.getAll({ populate: true })
  wins = wins.filter(w => !w.focused)

  return new Promise(res => {
    wins = wins.map(async w => {
      let tab = w.tabs.find(t => t.active)
      if (!tab) return
      if (w.focused) return
      let screen = await browser.tabs.captureTab(tab.id)
      return {
        id: w.id,
        title: w.title,
        screen,
        choose: () => {
          this.state.winChoosing = null
          this.state.panelIndex = this.state.lastPanelIndex
          res(w.id)
        },
      }
    })

    Promise.all(wins).then(wins => {
      this.state.winChoosing = wins
    })
  })
}

/**
 * Retrieve current permissions
 */
async function loadPermissions() {
  this.state.permAllUrls = await browser.permissions.contains({ origins: ['<all_urls>'] })
  this.state.permTabHide = await browser.permissions.contains({ permissions: ['tabHide'] })

  if (!this.state.permAllUrls) {
    this.state.proxiedPanels = {}
    this.state.panels.map(c => {
      if (c.proxified) c.proxified = false
      if (c.proxy) c.proxy.type = 'direct'
      if (c.includeHostsActive) c.includeHostsActive = false
      if (c.excludeHostsActive) c.excludeHostsActive = false
    })
    this.actions.savePanels()
  }

  if (!this.state.permTabHide) {
    this.state.hideInact = false
    this.state.hideFoldedTabs = false
  }

  Logs.push('[INFO] Permissions loaded')
}

/**
 * Get all windows and check which current
 */
async function getAllWindows() {
  return Promise.all([browser.windows.getCurrent(), browser.windows.getAll()]).then(
    ([current, all]) => {
      return all.map(w => {
        if (w.id === current.id) w.current = true
        return w
      })
    }
  )
}

/**
 * Undo remove tab
 */
async function undoRmTab() {
  let closed = await browser.sessions.getRecentlyClosed()
  if (closed && closed.length) {
    const tab = closed.find(c => c.tab)
    if (tab) await browser.sessions.restore(tab.sessionId)
  }
}

/**
 * Select item
 */
function selectItem(id) {
  if (typeof id === 'number') this.state.tabsMap[id].sel = true
  else this.state.bookmarksMap[id].sel = true
  if (!this.state.selected.includes(id)) this.state.selected.push(id)
}

/**
 * Deselect item
 */
function deselectItem(id) {
  if (typeof id === 'number') this.state.tabsMap[id].sel = false
  else this.state.bookmarksMap[id].sel = false
  let index = this.state.selected.indexOf(id)
  if (index >= 0) this.state.selected.splice(index, 1)
}

/**
 * Reset selection.
 */
function resetSelection() {
  if (!this.state.selected.length) return
  let id = this.state.selected[0]
  if (typeof id === 'number') {
    for (let id of this.state.selected) {
      this.state.tabsMap[id].sel = false
    }
  } else {
    for (let id of this.state.selected) {
      this.state.bookmarksMap[id].sel = false
    }
  }
  this.state.selected = []
}

/**
 * Set 'storageIsLocked' flag to true
 */
function lockStorage() {
  this.state.storageIsLocked = true
}

/**
 * Set 'storageIsLocked' flag to false
 */
function unlockStorage() {
  this.state.storageIsLocked = false
}

/**
 * Update sidebar width
 */
function updateSidebarWidth() {
  this.state.width = document.body.offsetWidth
}

export default {
  loadPlatformInfo,
  loadWindowInfo,
  connectToBG,
  chooseWin,
  loadPermissions,
  getAllWindows,
  undoRmTab,
  selectItem,
  deselectItem,
  resetSelection,
  lockStorage,
  unlockStorage,
  updateSidebarWidth,
}