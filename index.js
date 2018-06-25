'use strict'

const {DateTime} = require('luxon')
const {Readable} = require('stream')
const createQueue = require('queue')

const defaults = {
	concurrency: 2,
	timeout: 10 * 10000,
	parseStationId: id => id
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

		const out = new Readable({
			objectMode: true,
			read: () => {}
		})
		const queue = createQueue({
			concurrency: opt.concurrency,
			timeout: opt.timeout
		})
		const visited = Object.create(null)
		const edges = Object.create(null) // by sourceID-targetID
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

		const onStations = (stations, source) => {
			for (let station of stations) {
				const sId = parseStationId(station.id)
				if (visited[sId]) return
				visited[sId] = true

				nrOfStations++
				out.push(station)
				queue.push(queryDepartures(sId))
				if (source) queue.push(queryJourneys(source, sId))
			}
			stats()
		}

		const onEdge = (source, target, duration, line) => {
			const signature = [
				parseStationId(source.id),
				parseStationId(target.id),
				duration, line.name
			].join('-')
			if (edges[signature]) return
			edges[signature] = true

			nrOfEdges++
			out.emit('edge', {source, target, duration, line})
		}

		const queryLocations = (name, source) => (cb) => {
			nrOfRequests++
			stats()

			hafas.locations(name, {addresses: false, poi: false})
			.then((stations) => {
				onStations(stations, source)
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
					const source = parseStationId(dep.station.id)
					queue.push(queryLocations(dep.direction, source))
				}
				cb()
			})
			.catch(cb)
		}

		const queryJourneys = (source, target) => (cb) => {
			nrOfRequests++
			stats()

			hafas.journeys(source, target, {passedStations: true, when: opt.when})
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

		queue.on('error', (err) => {
			if (err && err.isHafasError) out.emit('hafas-error', err)
			else out.emit('error', err)
		})
		queue.on('end', () => out.push(null))
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
