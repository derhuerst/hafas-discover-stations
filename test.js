'use strict'

const vbb = require('vbb-hafas')
const assert = require('assert')

const createWalk = require('.')

const walk = createWalk(vbb)
const friedrichstr = '900000100001'

const data = walk(friedrichstr)
data.on('error', assert.ifError)

let stations = 0
const knownStations = Object.create(null)

const onData = (station) => {
	assert.ok(station)
	assert.strictEqual(station.type, 'station')
	if (knownStations[station.id]) assert.fail(station.id + ' occured twice')

	knownStations[station.id] = true
	stations++
	if (stations >= 50) {
		data.removeListener('data', onData)
		data.stop()
	}
}
data.on('data', onData)
