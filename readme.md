# hafas-discover-stations

**Pass in a HAFAS client, discover stops/stations by querying departures.** It tries to find all stops/stations that all trains known by the endpoint stop at.

[![npm version](https://img.shields.io/npm/v/hafas-discover-stations.svg)](https://www.npmjs.com/package/hafas-discover-stations)
[![build status](https://img.shields.io/travis/derhuerst/hafas-discover-stations.svg)](https://travis-ci.org/derhuerst/hafas-discover-stations)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/hafas-discover-stations.svg)
[![chat on gitter](https://badges.gitter.im/derhuerst.svg)](https://gitter.im/derhuerst)
[![support me on Patreon](https://img.shields.io/badge/support%20me-on%20patreon-fa7664.svg)](https://patreon.com/derhuerst)


## Installing

```shell
npm install hafas-discover-stations
```


## Usage

```js
const createWalk = require('hafas-discover-stations')
const createHafas = require('db-hafas')

const hafas = createHafas('my-awesome-program')
const walk = createWalk(db)

const berlinFriedrichstr = '8011306' // where to start
walk(berlinFriedrichstr)
.on('data', console.log)
.on('error', console.error)
```

`walk()` returns a [readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable) [in object mode](https://nodejs.org/api/stream.html#stream_object_mode). It emits the following events:

- `data`: a new stop/station that has been discovered
- `stats`: an object with the following keys:
	- `stations`: the number of stops/stations discovered
	- `requests`: the number of requests sent
	- `queued`: the number of queued stop/station IDs
- `edge`: a connection between two stops/stations, with the following keys:
	- `source`: a [*Friendly Public Transport Format* `1.0.1`](https://github.com/public-transport/friendly-public-transport-format/blob/1.0.1/spec/readme.md) `stop`/`station` object
	- `target`: a [*Friendly Public Transport Format* `1.0.1`](https://github.com/public-transport/friendly-public-transport-format/blob/1.0.1/spec/readme.md) `stop`/`station` object
	- `duration`: time to travel, in milliseconds
	- `line`: a [*Friendly Public Transport Format* `1.0.1` `line` object](https://github.com/public-transport/friendly-public-transport-format/blob/1.0.1/spec/readme.md#line)


## API

```js
walk(stationId, [opt])
```

`opt` may have the following keys. It will be passed into [`queue()`](https://github.com/jessetane/queue#constructor).

- `concurrency`: number of requests run in parallel – default: `2`
- `timeout`: timeout for a single job in milliseconds – default: `10000`
- `parseStationId`: an optional function to process station IDs – default: `id => id`


## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/derhuerst/hafas-discover-stations/issues).
