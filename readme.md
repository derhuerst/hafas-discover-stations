# hafas-discover-stations

**Pass in a HAFAS client, discover stations by querying departures.** It tries to find all stations that all trains known by the endpoint stop at.

[![npm version](https://img.shields.io/npm/v/hafas-discover-stations.svg)](https://www.npmjs.com/package/hafas-discover-stations)
[![build status](https://img.shields.io/travis/derhuerst/hafas-discover-stations.svg)](https://travis-ci.org/derhuerst/hafas-discover-stations)
![ISC-licensed](https://img.shields.io/github/license/derhuerst/hafas-discover-stations.svg)
[![chat on gitter](https://badges.gitter.im/derhuerst.svg)](https://gitter.im/derhuerst)


## Installing

```shell
npm install hafas-discover-stations
```


## Usage

### using the command line

```shell
npx hafas-discover-stations [station-id] >stations.ndjson
```

### using JavaScript

```js
const walk = require('hafas-discover-stations')

walk(stationId) // where to start
.on('data', console.log)
.on('error', console.error)
```

`walk()` returns a [readable stream](http://nodejs.org/api/stream.html#stream_class_stream_readable) [in object mode](https://nodejs.org/api/stream.html#stream_object_mode). It emits the following events:

- `data`: a new station that has been discovered
- `stats`: an object with the following keys:
	- `stations`: the number of stations discovered
	- `requests`: the number of requests sent
	- `queued`: the number of queued station IDs
- `edge`: a connection between two stations, with the following keys:
	- `from`: an [FPTF](https://github.com/public-transport/friendly-public-transport-format) `station` object
	- `to`: an [FPTF](https://github.com/public-transport/friendly-public-transport-format) `station` object
	- `duration`: time to travel, in milliseconds
	- `line`: an [vbb-hafas `line` object](https://github.com/derhuerst/vbb-hafas/blob/master/docs/journeys.md#response)


## API

```js
walk(stationId, [opt])
```

`stationId` must be a string and a valid [IBNR](https://de.wikipedia.org/wiki/Internationale_Bahnhofsnummer).

`opt` may have the following keys. It will be passed into [`queue()`](https://github.com/jessetane/queue#constructor).

- `concurrency`: number of requests run in parallel – default: `2`
- `timeout`: timeout for a single job in milliseconds – default: `10000`


## Contributing

If you **have a question**, **found a bug** or want to **propose a feature**, have a look at [the issues page](https://github.com/derhuerst/hafas-discover-stations/issues).
