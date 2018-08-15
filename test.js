'use strict'

const createHafas = require('vbb-hafas')
const assert = require('assert')

const createWalk = require('.')

const hafas = createHafas('hafas-discover-stations test')
const walk = createWalk(hafas)
const friedrichstr = '900000100001'

const data = walk(friedrichstr)
data.on('error', assert.ifError)

let stations = 0
const knownStations = Object.create(null)

const onData = (stop) => {
	assert.ok(stop)
	assert.strictEqual(stop.type, 'stop')
	if (knownStations[stop.id]) assert.fail(stop.id + ' occured twice')

	knownStations[stop.id] = true
	stations++
	if (stations >= 50) {
		data.removeListener('data', onData)
		data.stop()
	}
}
data.on('data', onData)

data.once('error', (err) => {
	console.error(err)
	process.exit(1)
})
