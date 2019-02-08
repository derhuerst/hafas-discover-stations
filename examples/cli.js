#!/usr/bin/env node
'use strict'

const createHafas = require('db-hafas')
const createWalk = require('..')
const run = require('../bin')

const hafas = createHafas('hafas-discover-stations example')
const walk = createWalk(hafas)

run(walk, {concurrency: 8})
.catch((err) => {
	console.error(err)
	process.exit(1)
})
