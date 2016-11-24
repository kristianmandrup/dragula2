'use strict'

var test = require('ava')
var events = require('./lib/events')
var dragula = require('..')

test('drag event gets emitted when clicking an item', function (t) {
  testCase('works for left clicks', { which: 1 })
  testCase('works for wheel clicks', { which: 1 })
  testCase('works when clicking buttons by default', { which: 1 }, { tag: 'button', passes: true })
  testCase('works when clicking anchors by default', { which: 1 }, { tag: 'a', passes: true })
  testCase('fails for right clicks', { which: 2 }, { passes: false })
  testCase('fails for meta-clicks', { which: 1, metaKey: true }, { passes: false })
  testCase('fails for ctrl-clicks', { which: 1, ctrlKey: true }, { passes: false })
  testCase('fails when clicking containers', { which: 1 }, { containerClick: true, passes: false })
  testCase('fails whenever invalid returns true', { which: 1 }, { passes: false, dragulaOpts: { invalid: always } })
  testCase('fails whenever moves returns false', { which: 1 }, { passes: false, dragulaOpts: { moves: never } })
  t.end()
  function testCase (desc, eventOptions, options) {
    t.test(desc, function subtest (st) {
      var o = options || {}
      var div = document.createElement('div')
      var item = document.createElement(o.tag || 'div')
      var passes = o.passes !== false
      var drake = dragula([div], o.dragulaOpts)
      div.appendChild(item)
      document.body.appendChild(div)
      drake.on('drag', drag)
      events.raise(o.containerClick ? div : item, 'mousedown', eventOptions)
      events.raise(o.containerClick ? div : item, 'mousemove')
      st.plan(passes ? 4 : 1)
      st.equal(drake.dragging, passes, desc + ': final state is drake is ' + (passes ? '' : 'not ') + 'dragging')
      drake.destroy()
      st.end()
      function drag (target, container) {
        st[passes ? 'pass' : 'fail'](desc + ': drag event was emitted synchronously')
        st.equal(target, item, desc + ': first argument is selected item')
        st.equal(container, div, desc + ': second argument is container')
      }
    })
  }
})

test('when copying, emits cloned with the copy', function (t) {
  var div = document.createElement('div')
  var item1 = document.createElement('div')
  var item2 = document.createElement('span')
  var drake = dragula([div], { copy: true })
  item2.innerHTML = '<em>the force is <strong>with this one</strong></em>'
  div.appendChild(item1)
  div.appendChild(item2)
  document.body.appendChild(div)
  drake.start(item1)
  drake.on('cloned', cloned)
  drake.on('drag', drag)
  events.raise(item2, 'mousedown', { which: 1 })
  events.raise(item2, 'mousemove', { which: 1 })
  t.plan(12)
  t.equal(drake.dragging, true, 'final state is drake is dragging')
  t.end()
  function cloned (copy, item) {
    t.notEqual(copy, item2, 'first argument is not exactly the target')
    t.equal(copy.tagName, item2.tagName, 'first argument has same tag as target')
    t.equal(copy.innerHTML, item2.innerHTML, 'first argument has same inner html as target')
    t.equal(item, item2, 'second argument is clicked item')
  }
  function drag (item, container) {
    t.pass('drag event was emitted synchronously')
    t.equal(item, item2, 'first argument is selected item')
    t.equal(container, div, 'second argument is container')
  }
})

test('when dragging, element gets gu-transit class', function (t) {
  var div = document.createElement('div')
  var item = document.createElement('div')
  dragula([div])
  div.appendChild(item)
  document.body.appendChild(div)
  events.raise(item, 'mousedown', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 })
  t.equal(item.className, 'gu-transit', 'item has gu-transit class')
  t.end()
})

test('when dragging, body gets gu-unselectable class', function (t) {
  var div = document.createElement('div')
  var item = document.createElement('div')
  dragula([div])
  div.appendChild(item)
  document.body.appendChild(div)
  events.raise(item, 'mousedown', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 })
  t.equal(document.body.className, 'gu-unselectable', 'body has gu-unselectable class')
  t.end()
})

