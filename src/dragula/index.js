import configure from './configure'

import emitter from 'contra/emitter'
import crossvent from 'crossvent'
import classes from './classes'
import throttle from 'lodash.throttle'

const documentElement = document.documentElement

export default class Dragula {
  constructor (initialContainers, options) {
    let len = arguments.length
    if (len === 1 && Array.isArray(initialContainers) === false) {
      options = initialContainers
      initialContainers = []
    }
    this.scrollDirection = 0
    this.scrollTime = 0
    this.isScrolling = false
    this.scrollingStarted = 0
    this.contactedItems = []
    this.o = configure(options)
  }

  configured () {
    this.drake = this.createDrake()
    this.events()
    return this.drake
  }

  createDrake () {
    let drake = emitter({
      containers: this.o.containers,
      start: this.manualStart,
      end: this.end,
      grab: this.grab,
      cancel: this.cancel,
      remove: this.remove,
      destroy: this.destroy,
      canMove: this.canMove,
      dragging: false,
      scale: this.o.scale
    })

    if (this.o.removeOnSpill === true) {
      drake.on('over', this.spillOver).on('out', this.spillOut)
    }
    return drake
  }

  manualStart (item) {
    let context = this.canStart(item)
    if (context) {
      this.start(context)
    }
  }

  start (context, e) {
    let drake = this.drake
    if (this.isCopy(context.item, context.source)) {
      this.copy = context.item.cloneNode(true)
      drake.emit('cloned', this.copy, context.item, 'copy')
    }

    this.source = context.source
    this.item = context.item
    this.initialSibling = this.currentSibling = this.nextEl(context.item)

    drake.dragging = true
    drake.emit('drag', this.item, this.source, e)
  }

  isContainer (el, handle) {
    handle = handle || null
    let drake = this.drake
    if (handle && this.o.allowNestedContainers) {
      return drake.containers.indexOf(el) !== -1 && this.o.isContainer(el, handle)
    } else {
      return drake.containers.indexOf(el) !== -1 || this.o.isContainer(el)
    }
  }

  events (remove) {
    let op = remove ? 'remove' : 'add'
    this.touchy(documentElement, op, 'mousedown', this.delayedGrab)
    this.touchy(documentElement, op, 'mouseup', this.release)
  }

  eventualMovements (remove) {
    let op = remove ? 'remove' : 'add'
    let callback = this.o.throttle ? throttle(this.startBecauseMouseMoved, this.o.throttle) : this.startBecauseMouseMoved
    this.touchy(documentElement, op, 'mousemove', callback)
  }

  movements (remove) {
    let op = remove ? 'remove' : 'add'
    crossvent[op](documentElement, 'selectstart', this.preventGrabbed) // IE8
    crossvent[op](documentElement, 'click', this.preventGrabbed)
  }

  destroy () {
    this.events(true)
    this.release({})
  }

  preventGrabbed (e) {
    if (this.grabbed) {
      e.preventDefault()
    }
  }

  delayedGrab (e) {
    this.delayTimer = setTimeout(() => {
      this.grab(e)
    }, this.o.delay)
  }

  grab (e) {
    this.moveX = e.clientX
    this.moveY = e.clientY
    this.previousMousePosition = {
      x: this.moveX,
      y: this.moveY
    }

    this.contactedItems = [].concat(this.o.containers)

    let grabbedItem = this.detectGrabbedItem(e.target, this.o.containers)
    if (!grabbedItem) {
      return
    }

    if (grabbedItem) {
      let itemRect = grabbedItem.getBoundingClientRect()
      this.itemBoundary = {
        top: this.moveY - itemRect.top,
        right: (itemRect.left + itemRect.width) - this.moveX,
        bottom: (itemRect.top + itemRect.height) - this.moveY,
        left: this.moveX - itemRect.left
      }
    }

    let ignore = this.whichMouseButton(e) !== 1 || e.metaKey || e.ctrlKey
    if (ignore) {
      return // we only care about honest-to-god left clicks and touch events
    }
    let item = e.target
    let context = this.canStart(item)
    if (!context) {
      return
    }
    this.grabbed = context
    this.eventualMovements()
    if (e.type === 'mousedown') {
      if (this.isInput(item)) { // see also: https://github.com/bevacqua/dragula/issues/208
        item.focus() // fixes https://github.com/bevacqua/dragula/issues/176
      } else {
        e.preventDefault() // fixes https://github.com/bevacqua/dragula/issues/155
      }
    }

    if (this.o.startOnLongClick) {
      this.startOnLongClickTimer = setTimeout(() => {
        this.startBecauseMouseMoved(e, true)
      }, this.o.startOnLongClick)
    }
  }

