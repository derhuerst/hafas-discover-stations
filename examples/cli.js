#!/usr/bin/env node

import {createClient as createHafas} from 'hafas-client'
import {profile as dbProfile} from 'hafas-client/p/db/index.js'
import {createWalkAndDiscoverStations as createWalk} from '../index.js'
import {runCli as run} from '../bin.js'
const pkg = require('../package.json')

const hafas = createHafas(dbProfile, 'hafas-discover-stations example')
const walk = createWalk(hafas)

await run(walk, {
	name: pkg.name,
	description: pkg.name,
	concurrency: 8,
})
