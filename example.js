'use strict'

const vbb = require('vbb-hafas')
const pump = require('pump')
const through = require('through2')
const ndjson = require('ndjson')

const createWalk = require('.')

const walk = createWalk(vbb)
const friedrichstr = '900000100001'
const stations = walk(friedrichstr, {concurrency: 8})

const DEV = process.env.NODE_ENV === 'dev'
stations.on('hafas-error', (err) => {
	if (DEV) console.error(err)
	else console.error(err && err.message || (err + ''))
})

pump(
	stations,
	through.obj((s, _, cb) => cb(null, [s.id, s.name])),
	ndjson.stringify(),
	process.stdout,
	(err) => {
		console.error(err)
		process.exit(1)
	}
)