  updateCurrentMovingDirection (x, y) {
    if (x > this.previousMousePosition.x) {
      this.currentMovingDirection = 'right'
    }

    if (x < this.previousMousePosition.x) {
      this.currentMovingDirection = 'left'
    }

    if (y > this.previousMousePosition.y) {
      this.currentMovingDirection = 'down'
    }

    if (y < this.previousMousePosition.y) {
      this.currentMovingDirection = 'up'
    }
  }

  startBecauseMouseMoved (e, force) {
    const clientX = this.getCoord('clientX', e)
    const clientY = this.getCoord('clientY', e)

    if (!this.grabbed) {
      return
    }
    if (this.whichMouseButton(e) === 0) {
      this.release({})
      return // when text is selected on an input and then dragged, mouseup doesn't fire. this is our only hope
    }
    // truthy check fixes #239, equality fixes #207
    if (!force && e.clientX !== void 0 && e.clientX === this.moveX && e.clientY !== void 0 && e.clientY === this.moveY) {
      return
    }

    let elementBehindCursor = document.elementFromPoint(clientX, clientY)

    if (this.o.ignoreInputTextSelection) {
      if (this.isInput(elementBehindCursor)) {
        return
      }
    }

    if (this.o.ignore.length) {
      let ignore = false

      this.o.ignore.forEach(function (tagName) {
        if (tagName === elementBehindCursor.tagName.toLowerCase()) {
          ignore = true
        }
      })

      if (ignore) {
        return
      }
    }

    let grabTravelDistance = this.distance({
      x: this.moveX,
      y: this.moveY
    }, {
      x: clientX,
      y: clientY
    })

    if (grabTravelDistance <= this.o.deadzone) {
      return
    }

    if (this.startOnLongClickTimer) {
      clearTimeout(this.startOnLongClickTimer)
    }

    let grabbed = this.grabbed // call to end() unsets _grabbed

    this.ungrab()
    this.eventualMovements(true)
    this.movements()
    this.end()
    this.start(grabbed, e)

    const offset = this.getOffset(this.item)
    const calculatedOffset = this.o.offset({
      x: this.getCoord('pageX', e) - offset.left,
      y: this.getCoord('pageY', e) - offset.top
    }, e, this.item)

    this.offsetX = calculatedOffset.x
    this.offsetY = calculatedOffset.y

    classes.add(this.data || this.copy || this.item, 'gu-transit')
    this.renderMirrorImage()
    this.drag(e)
  }

  canStart (item) {
    if (this.drake.dragging && this.mirror) {
      return
    }

    let handle = item
    if (this.isContainer(item, handle) && (!this.o.containerCanStart || !this.o.allowNestedContainers)) {
      return // don't drag container itself
    }

    while (this.getParent(item) && this.isContainer(this.getParent(item), handle) === false) {
      if (this.o.invalid(item, handle)) {
        return
      }
      item = this.getParent(item) // drag target should be a top element
      if (!item) {
        return
      }
    }

    this.data = this.o.draggedContent(item)
    if (this.data === item && this.isCopy(item, item.parentNode)) {
      this.data = item.cloneNode(true)
    }

    let source = this.getParent(item)
    if (!source) {
      return
    }
    if (this.o.invalid(item, handle)) {
      return
    }

    let movable = this.o.moves(item, source, handle, this.nextEl(item))
    if (!movable) {
      return
    }

    return {
      item: item,
      source: source
    }
  }

  canMove (item) {
    return !!this.canStart(item)
  }

  invalidTarget () {
    return false
  }

  end () {
    if (!this.drake.dragging) {
      return
    }
    let item = this.copy || this.item
    this.drop(item, this.getParent(item))
  }

  ungrab () {
    clearTimeout(this.delayTimer)
    this.grabbed = false
    this.eventualMovements(true)
    this.movements(true)
  }

  release (e) {
    this.ungrab()

    if (!this.drake.dragging) {
      return
    }
    let item = this.copy || this.item
    let clientX = this.getCoord('clientX', e)
    let clientY = this.getCoord('clientY', e)
    let elementBehindCursor = this.getElementBehindPoint(this.currentMovingDirection, this.itemBoundary, clientX, clientY)
    let dropTarget = this.findDropTarget(elementBehindCursor, clientX, clientY)
    if (dropTarget && ((this.copy && this.o.copySortSource) || (!this.copy || dropTarget !== this.source))) {
      this.drop(item, dropTarget)
    } else if (this.o.removeOnSpill) {
      this.remove()
    } else {
      this.cancel()
    }
  }

