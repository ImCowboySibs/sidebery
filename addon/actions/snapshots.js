import Actions from '../actions.js'
import { TABS_PANEL } from '../defaults.js'
import { DEFAULT_TABS_PANEL } from '../defaults.js'
import { DEFAULT_CTX } from '../defaults.js'
import { DEFAULT_CTX_ID } from '../defaults.js'

const MIN_SNAP_INTERVAL = 5000

let currentSnapshot
let baseSnapshotTimeout

/**
 * Create base snapshot
 */
async function createSnapshot() {
  // Get containers info
  const containersById = {}
  for (let containerId of Object.keys(this.containers)) {
    containersById[containerId] = {
      id: containerId,
      color: this.containers[containerId].color,
      icon: this.containers[containerId].icon,
      name: this.containers[containerId].name,
    }
  }

  // Get panels info
  let { panels_v4 } = await browser.storage.local.get({ panels_v4: [] })

  // Update tree structure
  if (this.settings.tabsTree) await Actions.updateTabsTree()

  // Get tabs info per window
  const windows = {}
  for (let windowId of Object.keys(this.windows)) {
    const window = this.windows[windowId]
    const items = []

    for (let tab of window.tabs) {
      items.push({
        id: tab.id,
        pinned: tab.pinned,
        url: tab.url,
        title: tab.title,
        lvl: tab.lvl,
        ctr: tab.cookieStoreId,
        panel: tab.panelId,
      })
    }

    windows[windowId] = { items }
  }

  currentSnapshot = {
    id: Math.random()
      .toString(16)
      .replace('0.', Date.now().toString(16)),
    time: Date.now(),
    containersById,
    panels: panels_v4,
    windows,
  }

  let { snapshots_v4 } = await browser.storage.local.get({ snapshots_v4: null })
  if (!snapshots_v4) snapshots_v4 = await getPrevVerSnapshots()

  const lastSnapshot = snapshots_v4[snapshots_v4.length - 1]
  if (lastSnapshot && compareSnapshots(lastSnapshot, currentSnapshot)) return

  snapshots_v4.push(currentSnapshot)

  snapshots_v4 = await Actions.limitSnapshots(snapshots_v4)

  await browser.storage.local.set({
    snapshots_v4,
    lastSnapTime: currentSnapshot.time,
  })

  if (this.settings.snapNotify) {
    let win = await browser.windows.getCurrent({ populate: false })
    browser.runtime.sendMessage({
      windowId: win.id,
      instanceType: 'sidebar',
      action: 'notifyAboutNewSnapshot',
    })
  }

  return currentSnapshot
}
function createSnapshotDebounced(delay = 750) {
  if (baseSnapshotTimeout) clearTimeout(baseSnapshotTimeout)
  baseSnapshotTimeout = setTimeout(Actions.createSnapshot, delay)
}

/**
 * Schedule snapshots
 */
async function scheduleSnapshots() {
  let interval = Actions.getSnapInterval()
  if (interval < MIN_SNAP_INTERVAL) return

  const currentTime = Date.now()
  let elapsed
  let nextTimeout = interval
  if (currentSnapshot) elapsed = currentTime - currentSnapshot.time
  else elapsed = currentTime - (await Actions.getLastSnapTime())

  if (elapsed >= interval) Actions.createSnapshot()
  else nextTimeout = interval - elapsed

  Actions.scheduleNextSnapshot(nextTimeout)
}

/**
 * Schedule next snapshot with given delay time
 */
function scheduleNextSnapshot(nextTimeout) {
  setTimeout(() => {
    nextTimeout = Actions.getSnapInterval()
    if (nextTimeout < MIN_SNAP_INTERVAL) return
    Actions.createSnapshot()
    Actions.scheduleNextSnapshot(nextTimeout)
  }, nextTimeout)
}

/**
 * Get the last snapshot time
 */
async function getLastSnapTime() {
  const ans = await browser.storage.local.get('lastSnapTime')
  if (ans && typeof ans.lastSnapTime === 'number') return ans.lastSnapTime
}

/**
 * Apply snapshot
 */
async function applySnapshot(snapshot) {
  for (let winId of Object.keys(snapshot.windowsById)) {
    await Actions.openSnapshotWindow(snapshot, winId)
  }
}

/**
 * Open window
 */
