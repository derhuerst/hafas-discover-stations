# hafas-discover-stations

**Pass in a HAFAS client, discover stops/stations by querying departures.** It tries to find all stops/stations that all trains known by the endpoint stop at.

[![npm version](https://img.shields.io/npm/v/hafas-discover-stations.svg)](https://www.npmjs.com/package/hafas-discover-stations)
[![build status](https://img.shields.io/travis/derhuerst/hafas-discover-stations.svg)](https://travis-ci.org/derhuerst/hafas-discover-stations)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/hafas-discover-stations.svg)
[![support me via GitHub Sponsors](https://img.shields.io/badge/support%20me-donate-fa7664.svg)](https://github.com/sponsors/derhuerst)
[![chat with me on Twitter](https://img.shields.io/badge/chat%20with%20me-on%20Twitter-1da1f2.svg)](https://twitter.com/derhuerst)


## Installing

```shell
npm install hafas-discover-stations
```


## Usage

```js
const createWalk = require('hafas-discover-stations')
const createHafas = require('hafas-client')
const dbProfile = require('hafas-client/p/db')

const hafas = createHafas(dbProfile, 'my-awesome-program')
const walk = createWalk(hafas)

const berlinFriedrichstr = '8011306' // where to start
walk(berlinFriedrichstr)
.on('data', console.log)
.on('error', console.error)
```

`walk()` returns a [readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable) [in object mode](https://nodejs.org/api/stream.html#stream_object_mode). It emits the following events:

- `data`: a new stop/station that has been discovered
- `stats`: an object with the following keys:
	- `stopsAndStations`: the number of stops/stations discovered
	- `edges`: the number of edges discovered
	- `totalReqs`: the number of requests sent
	- `avgReqDuration`: the average duration of the last 30 requests
	- `queuedReqs`: the number of queued requests
- `edge`: a connection between two stops/stations, with the following keys:
	- `source`: a [*Friendly Public Transport Format* `1.2.0`](https://github.com/public-transport/friendly-public-transport-format/blob/1.2.0/spec/readme.md) `stop`/`station` object
	- `target`: a [*Friendly Public Transport Format* `1.2.0`](https://github.com/public-transport/friendly-public-transport-format/blob/1.2.0/spec/readme.md) `stop`/`station` object
	- `duration`: time to travel, in milliseconds
	- `line`: a [*Friendly Public Transport Format* `1.2.0` `line` object](https://github.com/public-transport/friendly-public-transport-format/blob/1.2.0/spec/readme.md#line)


## API

```js
walk(stationId, [opt])
```

`opt` may have the following keys. It will be passed into [`queue()`](https://github.com/jessetane/queue#constructor).

- `concurrency`: number of requests run in parallel – default: `2`
- `timeout`: timeout for a single job in milliseconds – default: `10000`
- `parseStationId`: an optional function to process station IDs – default: `id => id`
- `stationLines`: Query lines of stops/stations? – default: `false`


## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/derhuerst/hafas-discover-stations/issues).
