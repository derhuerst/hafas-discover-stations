import createDebug from 'debug'
import {DateTime} from 'luxon'
import {Readable} from 'node:stream'
import Queue from 'queue'
import speedometer from 'speedometer'
import {createRequestCounter as createReqCounter} from './lib/req-counter.js'

const debug = createDebug('hafas-discover-stations')

const minute = 60 * 1000

const createWalkAndDiscoverStations = (hafas) => {
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

	const walkAndDiscoverStations = (first = null, opt = {}) => {
		if (first !== null && 'string' !== typeof first) {
			opt = first
			first = null
		}

		opt = {
			concurrency: 4,
			timeout: 30 * 1000,
			parseStationId: id => id,
			subStops: true,
			linesOfStops: false,
			shouldQueryDeparturesAt: (stopId, hops) => true,
			...opt,
		}
		if (!('when' in opt) || opt.when === null) {
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
		const queue = new Queue({
			concurrency: opt.concurrency,
			timeout: opt.timeout
		})
		const visitedStopsAndStations = Object.create(null) // by stop/station ID
		const visitedTrips = Object.create(null) // by tripId
		// by originId-targetId-when
		const visitedJourneys = Object.create(null)
		// by sourceID-targetID-duration-lineName
		const visitedEdges = Object.create(null)
		const stopsAndStationsSpeed = speedometer(30) // 30s window
		let stopsAndStationsPerSecond = 0
		let nrOfStopsAndStations = 0
		let nrOfEdges = 0

		// todo: count failed requests
		const reqCounter = createReqCounter()
		const stats = () => {
			out.emit('stats', {
				stopsAndStations: nrOfStopsAndStations,
				stopsAndStationsPerSecond,
				edges: nrOfEdges,
				...reqCounter.getStats(),
				queuedReqs: queue.length,
				eta: (stopsAndStationsPerSecond === 0
					? Infinity
					: Math.ceil(queue.length / stopsAndStationsPerSecond)
				),
			})
		}

		const onStation = (station, hops) => {
			const sId = opt.parseStationId(station.id)
			if (visitedStopsAndStations[sId]) return;

			visitedStopsAndStations[sId] = true
			nrOfStopsAndStations++
			out.push(station)
			stopsAndStationsPerSecond = stopsAndStationsSpeed(1)

			if (opt.shouldQueryDeparturesAt(sId, hops + 1)) {
				queue.push(queryDepartures(sId, hops + 1))
			}
		}

		const onStop = (stop, hops) => {
			if (stop.station) onStation(stop.station, hops)

			const sId = opt.parseStationId(stop.id)
			if (visitedStopsAndStations[sId]) return;
			visitedStopsAndStations[sId] = true

			nrOfStopsAndStations++
			out.push(stop)
			stopsAndStationsPerSecond = stopsAndStationsSpeed(1)

			if (opt.shouldQueryDeparturesAt(sId, hops + 1)) {
				queue.push(queryDepartures(sId, hops + 1))
			}
		}

		const onStopsAndStations = (stopsAndStations, hops) => {
			for (const stopOrStation of stopsAndStations) {
				if (stopOrStation.type === 'station') {
					onStation(stopOrStation, hops)
				} else {
					onStop(stopOrStation, hops)
				}
			}
			stats()
		}

		const onEdge = (source, target, duration, line, hops) => {
			const signature = [
				opt.parseStationId(source.id),
				opt.parseStationId(target.id),
				duration, line.name
			].join('-')
			if (visitedEdges[signature]) return;
			visitedEdges[signature] = true

			nrOfEdges++
			out.emit('edge', {source, target, duration, line, hops})
		}

		const onLeg = (leg, hops) => {
			if (!Array.isArray(leg.stopovers)) return // todo

			for (let i = 1; i < leg.stopovers.length; i++) {
				const st1 = leg.stopovers[i - 1]
				const st2 = leg.stopovers[i]
				// todo: planned{Arrival,Departure}
				const start = st1.arrival || st1.departure // todo: swap?
				const end = st2.arrival || st2.departure
				if (!start || !end) continue
				const duration = new Date(end) - new Date(start)
				onEdge(st1.stop, st2.stop, duration, leg.line, hops)
			}

			const stops = leg.stopovers.map(st => st.stop)
			onStopsAndStations(stops, hops)
		}

		const queryStopovers = (tripId, lineName, direction, when, originId, hops) => (cb) => {
			debug('stopovers', tripId, lineName, direction, 'originId', originId, 'hops', hops)

			const t0 = Date.now()
			hafas.trip(tripId, lineName || 'foo', {
				when,
				subStops: !!opt.subStops,
				linesOfStops: !!opt.linesOfStops,
			})
			.then(({trip}) => {
				reqCounter.onReqTime(Date.now() - t0)
				stats()

				onLeg(trip, hops)
				cb()
			})
			.catch((err) => {
				if (!err || !err.isHafasError) throw err
				debug(tripId, 'using locations() + journeys() as fallback for journeyLeg()')

				const t0 = Date.now()
				return hafas.locations(direction, {
					addresses: false, poi: false,
					results: 3,
					subStops: !!opt.subStops,
					linesOfStops: !!opt.linesOfStops,
				})
				.then((targets) => {
					reqCounter.onReqTime(Date.now() - t0)
					stats()

					onStopsAndStations(targets, hops)

					for (let target of targets) {
						const tId = opt.parseStationId(target.id)
						const sig = [
							originId, tId, Math.round(when / minute)
						].join('-')
						if (!visitedJourneys[sig]) {
							visitedJourneys[sig] = true
							queue.unshift(queryJourneys(originId, tId, when, hops))
						}
					}
					cb()
				})
			})
			.catch(cb)
		}

		const queryDepartures = (id, hops) => (cb) => {
			debug('departures', id, 'hops', hops)

			const t0 = Date.now()
			hafas.departures(id, {
				when: opt.when,
				duration: 60,
				remarks: false,
				subStops: !!opt.subStops,
				linesOfStops: !!opt.linesOfStops,
			})
			.then(({departures: deps}) => {
				reqCounter.onReqTime(Date.now() - t0)
				stats()

				onStopsAndStations(deps.map(dep => dep.stop), hops + 1)

				for (let dep of deps) {
					if (visitedTrips[dep.tripId]) continue
					visitedTrips[dep.tripId] = true

					const {tripId, direction} = dep
					const lName = dep.line && dep.line.name || ''
					const when = new Date(dep.when) - 2 * minute
					const origId = opt.parseStationId(dep.stop.id)
					queue.unshift(queryStopovers(tripId, lName, direction, when, origId, hops + 1))
				}
				cb()
			})
			.catch(cb)
		}

		const queryJourneys = (originId, target, when, hops) => (cb) => {
			debug('journeys', originId, target, when, hops)

			const t0 = Date.now()
			hafas.journeys(originId, target, {
				results: 1, startWithWalking: false,
				departure: when,
				stopovers: true, remarks: false,
				subStops: !!opt.subStops,
				linesOfStops: !!opt.linesOfStops,
			})
			.then(({journeys}) => {
				reqCounter.onReqTime(Date.now() - t0)
				stats()

				for (let journey of journeys) {
					for (let leg of journey.legs) onLeg(leg, hops)
				}
				cb()
			})
			.catch(cb)
		}

		queue.addEventListener('error', (ev) => {
			const {error: err} = ev.detail || {}
			debug('queue error', err)
			if (err) {
				if (err.isHafasError) {
					out.emit('hafas-error', err)
				} else {
					queue.end(err)
				}
			} else {
				queue.end()
			}
		})
		queue.addEventListener('end', (ev) => {
			const {error: err} = ev.detail || {}
			debug('queue end', 'error?', err)
			if (err) out.destroy(err)
			else {
				setTimeout(() => {
					out.push(null) // end the stream
				}, 0)
			}
		})
		out.stop = () => {
			debug('flushing the queue')
			queue.end()
		}

		const markAsVisited = (stopId) => {
			visitedStopsAndStations[stopId] = true
		}
		out.markAsVisited = markAsVisited

		const queueStopId = (stopId) => {
			queue.push(queryDepartures(stopId, 0))
			if (!queue.running) queue.start()
		}
		out.queueStopId = queueStopId

		if (first) setImmediate(queueStopId, first)
		return out
	}
	return walkAndDiscoverStations
}

export {
	createWalkAndDiscoverStations,
}
