'use strict'

const createHafas = require('db-hafas')
const assert = require('assert')

const createWalk = require('.')

const hafas = createHafas('hafas-discover-stations test')
const walk = createWalk(hafas)
const berlinFriedrichstr = '8011306'

const data = walk(berlinFriedrichstr)
data.on('error', err => {
	console.error(err)
	process.exitCode = 1
})

let stations = 0
const knownStations = Object.create(null)

const onData = (stop) => {
	assert.ok(stop)
	assert.ok(stop.type === 'stop' || stop.type === 'station')
	if (knownStations[stop.id]) assert.fail(stop.id + ' occured twice')

	knownStations[stop.id] = true
	stations++
	if (stations >= 200) {
		data.removeListener('data', onData)
		data.stop()
	}
}
data.on('data', onData)