test('when dragging, element gets a mirror image for show', function (t) {
  var div = document.createElement('div')
  var item = document.createElement('div')
  var drake = dragula([div])
  item.innerHTML = '<em>the force is <strong>with this one</strong></em>'
  div.appendChild(item)
  document.body.appendChild(div)
  drake.on('cloned', cloned)
  events.raise(item, 'mousedown', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 })
  t.plan(4)
  t.end()
  function cloned (mirror, target) {
    t.equal(item.className, 'gu-transit', 'item does not have gu-mirror class')
    t.equal(mirror.className, 'gu-mirror', 'mirror only has gu-mirror class')
    t.equal(mirror.innerHTML, item.innerHTML, 'mirror is passed to \'cloned\' event')
    t.equal(target, item, 'cloned lets you know that the mirror is a clone of `item`')
  }
})

test('when dragging, mirror element gets appended to configured mirrorContainer', function (t) {
  var mirrorContainer = document.createElement('div')
  var div = document.createElement('div')
  var item = document.createElement('div')
  var drake = dragula([div], {
    'mirrorContainer': mirrorContainer
  })
  item.innerHTML = '<em>the force is <strong>with this one</strong></em>'
  div.appendChild(item)
  document.body.appendChild(div)
  drake.on('cloned', cloned)
  events.raise(item, 'mousedown', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 })
  t.plan(1)
  t.end()
  function cloned (mirror) {
    t.equal(mirror.parentNode, mirrorContainer, 'mirrors parent is the configured mirrorContainer')
  }
})

test('when dragging stops, element gets gu-transit class removed', function (t) {
  var div = document.createElement('div')
  var item = document.createElement('div')
  var drake = dragula([div])
  div.appendChild(item)
  document.body.appendChild(div)
  events.raise(item, 'mousedown', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 })
  t.equal(item.className, 'gu-transit', 'item has gu-transit class')
  drake.end()
  t.equal(item.className, '', 'item has gu-transit class removed')
  t.end()
})

test('when dragging stops, body becomes selectable again', function (t) {
  var div = document.createElement('div')
  var item = document.createElement('div')
  var drake = dragula([div])
  div.appendChild(item)
  document.body.appendChild(div)
  events.raise(item, 'mousedown', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 })
  t.equal(document.body.className, 'gu-unselectable', 'body has gu-unselectable class')
  drake.end()
  t.equal(document.body.className, '', 'body got gu-unselectable class removed')
  t.end()
})

test('when drag begins, check for copy option', function (t) {
  var div = document.createElement('div')
  var item = document.createElement('div')
  item.className = 'copyable'
  div.className = 'contains'
  var drake = dragula([div], {
    copy: checkCondition
  })
  item.innerHTML = '<em>the force is <strong>with this one</strong></em>'
  div.appendChild(item)
  document.body.appendChild(div)
  events.raise(item, 'mousedown', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 })
  events.raise(item, 'mousemove', { which: 1 }) // ensure the copy method condition is only asserted once
  console.log(t)
  t.plan(2)
  t.end()
  function checkCondition (el, source) {
    t.equal(el.className, 'copyable', 'dragged element classname is copyable')
    t.equal(source.className, 'contains', 'source container classname is contains')
    return true
  }
  drake.end()
})
/* */

test('drag event does not fire within deadzone', function (t) {
  var div = document.createElement('div')
  var item = document.createElement('div')
  var drake = dragula([div], {
    deadzone: 10
  })
  div.appendChild(item)
  document.body.appendChild(div)

  t.plan(1)
  drake.on('drag', drag)
  events.raise(item, 'mousedown', { which: 1, clientX: 0, clientY: 0 })
  events.raise(item, 'mousemove', { clientX: 1, clientY: 1 })
  t.equal(drake.dragging, false, 'final state is drake is not dragging')
  drake.destroy()
  t.end()
  function drag () {
    t.fail('drag event was emitted')
  }
})

test('drag event fires outside deadzone', function (t) {
  var div = document.createElement('section')
  var item = document.createElement('div')
  var drake = dragula([div], {
    deadzone: 10
  })
  div.appendChild(item)
  document.body.appendChild(div)

  t.plan(2)
  drake.on('drag', drag)
  events.raise(item, 'mousedown', { which: 1, clientX: 0, clientY: 0 })
  events.raise(item, 'mousemove', { clientX: 20, clientY: 20 })
  t.equal(drake.dragging, true, 'final state is drake is dragging')
  drake.destroy()
  t.end()
  function drag () {
    t.pass('drag event should be emitted')
  }
})

function always () { return true }
function never () { return false }