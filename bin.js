import mri from 'mri'
import {isatty} from 'node:tty'
import differ from 'ansi-diff-stream'
import ms from 'ms'
import {pipeline} from 'node:stream/promises'
import ndjson from 'ndjson'

const runCli = async (walk, config) => {
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

	await pipeline(
		data,
		ndjson.stringify(),
		process.stdout,
	)
}

export {
	runCli,
}
