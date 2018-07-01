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
		const visitedStations = Object.create(null) // by station ID
		const visitedTrips = Object.create(null) // by tripId
		// by sourceID-targetID-duration-lineName
		const visitedEdges = Object.create(null)
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

		const onStations = (stations, originId) => {
			for (let station of stations) {
				const sId = opt.parseStationId(station.id)
				if (visitedStations[sId]) return
				visitedStations[sId] = true

				nrOfStations++
				out.push(station)
				queue.push(queryDepartures(sId))
				if (originId) queue.push(queryJourneys(originId, sId))
			}
			stats()
		}

		const onEdge = (source, target, duration, line) => {
			const signature = [
				opt.parseStationId(source.id),
				opt.parseStationId(target.id),
				duration, line.name
			].join('-')
			if (visitedEdges[signature]) return
			visitedEdges[signature] = true

			nrOfEdges++
			out.emit('edge', {source, target, duration, line})
		}

		const onLeg = (leg) => {
			if (!Array.isArray(leg.stopovers)) return // todo

			for (let i = 1; i < leg.stopovers.length; i++) {
				const st1 = leg.stopovers[i - 1]
				const st2 = leg.stopovers[i]
				const start = st1.arrival || st1.departure // todo: swap?
				const end = st2.arrival || st2.departure
				if (!start || !end) continue
				const duration = new Date(end) - new Date(start)
				onEdge(st1.stop, st2.stop, duration, leg.line)
			}

			const stations = leg.stopovers.map(st => st.stop)
			onStations(stations)
		}

		const queryLocations = (name, originId) => (cb) => {
			nrOfRequests++
			stats()

			hafas.locations(name, {addresses: false, poi: false})
			.then((stations) => {
				onStations(stations, originId)
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
					if (visitedTrips[dep.tripId]) continue
					visitedTrips[dep.tripId] = true

					const originId = opt.parseStationId(dep.station.id)
					queue.push(queryStopovers(dep.direction, originId))
				}
				cb()
			})
			.catch(cb)
		}

		const queryJourneys = (originId, target) => (cb) => {
			nrOfRequests++
			stats()

			hafas.journeys(originId, target, {stopovers: true, when: opt.when})
			.then((journeys) => {
				for (let journey of journeys) {
					for (let leg of journey.legs) onLeg(leg)
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
