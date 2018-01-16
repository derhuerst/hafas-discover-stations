#!/usr/bin/env node
'use strict'

const mri = require('mri')
const {isatty} = require('tty')
const differ = require('ansi-diff-stream')
const esc = require('ansi-escapes')
const ndjson = require('ndjson')

const pkg = require('./package.json')
const walk = require('.')

const argv = mri(process.argv.slice(2), {
	boolean: ['help', 'h', 'version', 'v', 'silent', 's']
})

if (argv.h || argv.help) {
	process.stdout.write(`\
${pkg.description}

Usage:
	discover-vbb-stations [first] > stations.ndjson

Options:
	-s, --silent	Don't show progress reports on stderr.
`)
	process.exit(0)
}

if (argv.v || argv.version) {
	process.stdout.write(pkg.name + ' ' + pkg.version + '\n')
	process.exit(0)
}

const first = argv._[0] ? argv._[0] + '' : '900000007102' // Berlin Gesundbrunnen

const data = walk(first)
data
.on('error', (err) => {
	console.error(err.message || err + '')
	process.exitCode = 1
})
.pipe(ndjson.stringify())
.pipe(process.stdout)

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