  drop (item, target) {
    let parent = this.getParent(item)
    if (this.copy && this.o.copySortSource && target === this.source) {
      parent.removeChild(this.item)
    }
    if (this.isInitialPlacement(target)) {
      this.drake.emit('cancel', item, this.source, this.source)
    } else {
      this.drake.emit('drop', item, target, this.source, this.currentSibling)
    }
    this.cleanup()
  }

  remove () {
    if (!this.drake.dragging) {
      return
    }
    let item = this.copy || this.item
    let parent = this.getParent(item)
    if (parent) {
      parent.removeChild(item)
    }
    this.drake.emit(this.copy ? 'cancel' : 'remove', item, parent, this.source)
    this.cleanup()
  }

  cancel (revert) {
    if (!this.drake.dragging) {
      return
    }
    let reverts = arguments.length > 0 ? revert : this.o.revertOnSpill
    let item = this.data || this.copy || this.item
    let parent = this.getParent(item)
    let initial = this.isInitialPlacement(parent)
    if (initial === false && reverts) {
      if (this.copy && parent) {
        parent.removeChild(item)
      } else {
        this.o.insertBefore(this.source, item, this.initialSibling)
      }
    }
    if (initial || reverts) {
      this.drake.emit('cancel', item, this.source, this.source)
    } else {
      this.drake.emit('drop', item, parent, this.source, this.currentSibling)
    }
    this.cleanup()
  }

  cleanup () {
    let item = this.copy || this.item
    this.ungrab()
    this.removeMirrorImage()
    if (item) {
      classes.rm(this.data || item, 'gu-transit')
    }
    if (this.renderTimer) {
      clearTimeout(this.renderTimer)
    }
    this.drake.dragging = false
    if (this.lastDropTarget) {
      this.drake.emit('out', item, this.lastDropTarget, this.source)
    }
    this.drake.emit('dragend', item)
    this.source = this.item = this.copy = this.initialSibling = this.currentSibling = this.renderTimer = this.lastDropTarget = null
  }

  isInitialPlacement (target, s) {
    let sibling
    if (s !== void 0) {
      sibling = s
    } else if (this.mirror) {
      sibling = this.currentSibling
    } else {
      sibling = this.nextEl(this.copy || this.item)
    }
    return target === this.source && sibling === this.initialSibling
  }

  findDropTarget (elementBehindCursor, clientX, clientY) {
    let target = elementBehindCursor
    let that = this
    while (target && !accepted()) {
      target = this.getParent(target)
    }
    return target

    function accepted () {
      let droppable = that.isContainer(target)
      if (droppable === false) {
        return false
      }

      if (that.o.containerCanStart && that.item.contains(target)) {
        return false
      }

      let immediate = that.getImmediateChild(target, elementBehindCursor)
      let reference = that.getReference(target, immediate, clientX, clientY)
      let initial = that.isInitialPlacement(target, reference)
      if (initial) {
        return true // should always be able to drop it right back where it was
      }
      return that.o.accepts(that.item, target, that.source, reference)
    }
  }

  detectGrabbedItem (child, containers) {
    let elm = child
    while (elm && !containers.includes(elm.parentNode)) {
      elm = elm.parentNode
    }
    if (!elm) {
      return false
    }
    return elm
  }

  storeContactedItem (item) {
    let _item = this.detectGrabbedItem(item, this.o.containers)
    if (!_item || this.contactedItems.includes(_item)) {
      return
    }

    this.contactedItems.push(_item)
  }

  getItemFromPoint (x, y) {
    let foundItem
    this.contactedItems.forEach((item) => {
      let itemRect = item.getBoundingClientRect()
      if (
        x >= itemRect.left &&
        x <= itemRect.right &&
        y >= itemRect.top &&
        y <= itemRect.bottom
      ) {
        foundItem = item
      }
    })
    return foundItem
  }