async function openSnapshotWindow(snapshot, winId) {
  let winInfo = snapshot.windowsById[winId]
  if (!winInfo) return

  let containers = snapshot.containersById
  let pinnedTabs = []
  let tabs = []

  for (let panel of winInfo.panels) {
    for (let tab of panel.tabs) {
      if (tab.pinned) pinnedTabs.push(tab)
      else tabs.push(tab)
    }
  }

  tabs = pinnedTabs.concat(tabs)

  let tabsInfo = []
  for (let tab of tabs) {
    tabsInfo.push({ lvl: tab.lvl, panelId: tab.panel })
  }
  let tabsInfoStr = encodeURIComponent(JSON.stringify(tabsInfo))
  let newWindow = await browser.windows.create({
    url: 'about:blank#tabsdata' + tabsInfoStr,
  })
  let parents = []
  let creating = []
  for (let i = 0; i < tabs.length; i++) {
    let tab = tabs[i]
    let ctr = containers[tab.ctr]
    let ctrId = ctr ? ctr.newId : DEFAULT_CTX_ID

    parents[tab.lvl] = tab.id

    let conf = {
      windowId: newWindow.id,
      url: Utils.normalizeUrl(tab.url),
      active: false,
      pinned: tab.pinned,
      cookieStoreId: ctrId,
    }

    if (!tab.pinned && ctrId === DEFAULT_CTX_ID && !tab.url.startsWith('about')) {
      conf.discarded = true
      conf.title = tab.title
    }

    creating.push(browser.tabs.create(conf))
  }

  await Promise.all(creating)
}

/**
 * Limit snapshots
 */
async function limitSnapshots(snapshots) {
  const resultToStore = !snapshots
  const limit = this.settings.snapLimit
  const unit = this.settings.snapLimitUnit

  if (!limit) return snapshots

  let normLimit = limit
  if (unit === 'day') normLimit = Date.now() - limit * 86400000
  if (unit === 'kb') normLimit = limit * 1024

  if (!snapshots) {
    let { snapshots_v4 } = await browser.storage.local.get({ snapshots_v4: null })
    if (!snapshots_v4) snapshots_v4 = await getPrevVerSnapshots()
    snapshots = snapshots_v4
    if (!snapshots.length) return
  }

  let index
  let accum = 0
  for (index = snapshots.length; index--; ) {
    let snapshot = snapshots[index]

    if (unit === 'snap') {
      accum++
      if (accum > normLimit) break
    }

    if (unit === 'kb') {
      accum += new Blob([JSON.stringify(snapshot)]).size
      if (accum > normLimit) break
    }

    if (unit === 'day') {
      accum = snapshot.time
      if (accum < normLimit) break
    }
  }

  index++

  if (!resultToStore) return snapshots.slice(index)
  else await browser.storage.local.set({ snapshots_v4: snapshots.slice(index) })
}

/**
 * Get normalized snapshot interval in ms
 */
function getSnapInterval() {
  let interval = this.settings.snapInterval
  const unit = this.settings.snapIntervalUnit
  if (!interval || typeof interval !== 'number') return 0
  if (unit === 'min') interval = this.settings.snapInterval * 60000
  if (unit === 'hr') interval = this.settings.snapInterval * 3600000
  if (unit === 'day') interval = this.settings.snapInterval * 86400000
  return interval
}

/**
 * Compare two snapshots
 */
function compareSnapshots(s1, s2) {
  const s1WinJSON = JSON.stringify(s1.windows)
  const s2WinJSON = JSON.stringify(s2.windows)
  if (s1WinJSON === s2WinJSON) {
    const s1CtrJSON = JSON.stringify(s1.containersById)
    const s2CtrJSON = JSON.stringify(s2.containersById)
    if (s1CtrJSON === s2CtrJSON) return true
  }
}

export default {
  createSnapshot,
  createSnapshotDebounced,
  scheduleSnapshots,
  scheduleNextSnapshot,
  getLastSnapTime,
  applySnapshot,
  openSnapshotWindow,
  limitSnapshots,
  getSnapInterval,
}

/**
 * Try to get snapshots from prev version
 * and convert them.
 */
export async function getPrevVerSnapshots() {
  let { snapshots } = await browser.storage.local.get({ snapshots: null })
  if (!snapshots) return []

  for (let snapshot of snapshots) {
    if (!snapshot.id) break
    if (!snapshot.time) break
    if (!snapshot.containersById) break
    if (!snapshot.windows) break

    snapshot.panels = []

    for (let window of Object.values(snapshot.windows)) {
      let ctr = ''
      let panels = {}
      let pinned = true
      let convertedItems = []

      // Restore panels
      for (let item of window.items) {
        if (typeof item !== 'string') continue
        let p = snapshot.panels.find(p => p.moveTabCtx === item || p.id === item)
        if (p) continue
        if (item === DEFAULT_CTX) {
          p = Utils.cloneObject(DEFAULT_TABS_PANEL)
          panels[DEFAULT_CTX] = DEFAULT_CTX
        } else {
          let ctr = snapshot.containersById[item]
          p = Utils.cloneObject(TABS_PANEL)
          p.id = Utils.uid()
          p.name = ctr.name
          p.icon = ctr.icon
          p.color = ctr.color
          panels[item] = p.id
        }
        snapshot.panels.push(p)
      }

      // Normalize tabs
      for (let item of window.items) {
        if (typeof item === 'string') {
          pinned = false
          ctr = item
          continue
        }

        if (pinned) item.pinned = pinned
        if (ctr) item.ctr = ctr
        if (item.lvl === 0) delete item.lvl
        if (panels[ctr]) item.panel = panels[ctr]
        convertedItems.push(item)
      }

      window.items = convertedItems
    }
  }

  return snapshots
}
