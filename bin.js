'use strict'

const mri = require('mri')
const {isatty} = require('tty')
const differ = require('ansi-diff-stream')
const pump = require('pump')
const ndjson = require('ndjson')

const run = (walk, config) => {
	const argv = mri(process.argv.slice(2), {
		boolean: ['help', 'h', 'version', 'v', 'silent', 's']
	})

	if (argv.h || argv.help) {
		process.stdout.write(`\
	${config.description}

	Usage:
		${config.name} [first-station] > stations.ndjson

	Options:
		-s, --silent	Don't show progress reports on stderr.
	`)
		process.exit(0)
	}

	if (argv.v || argv.version) {
		process.stdout.write(config.name + ' ' + config.version + '\n')
		process.exit(0)
	}

	const firstStation = argv._[0] ? argv._[0] + '' : config.first
	const data = walk(firstStation)

	if (!argv.s && !argv.silent) {
		const clearReports = isatty(process.stderr.fd) && !isatty(process.stdout.fd)

		let reporter = process.stderr
		if (clearReports) {
			reporter = differ()
			reporter.pipe(process.stderr)
		}

		const report = ({requests, stations, edges, queued}) => {
			reporter.write([
				requests + (requests === 1 ? ' request' : ' requests'),
				stations + (stations === 1 ? ' station' : ' stations'),
				edges + (edges === 1 ? ' edge' : ' edges'),
				queued + ' queued'
			].join(', ') + (clearReports ? '' : '\n'))
		}
		data.on('stats', report)
	}

	return new Promise((resolve, reject) => {
		pump(data, ndjson.stringify(), process.stdout, (err) => {
			if (err) reject(err)
			else resolve()
		})
	})
}

module.exports = run
