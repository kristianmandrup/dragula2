'use strict'

var test = require('ava')
var dragula = require('..')

test('public api matches expectation', function (t) {
  t.equal(typeof dragula, 'function', 'dragula is a function')
  t.end()
})
