import { createSocket } from 'dgram';
import XMLParser from "./lib/XMLParser.js";
import XMLNetSchemata from './lib/XMLNetSchemata.mjs';
import XMLSchemata from './lib/XMLSchemata.js';
import XMLNode from './lib/XMLNode.js';
import { v4 as uuidv4 } from 'uuid';
import { debug } from 'console';

const IPV4_UPNP = '239.255.255.250';
const WS_DISCOVER_PORT = '3702';
const VIDEO_TYPE = 'dn:NetworkVideoTransmitter';
const parser = new XMLParser();
const files = [];
files.push('https://www.w3.org/2003/05/soap-envelope/');
files.push('https://schemas.xmlsoap.org/ws/2005/04/discovery/ws-discovery.xsd');

class ProbeBuilder {
	constructor(xs) {
		this.xs = xs;
		this.message_id = `uuid:${uuidv4()}`;
		this.message = this.build_probe();
	}

	build_header() {
		const fields = [];
		const { xs, message_id } = this;
		//const must = { mustUnderstand: true };
		fields.push({ MessageID: message_id });
		fields.push({ To: 'urn:schemas-xmlsoap-org:ws:2005:04:discovery' });
		fields.push({ Action: 'http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe' });

		const header_fields = fields.map((field) => xs.stringify(field, {}, true));
		return XMLSchemata.any(header_fields.join(""), {});
	}

	build_body() {
		const { xs } = this;
		const video_transmitter = VIDEO_TYPE;
		const types = xs.stringify({ Types: video_transmitter }, {}, true);
		const body = {
			Probe: XMLSchemata.any(types, {})
		};
		const body_xml = xs.stringify(body, {}, true);	
		return XMLSchemata.any(body_xml, {});
	}

	build_probe() {
		const { xs, message_id } = this;
		const message = { 
			Envelope: {
				Header: this.build_header(message_id),
				Body: this.build_body()
			}
		};
		return xs.stringify(message);
	}
}

function splim(v) {
	return v.split(' ').map(v => v.trim());
}

// Deserialization type for ProbeMatch
class ProbeMatch {
	constructor(json_msg) {
		this.raw = json_msg;
	}

	validMatch(origin_id) {
		const { RelatesTo, To, Action } = this.raw?.Header;
		return origin_id == RelatesTo &&
			To == "http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous" &&
			Action == "http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches" &&
			this.types.includes(VIDEO_TYPE, 0);
	}

	get message_id() {
		return this.raw.Header.MessageID;
	}

	get types() {
		return splim(this.raw.Body.ProbeMatches.ProbeMatch.Types);
	}

	get scopes() {
		return splim(this.raw.Body.ProbeMatches.ProbeMatch.Scopes);
	}

	get endpointAddress() {
		return this.raw.Body.EndpointReference.Address;
	}

	get transports() {
		const xaddrs = this.raw.Body.ProbeMatches.ProbeMatch?.XAddrs;
		
		if(xaddrs) {
			return xaddrs.split(" ").map(v => v.trim());
		}
	}
}

// Helper to promisify the socket broadcast
async function sendProbe(socket, probe) {
	return new Promise((resolve, reject) => {
		socket.send(probe.message, WS_DISCOVER_PORT, IPV4_UPNP, (err) => {
			if(err) {
				reject(err);
			} else {
				resolve();
			}
		});
	});
}

// Helper to deserialize and process probe match
function processProbeMatch(message, probe, remote) {
	let document = parser.process(message.toString());
	const transformer = XMLNode.toObject({});
	const json_msg = transformer(document);

	const probe_match = new ProbeMatch(json_msg);
	if(probe_match.validMatch(probe.message_id)) { 
		return probe_match; 
	} else if(probe_match.message_id != probe.message_id) {
		console.log(json_msg);
	}
}

// Helper to combine operations in order to enumerate devices
async function enumerateDevices(socket, scan_time) {
	const devices = [];
	const xs = await XMLNetSchemata.fromNetFiles(...files);
	const probe = new ProbeBuilder(xs);

	socket.on('message', (message, remote) => {
		const match = processProbeMatch(message, probe, remote);
		if(match) {
			devices.push(match);
		}
	});
	const probe_req = await sendProbe(socket, probe);
	return new Promise((resolve) => {
		setTimeout(() => {
			socket.on('close', () => resolve(devices));
			socket.close();
		}, scan_time);
	});
}

// Voila
export default function discoverDevices(scan_time = 5000) {
	return new Promise((resolve, reject) => {
		const socket = createSocket('udp4');
		socket.bind(WS_DISCOVER_PORT, () => {
			socket.addMembership(IPV4_UPNP);
			socket.setBroadcast(true);
			enumerateDevices(socket, scan_time).then((devices) => {
				resolve(devices);
			});
		});
		socket.on('error', reject);
	});
}

discoverDevices().then(devices => {
	const ddata = devices.map(v => {
		const { types, transports } = v;
		return { types, transports };
	});
	console.log(ddata)
}).catch(err => console.error(err));