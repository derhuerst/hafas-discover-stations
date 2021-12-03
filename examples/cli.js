#!/usr/bin/env node
'use strict'

const createHafas = require('hafas-client')
const dbProfile = require('hafas-client/p/db')
const createWalk = require('..')
const run = require('../bin')
const pkg = require('../package.json')

const hafas = createHafas(dbProfile, 'hafas-discover-stations example')
const walk = createWalk(hafas)

run(walk, {
	name: pkg.name,
	description: pkg.name,
	concurrency: 8
})
.catch((err) => {
	console.error(err)
	process.exit(1)
})
