'use strict'

const createHafas = require('vbb-hafas')
const pump = require('pump')
const through = require('through2')
const ndjson = require('ndjson')

const createWalk = require('.')

const hafas = createHafas('hafas-discover-stations example')
const walk = createWalk(hafas)
const friedrichstr = '900000100001'
const stations = walk(friedrichstr, {concurrency: 8})

const DEV = process.env.NODE_ENV === 'dev'
stations.on('hafas-error', (err) => {
	if (DEV) console.error(err)
	else console.error(err && err.message || (err + ''))
})

pump(
	stations,
	through.obj((s, _, cb) => cb(null, [s.id, s.name, s.products])),
	ndjson.stringify(),
	process.stdout,
	(err) => {
		console.error(err)
		process.exit(1)
	}
)