  drag (e) {
    if (!this.mirror) {
      return
    }
    e.preventDefault()

    const containerOffset = this.getOffset(this.o.mirrorContainer)
    const clientX = this.getCoord('clientX', e)
    const clientY = this.getCoord('clientY', e)

    let x = clientX - containerOffset.left
    let y = clientY - containerOffset.top

    if (this.drake.scale) {
      x = x / this.drake.scale
      y = y / this.drake.scale
    }

    x += this.o.mirrorContainer.scrollLeft - this.offsetX
    y += this.o.mirrorContainer.scrollTop - this.offsetY

    this.mirror.style.left = x + 'px'
    this.mirror.style.top = y + 'px'

    this.updateCurrentMovingDirection(clientX, clientY)

    switch (this.o.fixMoveDirection) {
      case 'vertical':
        this.mirror.style.top = y + 'px'
        break
      case 'horizontal':
        this.mirror.style.left = x + 'px'
        break
      default:
        this.mirror.style.left = x + 'px'
        this.mirror.style.top = y + 'px'
    }

    // Correct position:fixed placement on iOS
    const rect = this.mirror.getBoundingClientRect()
    let tolerance = 2
    if (
      rect.top < y - tolerance || rect.top > y + tolerance ||
      rect.left < x - tolerance || rect.left > x + tolerance
    ) {
      x = x + (x - rect.left)
      y = y + (y - rect.top)
      this.mirror.style.left = x + 'px'
      this.mirror.style.top = y + 'px'
    }

    let item = this.copy || this.item
    this.storeContactedItem(this.getElementBehindPoint(this.currentMovingDirection, this.itemBoundary, clientX, clientY))
    let elementBehindCursor = this.getItemFromPoint(clientX, clientY)
    if (!elementBehindCursor) {
      return
    }

    let dropTarget = this.findDropTarget(elementBehindCursor, clientX, clientY)
    let changed = dropTarget !== null && dropTarget !== this.lastDropTarget
    if (changed || dropTarget === null) {
      out()
      this.lastDropTarget = dropTarget
      over()
    }
    let parent = this.getParent(item)
    if (dropTarget === this.source && this.copy && !this.o.copySortSource) {
      if (parent) {
        parent.removeChild(item)
      }
      return
    }
    let reference
    let immediate = this.getImmediateChild(dropTarget, elementBehindCursor)
    if (immediate !== null) {
      reference = this.getReference(dropTarget, immediate, clientX, clientY)
    } else if (this.o.revertOnSpill === true && !this.copy) {
      reference = this.initialSibling
      dropTarget = this.source
    } else {
      if (this.copy && parent) {
        parent.removeChild(item)
      }
      return
    }
    if (
      (reference === null && changed) ||
      reference !== item &&
      reference !== this.nextEl(item)
    ) {
      this.currentSibling = reference

      if (this.data !== item && parent) {
        parent.removeChild(this.item)
      }

      this.drake.emit('preshadow', item, dropTarget, this.source)
      this.o.insertBefore(dropTarget, item, reference)
      this.drake.emit('shadow', item, dropTarget, this.source)
    }

    document.addEventListener('mousemove', this.startScrolling)

    const moved = (type) => {
      this.drake.emit(type, item, this.lastDropTarget, this.source)
    }

    const over = () => {
      if (changed) {
        moved('over')
      }
    }

    const out = () => {
      if (this.lastDropTarget) {
        moved('out')
      }
    }

    this.previousMousePosition = {
      x: clientX,
      y: clientY
    }
  }

  startScrolling (e) {
    let region = 100
    let container, containerRect, topRegion, bottomRegion, newScrollDirection

    if (this.o.absoluteContainer) {
      container = this.o.absoluteContainer
      containerRect = container.getBoundingClientRect()
      topRegion = region + containerRect.top
      bottomRegion = containerRect.bottom - region
    } else {
      container = document
      topRegion = region
      bottomRegion = window.innerHeight - region
    }

    if (e.which === 1 && (e.clientY <= topRegion || e.clientY > bottomRegion)) {
      newScrollDirection = 1

      if (e.clientY <= topRegion) {
        newScrollDirection = -1
      }

      if (newScrollDirection !== this.scrollDirection) {
        this.scrollDirection = newScrollDirection
        this.scrollTime = 0
        this.scrollingStarted = Date.now()
      }

      if (!this.isScrolling) {
        this.doScroll()
      }
    } else {
      this.scrollDirection = 0
      this.scrollTime = 0
      this.isScrolling = false
      if (e.which !== 1) {
        document.removeEventListener('mousemove', this.startScrolling)
      }
    }
  }

