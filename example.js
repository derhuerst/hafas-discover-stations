'use strict'

const vbb = require('vbb-hafas')

const createWalk = require('.')

const walk = createWalk(vbb)

const friedrichstr = '900000100001'
const stations = walk(friedrichstr, {concurrency: 8})

stations
.on('data', console.log)
.on('error', console.error)
