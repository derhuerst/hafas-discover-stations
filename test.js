import createHafas from 'hafas-client'
import dbProfile from 'hafas-client/p/db/index.js'
import * as assert from 'assert'
import {createWalkAndDiscoverStations as createWalk} from './index.js'

const hafas = createHafas(dbProfile, 'hafas-discover-stations test')
const walk = createWalk(hafas)
const berlinFriedrichstr = '8011306'

const data = walk(berlinFriedrichstr)
data.on('error', err => {
	console.error(err)
	process.exit(1)
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
		console.info(`Discovered ${stations} stations. ✔︎`)
	}
}
data.on('data', onData)
