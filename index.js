'use strict'

const {DateTime} = require('luxon')
const {PassThrough} = require('stream')
const createQueue = require('queue')

const defaults = {
	concurrency: 2,
	timeout: 10 * 10000
}

const createWalk = (hafas) => {
	if (!hafas || !hafas.profile) throw new Error('invalid hafas client')
	if ('string' !== typeof hafas.profile.timezone) {
		throw new Error('hafas.profile.timezone must be a string')
	}
	if ('string' !== typeof hafas.profile.locale) {
		throw new Error('hafas.profile.locale must be a string')
	}
	if ('function' !== typeof hafas.locations) {
		throw new Error('hafas.locations must be a function')
	}
	if ('function' !== typeof hafas.departures) {
		throw new Error('hafas.departures must be a function')
	}
	if ('function' !== typeof hafas.journeys) {
		throw new Error('hafas.journeys must be a function')
	}

	const walk = (first, opt = {}) => {
		opt = Object.assign({}, defaults, opt)
		if (!opt.when) {
			// beginning of next week 10 am
			opt.when = DateTime.fromMillis(Date.now(), {
				zone: hafas.profile.timezone,
				locale: hafas.profile.locale
			}).startOf('week').plus({weeks: 1, hours: 10}).toJSDate()
		}

		const out = new PassThrough({objectMode: true})
		const queue = createQueue({
			concurrency: opt.concurrency,
			timeout: opt.timeout
		})
		const visited = Object.create(null)
		const edges = Object.create(null) // by fromID-toID
		let nrOfStations = 0
		let nrOfEdges = 0
		let nrOfRequests = 0

		const stats = () => {
			out.emit('stats', {
				stations: nrOfStations,
				edges: nrOfEdges,
				requests: nrOfRequests,
				queued: queue.length
			})
		}

		const onStations = (stations, from) => {
			for (let station of stations) {
				if (visited[station.id]) return
				visited[station.id] = true

				nrOfStations++
				out.emit('data', station)
				queue.push(queryDepartures(station.id))
				if (from) queue.push(queryJourneys(from, station.id))
			}
			stats()
		}

		const onEdge = (from, to, duration, line) => {
			const signature = [from.id, to.id, duration, line.name].join('-')
			if (edges[signature]) return
			edges[signature] = true

			nrOfEdges++
			out.emit('edge', {from, to, duration, line})
		}

		const queryLocations = (name, from) => (cb) => {
			nrOfRequests++
			stats()

			hafas.locations(name, {addresses: false, poi: false})
			.then((stations) => {
				onStations(stations, from)
				cb()
			})
			.catch(cb)
		}

		const queryDepartures = (id) => (cb) => {
			nrOfRequests++
			stats()

			hafas.departures(id, {when: opt.when})
			.then((deps) => {
				for (let dep of deps) {
					const from = dep.station.id
					queue.push(queryLocations(dep.direction, from))
				}
				cb()
			})
			.catch(cb)
		}

		const queryJourneys = (from, to) => (cb) => {
			nrOfRequests++
			stats()

			hafas.journeys(from, to, {passedStations: true, when: opt.when})
			.then((journeys) => {
				for (let journey of journeys) {
					for (let leg of journey.legs) {
						if (!Array.isArray(leg.passed)) continue

						for (let i = 1; i < leg.passed.length; i++) {
							const p1 = leg.passed[i - 1]
							const p2 = leg.passed[i]
							const start = p1.arrival || p1.departure
							const end = p2.arrival || p2.departure
							if (!start || !end) continue
							const duration = new Date(end) - new Date(start)
							onEdge(p1.station, p2.station, duration, leg.line)
						}

						const stations = leg.passed.map((dep) => dep.station)
						onStations(stations)
					}
				}
				cb()
			})
			.catch(cb)
		}

		queue.on('error', (err) => out.emit('error', err))
		queue.on('end', () => out.end())
		out.stop = () => queue.end()

		setImmediate(() => {
			queue.push(queryDepartures(first))
			queue.start()
		})

		return out
	}
	return walk
}

module.exports = createWalk