  easeInQuad (t, b, c, d) {
    t /= d
    return c * t * t + b
  }

  doScroll () {
    if (!this.scrollDirection) {
      return
    }

    this.isScrolling = true
    this.scrollTime = Date.now() - this.scrollingStarted

    window.requestAnimationFrame(() => {
      let container = this.o.absoluteContainer || document
      let containerRect = container.getBoundingClientRect()
      let maxScroll = this.o.absoluteContainer ? container.scrollHeight - containerRect.height : window.innerHeight - document.body.clientHeight
      let speed = this.easeInQuad(this.scrollTime, 1, 100, 2000)
      let to = container.scrollTop + speed * this.scrollDirection

      if ((container.scrollTop === 0 && to <= 0) || (container.scrollTop === maxScroll && to >= maxScroll)) {
        this.scrollDirection = 0
        this.scrollTime = 0
        this.isScrolling = false
        return
      }

      container.scrollTop = to

      setTimeout(function () {
        if (this.isScrolling) {
          this.doScroll()
        }
      }, 15)
    })
  }

  spillOver (el) {
    classes.rm(el, 'gu-hide')
  }

  spillOut (el) {
    if (this.drake.dragging) {
      classes.add(el, 'gu-hide')
    }
  }

  renderMirrorImage (e) {
    if (this.mirror) {
      return
    }
    let rect = this.item.getBoundingClientRect()
    let callback = this.o.throttle ? throttle(this.drag, this.o.throttle) : this.drag
    this.mirror = this.item.cloneNode(true)
    this.mirror.style.width = this.getRectWidth(rect) + 'px'
    this.mirror.style.height = this.getRectHeight(rect) + 'px'
    classes.rm(this.mirror, 'gu-transit')
    classes.add(this.mirror, 'gu-mirror')
    this.o.mirrorContainer.appendChild(this.mirror)
    this.touchy(documentElement, 'add', 'mousemove', callback)
    classes.add(this.o.mirrorContainer, 'gu-unselectable')
    this.drake.emit('cloned', this.mirror, this.item, 'mirror', e)
  }

  removeMirrorImage () {
    if (this.mirror) {
      classes.rm(this.o.mirrorContainer, 'gu-unselectable')
      let callback = this.o.throttle ? throttle(this.drag, this.o.throttle) : this.drag
      this.touchy(documentElement, 'remove', 'mousemove', callback)
      this.getParent(this.mirror).removeChild(this.mirror)
      this.mirror = null
    }
  }

  getImmediateChild (dropTarget, target) {
    let immediate = target
    while (immediate !== dropTarget && this.getParent(immediate) !== dropTarget) {
      immediate = this.getParent(immediate)
    }
    if (immediate === documentElement) {
      return null
    }
    return immediate
  }

  getReference (dropTarget, target, x, y) {
    let direction = dropTarget.getAttribute('dragula-direction')
    let horizontal = direction && direction !== null ? direction === 'horizontal' : this.o.direction === 'horizontal'
    let grid = this.o.direction === 'grid'
    let reference = target !== dropTarget ? inside() : outside()
    return reference

    // slower, but able to figure out any position
    function outside () {
      let len = dropTarget.children.length
      let el
      let rect
      for (let i = 0; i < len; i++) {
        el = dropTarget.children[i]
        rect = el.getBoundingClientRect()
        if (horizontal && (rect.left + rect.width / 2) > x) {
          return el
        }
        if (!horizontal && (rect.top + rect.height / 2) > y) {
          return el
        }
      }
      return null
    }

    // faster, but only available if dropped inside a child element
    function inside () {
      let rect = target.getBoundingClientRect()
      if (grid) {
        // we need to figure out which edge we're closest to:
        // top edge: return nextEl(target)
        // left edge: return nextEl(target)
        // bottom edge: return target
        // right edge: return target
        let distToTop = y - rect.top
        let distToLeft = x - rect.left
        let distToBottom = rect.bottom - y
        let distToRight = rect.right - x
        let minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom)
        return resolve(distToLeft === minDist || distToTop === minDist)
      }
      if (horizontal) {
        return resolve(x > rect.left + this.getRectWidth(rect) / 2)
      }
      return resolve(y > rect.top + this.getRectHeight(rect) / 2)
    }

    function resolve (after) {
      return after ? this.nextEl(target) : target
    }
  }

  isCopy (item, container) {
    return typeof this.o.copy === 'boolean' ? this.o.copy : this.o.copy(item, container)
  }
}
