
 import XMLNetSchemata from '../lib/XMLNetSchemata.js';
 import XMLNode from '../lib/XMLNode.js';
 import XMLReader from '../lib/XMLParser.js';

import { IPV4_UPNP, IPV6_UPNP, WS_DISCOVER_PORT, xsd_files } from './constants.js';
import { ProbeMatch } from './ProbeMatch.js';
import { ProbeBuilder } from './ProbeBuilder.js';

import { RemoteInfo, Socket, SocketType, createSocket } from 'dgram';
import EventEmitter from 'events';

const parser = new XMLReader();

// Helper to promisify the socket broadcast
async function sendProbe(socket: Socket, probe: ProbeBuilder, broadcast_addr: string, port: number): Promise<null> {
	return new Promise((resolve, reject) => {
		socket.send(probe.message, port, broadcast_addr, (err) => {
			if(err) {
				reject(err);
			} else {
				resolve(null);
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

/**
 * Utility class to wrap socket with an event emitter
 */
export class DeviceEmitter extends EventEmitter {
	readonly socket: Socket;
	readonly xs: any;
	readonly probe: ProbeBuilder;
	/** 
	 * Emitted when a probe is sent
	 * @event
	 */
	static readonly PROBE = 'probe';
	/** 
	 * Emitted when a ProbeMatch is processed and provides it as the argument
	 * @event
	 */
	static readonly MATCH = 'match';
	/**
	 * Emitted when close is called
	 * @event
	 */
	static readonly CLOSE = 'close';

	constructor(socket: Socket, xs: any, types: string[]) {
		super();
		this.socket = socket;
		this.xs = xs;
		this.probe = new ProbeBuilder(xs, types);
		this.socketListener(socket);
	}

	/**
	 * Close underlying socket and emit close event
	 */
	close(): void {
		this.socket.close();
		this.socket.on('close', () => this.emit(DeviceEmitter.CLOSE));
	}

	/**
	 * Send a probe on the underlying socket and emit probe event
	 */
	async sendProbe(broadcast_addr: string, port: number): Promise<null> {
		const prom = sendProbe(this.socket, this.probe, broadcast_addr, port);
		this.emit(DeviceEmitter.PROBE, this.probe);
		return prom;
	}

	private socketListener(socket: Socket): void {
		socket.on('message', (message: Buffer, remote: RemoteInfo) => {
			const match = processProbeMatch(message, this.probe, remote);

			if(match) {
				this.emit(DeviceEmitter.MATCH, match);
			}
		});
	}
}

/**
 * Resolves with a [[DeviceEmitter]] that emits discovery events. Only passively listens unless
 * you call probe()
 * @param socket 
 * @param types list of types to probe by such as 'dn:NetworkVideoTransmitter'
 * @returns an emitter for ws-discovery events
 */
export async function deviceSocket(socket: Socket, types: string[] = []): Promise<DeviceEmitter> {
	const xs = await XMLNetSchemata.fromNetFiles(...xsd_files);
	let emitter = new DeviceEmitter(socket, xs, types);
	return Promise.resolve(emitter);
}

async function enumerateDevices(socket: Socket, broadcast_addr: string, port: number, scan_time: number, types: string[]): Promise<ProbeMatch[]> {
	const devices: ProbeMatch[] = [];
	let emitter = await deviceSocket(socket, types);
	emitter.on('match', match => devices.push(match));
	await emitter.sendProbe(broadcast_addr, port);

	return new Promise((resolve, reject) => {
		setTimeout(() => {
			emitter.on('close', () => resolve(devices));
			emitter.close();
		}, scan_time);
	});
}

/**
 * Convenience function for initializing and enumerating devices with a socket
 * @param udp_version udp4 or udp6
 * @param broadcast_addr valid v4 or v6 broadcast address
 * @param port broadcast port
 * @param scan_time time to scan before resolving
 * @param types list of types to probe by such as 'dn:NetworkVideoTransmitter'
 * @returns 
 */
export function socketFactory(udp_version: SocketType, broadcast_addr: string, port: number, scan_time: number, types: string[]): Promise<ProbeMatch[]> {
    return new Promise((resolve, reject) => {
		const socket = createSocket(udp_version);
		socket.bind(port, () => {
			socket.addMembership(broadcast_addr);
			socket.setBroadcast(true);
			enumerateDevices(socket, broadcast_addr, port, scan_time, types).then(devices => resolve(devices));
		});
		socket.on('error', reject);
	});
}

/**
 * ws-discovery on the UPnP v4 broadcast address
 * @param scan_time time to scan before resolving
 * @param types list of types to probe by such as 'dn:NetworkVideoTransmitter'
 * @returns a promise resolving with an array of probe matches
 */
export function discoverDeviceV4(scan_time: number = 5000, types: string[] = []): Promise<ProbeMatch[]> {
	return socketFactory('udp4', IPV4_UPNP, scan_time, WS_DISCOVER_PORT, types);
}

/**
 * ws-discovery on the UPnP v6 broadcast address
 * @param scan_time time to scan before resolving
 * @param types list of types to probe by such as 'dn:NetworkVideoTransmitter'
 * @returns a promise resolving with an array of probe matches
 */
export function discoverDeviceV6(scan_time: number = 5000, types: string[] = []): Promise<ProbeMatch[]> {
	return socketFactory('udp6', IPV6_UPNP, scan_time, WS_DISCOVER_PORT, types);
}