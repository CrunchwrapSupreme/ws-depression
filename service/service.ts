
 import XMLNetSchemata from '../lib/XMLNetSchemata.js';
 import XMLNode from '../lib/XMLNode.js';
 import XMLReader from '../lib/XMLParser.js';

import { IPV4_UPNP, IPV6_UPNP, WS_DISCOVER_PORT, xsd_files } from './constants.js';
import { ProbeMatch } from './ProbeMatch.js';
import { ProbeBuilder } from './ProbeBuilder.js';

import { RemoteInfo, Socket, SocketType, createSocket } from 'dgram';

const parser = new XMLReader();

// Helper to promisify the socket broadcast
async function sendProbe(socket: Socket, probe: ProbeBuilder) {
	return new Promise((resolve, reject) => {
		socket.send(probe.message, WS_DISCOVER_PORT, IPV4_UPNP, (err) => {
			if(err) {
				reject(err);
			} else {
				resolve(true);
			}
		});
	});
}

// Helper to deserialize and process probe match
function processProbeMatch(message: Buffer, probe: ProbeBuilder, remote: RemoteInfo): ProbeMatch | null {
	let document = parser.process(message.toString());
	const transformer = XMLNode.toObject({});
	const json_msg = transformer(document);

	const probe_match = new ProbeMatch(json_msg);
	if(probe_match.validMatch(probe.message_id)) { 
		return probe_match; 
	} else if(probe_match.message_id != probe.message_id) {
		console.log(json_msg);
	}

    return null;
}

// Helper to combine operations in order to enumerate devices
async function enumerateDevices(socket: Socket, scan_time: number, types: string[]): Promise<ProbeMatch[]> {
	const devices: ProbeMatch[] = [];
	const xs = await XMLNetSchemata.fromNetFiles(...xsd_files);
	const probe = new ProbeBuilder(xs, types);

	socket.on('message', (message: Buffer, remote: RemoteInfo) => {
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

// Provide socket options for arbitrary broadcast addresses
export function socketFactory(udp_version: SocketType, broadcast_addr: string, scan_time: number, types: string[]): Promise<ProbeMatch[]> {
    return new Promise((resolve, reject) => {
		const socket = createSocket(udp_version);
		socket.bind(WS_DISCOVER_PORT, () => {
			socket.addMembership(broadcast_addr);
			socket.setBroadcast(true);
			enumerateDevices(socket, scan_time, types).then((devices) => {
				resolve(devices);
			});
		});
		socket.on('error', reject);
	});
}

// Emit a udpv4 probe and then enumerate valid ProbeMatch responses
export function discoverDeviceV4(scan_time = 5000, types: string[] = []): Promise<ProbeMatch[]> {
	return socketFactory('udp4', IPV4_UPNP, scan_time, types);
}

// Emit a udpv6 probe and then enumerate valid ProbeMatch responses
export function discoverDeviceV6(scan_time = 5000, types: string[] = []): Promise<ProbeMatch[]> {
	return socketFactory('udp6', IPV6_UPNP, scan_time, types);
}