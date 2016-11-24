import util from './util'

export default function (o) {
  o = o || {}
  if (o.moves === void 0) { o.moves = util.always }
  if (o.accepts === void 0) { o.accepts = util.always }
  if (o.invalid === void 0) { o.invalid = util.invalidTarget }
  if (o.containers === void 0) { o.containers = util.initialContainers || [] }
  if (o.isContainer === void 0) { o.isContainer = util.never }
  if (o.copy === void 0) { o.copy = false }
  if (o.copySortSource === void 0) { o.copySortSource = false }
  if (o.revertOnSpill === void 0) { o.revertOnSpill = false }
  if (o.removeOnSpill === void 0) { o.removeOnSpill = false }
  if (o.direction === void 0) { o.direction = 'vertical' }

  if (o.fixMoveDirection === void 0) { o.fixMoveDirection = null }
  if (o.getDirection === void 0) { o.getDirection = function () { return o.direction } }
  if (o.ignoreInputTextSelection === void 0) { o.ignoreInputTextSelection = true }
  if (o.deadzone === void 0) { o.deadzone = 0 }
  if (o.mirrorContainer === void 0) { o.mirrorContainer = document.body }
  if (o.delay === void 0) { o.delay = 0 }
  if (o.throttle === void 0) { o.throttle = false }
  if (o.offset === void 0) { o.offset = util.thru }
  if (o.allowNestedContainers === void 0) { o.allowNestedContainers = false }
  if (o.draggedContent === void 0) { o.draggedContent = function (item) { return item } }

  if (o.ignore === void 0) { o.ignore = [] }
  if (o.scale === void 0) { o.scale = null }
  if (o.startOnLongClick === void 0) { o.startOnLongClick = null }

  if (o.containerCanStart === void 0) { o.containerCanStart = false }
  if (o.insertBefore === void 0) {
    o.insertBefore = function (dropTarget, item, reference) {
      dropTarget.insertBefore(item, reference)
    }
  }
  return o
}
