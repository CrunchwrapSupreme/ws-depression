
import XMLNetSchemata from '../lib/XMLNetSchemata.js';
import XMLNode from '../lib/XMLNode.js';
import XMLReader from '../lib/XMLParser.js';
import XMLSchemata from '../lib/XMLSchemata.js';

import { IPV4_UPNP, IPV6_UPNP, WS_DISCOVER_PORT, xsd_files } from './constants.js';
import { ProbeMatch } from './ProbeMatch.js';
import { ProbeBuilder } from './ProbeBuilder.js';

import { RemoteInfo, SocketType, createSocket } from 'dgram';
import EventEmitter from 'events';

const parser = new XMLReader();

/** Generic interface for testing + supporting other socket types. */
export interface SocketProducer {
    on(event: 'message', listener: (message: Buffer, remote: RemoteInfo) => void): void;
    on(event: 'close', listener: () => void): void;
    send(message: string, port: number, address: string, handler: (err: Error) => void): void;
    close(): void;
}

/**
 * An generic error wrapper sent by DeviceEmitter on processing errors
 */
export class DiscoveryError extends Error {
    readonly datagram: Buffer;
    readonly remote: RemoteInfo;
    readonly cause: Error;

    constructor(cause: Error, datagram: Buffer, remote: RemoteInfo) {
        super(DiscoveryError.formatDgramErr(cause, remote));
        this.datagram = datagram;
        this.remote = remote;
        this.cause = cause;
    }

    /** Format the error string for [[DiscoveryError]] */
    static formatDgramErr(cause: Error, info: RemoteInfo): string {
        const info_str = `${info.address}:${info.port} (${info.size} bytes)`;
        return `Error processing datagram ${info_str}:\n${cause.message}`;
    }
}

/**
 * Utility class to wrap socket with an event emitter
 */
export class DeviceEmitter extends EventEmitter {
    readonly socket: SocketProducer;
    readonly xs: XMLSchemata;
    readonly probe: ProbeBuilder;
    readonly types: string[];

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
    /**
     * Emitted when a datagram fails to process.
     * Handler accepts [[DiscoveryError]] on error.
     * @event
     */
    static readonly ERROR = 'error';
    /**
     * Emitted when a datagram is processed but fails validation.
     * Handler accepts [[ProbeMatch]]
     * @event
     */
    static readonly MISMATCH = 'mismatch';

    constructor(socket: SocketProducer, xs: XMLSchemata, types: string[]) {
        super();
        this.socket = socket;
        this.xs = xs;
        this.probe = new ProbeBuilder(xs, types);
        this.types = types;
        this.addListeners();
    }

    /**
     * Close underlying socket and emit close event
     */
    close(): void {
        this.socket.close();
    }

    /**
     * Send a probe on the underlying socket and emit probe event
     */
    sendProbe(broadcast_addr: string, port: number): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket.send(this.probe.message, port, broadcast_addr, (err) => {
                if (err) {
                    reject(err);
                } else {
                    this.emit(DeviceEmitter.PROBE, this.probe);
                    resolve();
                }
            });
        });
    }

    /** Broadcast IPv4 UDP probe */
    broadcastProbeV4() {
        return this.sendProbe(IPV4_UPNP, WS_DISCOVER_PORT);
    }

    /** Broadcast IPv6 UDP probe */
    broadcastProbeV6() {
        return this.sendProbe(IPV6_UPNP, WS_DISCOVER_PORT);
    }

    private addListeners(): void {
        this.socket.on('close', () => this.emit(DeviceEmitter.CLOSE));
        this.socket.on('message', (message: Buffer, remote: RemoteInfo) => {
            try {
                this.processProbeMatch(message, remote);
            } catch(err) {
                const wrapper = new DiscoveryError(err, message, remote);
                this.emit(DeviceEmitter.ERROR, wrapper);
            }
        });
    }

    private processProbeMatch(message: Buffer, remote: RemoteInfo) {
        let document = parser.process(message.toString());
        const transformer = XMLNode.toObject({});
        const json_msg = transformer(document);
        const probe_match = new ProbeMatch(json_msg, remote);
        
        if (probe_match.validMatch(this.probe.message_id, this.types)) {
            this.emit(DeviceEmitter.MATCH, probe_match);
        } else if (probe_match.message_id != this.probe.message_id) {
            this.emit(DeviceEmitter.MISMATCH, probe_match)
        }
    }
}

/**
 * Resolves with a [[DeviceEmitter]] that emits discovery events. Only passively listens unless
 * you call probe()
 * @param socket 
 * @param types list of types to probe by such as 'dn:NetworkVideoTransmitter'
 * @returns an emitter for ws-discovery events
 */
export async function deviceSocket(socket: SocketProducer, types: string[] = []): Promise<DeviceEmitter> {
    const xs = await XMLNetSchemata.fromNetFiles(...xsd_files);
    let emitter = new DeviceEmitter(socket, xs, types);
    return Promise.resolve(emitter);
}

async function enumerateDevices(socket: SocketProducer, broadcast_addr: string, port: number, scan_time: number, types: string[]): Promise<ProbeMatch[]> {
    const devices: ProbeMatch[] = [];
    let emitter = await deviceSocket(socket, types);
    emitter.on('match', match => devices.push(match));
    await emitter.sendProbe(broadcast_addr, port);

    return new Promise((resolve) => {
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
            socket.setBroadcast(true);
            socket.addMembership(broadcast_addr);
            enumerateDevices(socket, broadcast_addr, port, scan_time, types).then(devices => resolve(devices)).catch(reject);
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
export function discoverDevicesV4(scan_time: number = 5000, types: string[] = []): Promise<ProbeMatch[]> {
    return socketFactory('udp4', IPV4_UPNP, WS_DISCOVER_PORT, scan_time, types);
}

/**
 * ws-discovery on the UPnP v6 broadcast address
 * @param scan_time time to scan before resolving
 * @param types list of types to probe by such as 'dn:NetworkVideoTransmitter'
 * @returns a promise resolving with an array of probe matches
 */
export function discoverDevicesV6(scan_time: number = 5000, types: string[] = []): Promise<ProbeMatch[]> {
    return socketFactory('udp6', IPV6_UPNP, WS_DISCOVER_PORT, scan_time, types);
}