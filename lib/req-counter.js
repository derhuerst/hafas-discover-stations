'use strict'

const createAvgWindow = require('live-moving-average')

const createRequestCounter = () => {
	let reqs = 0
	const avgReqDuration = createAvgWindow(30, 1000)

	const getStats = () => {
		return {
			totalReqs: reqs,
			avgReqDuration: avgReqDuration.get() | 0
		}
	}

	const onReqTime = (reqTime) => {
		reqs++
		avgReqDuration.push(reqTime)
	}

	return {getStats, onReqTime}
}

module.exports = createRequestCounter
