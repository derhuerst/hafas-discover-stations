'use strict'

const mri = require('mri')
const {isatty} = require('tty')
const differ = require('ansi-diff-stream')
const ms = require('ms')
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
		return;
	}

	if (argv.v || argv.version) {
		process.stdout.write(config.name + ' ' + config.version + '\n')
		return;
	}

	const firstStation = argv._[0] ? argv._[0] + '' : config.first
	if (!firstStation) {
		console.error('Missing first-station argument.')
		process.exit(1)
	}

	const data = walk(firstStation)

	if (!argv.s && !argv.silent) {
		const clearReports = isatty(process.stderr.fd) && !isatty(process.stdout.fd)

		let reporter = process.stderr
		if (clearReports) {
			reporter = differ()
			reporter.pipe(process.stderr)
		}

		const report = (stats) => {
			const {
				totalReqs,
				stopsAndStations: nr,
				stopsAndStationsPerSecond: nrPerS,
				edges,
				queuedReqs,
				eta,
			} = stats
			reporter.write([
				totalReqs + (totalReqs === 1 ? ' request' : ' requests'),
				nr + (nr === 1 ? ' station' : ' stations') + ` (${Math.round(nrPerS)}/s)`,
				edges + (edges === 1 ? ' edge' : ' edges'),
				queuedReqs + ' queued',
				'ETA ' + (eta === Infinity ? '∞' : ms(eta * 1000)),
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
