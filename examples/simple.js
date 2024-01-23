import createHafas from 'hafas-client'
import dbProfile from 'hafas-client/p/db/index.js'
import pump from 'pump'
import through from 'through2'
import ndjson from 'ndjson'
import {createWalkAndDiscoverStations as createWalk} from '../index.js'

const hafas = createHafas(dbProfile, 'hafas-discover-stations example')
const walk = createWalk(hafas)
const berlinFriedrichstr = '8011306'
const stations = walk(berlinFriedrichstr, {concurrency: 8})

const DEV = process.env.NODE_ENV === 'dev'
stations.on('hafas-error', (err) => {
	if (DEV) console.error(err)
	else console.error(err && err.message || (err + ''))
})

pump(
	stations,
	through.obj((s, _, cb) => cb(null, [s.type, s.id, s.name, s.products])),
	ndjson.stringify(),
	process.stdout,
	(err) => {
		console.error(err)
		process.exit(1)
	}
)
