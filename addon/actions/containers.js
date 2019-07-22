import Actions from './index.js'

/**
 * Handle new container
 */
function onContainerCreated({ contextualIdentity }) {
  Actions.appendSnapLayers(-1, {
    id: contextualIdentity.cookieStoreId,
    t: Date.now(),
    key: 'ctr',
    color: contextualIdentity.color,
    icon: contextualIdentity.icon,
    name: contextualIdentity.name,
  })

  this.containers[contextualIdentity.cookieStoreId] = contextualIdentity
}

/**
 * Handle removing container
 */
function onContainerRemoved({ contextualIdentity }) {
  Actions.appendSnapLayers(-1, {
    id: contextualIdentity.cookieStoreId,
    t: Date.now(),
  })

  delete this.containers[contextualIdentity.cookieStoreId]
}

/**
 * Handle container update
 */
function onContainerUpdated(info) {
  const ctr = info.contextualIdentity
  const id = ctr.cookieStoreId
  const snapLayer = { id, t: Date.now() }

  let key
  if (this.containers[id].name !== ctr.name) key = 'name'
  if (this.containers[id].icon !== ctr.icon) key = 'icon'
  if (this.containers[id].color !== ctr.color) key = 'color'

  snapLayer.key = 'ctr-' + key
  snapLayer.val = ctr[key]

  Actions.appendSnapLayers(-1, snapLayer)
  this.containers[id] = ctr
}

export default {
  onContainerCreated,
  onContainerRemoved,
  onContainerUpdated,
}