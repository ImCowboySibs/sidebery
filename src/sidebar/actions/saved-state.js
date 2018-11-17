export default {
  /**
   * Try to load saved sidebar state
   */
  async loadState({ state }) {
    let ans = await browser.storage.local.get('state')
    let loadedState = ans.state
    if (!loadedState) {
      state.stateLoaded = true
      return
    }

    if (!state.private && loadedState.panelIndex !== 2) {
      if (loadedState.panelIndex >= 0) {
        state.panelIndex = loadedState.panelIndex
      }
    }
    if (loadedState.syncPanels) {
      state.syncPanels = loadedState.syncPanels
    }

    state.stateLoaded = true
  },

  /**
   * Try to save some state values
   */
  async saveState({ state }) {
    if (!state.stateLoaded) return
    await browser.storage.local.set({
      state: {
        panelIndex: state.panelIndex,
        syncPanels: state.syncPanels,
      },
    })
  },
}