import XMLNetSchemata from "../lib/XMLNetSchemata.js";
import { describe, test, expect, beforeAll } from "@jest/globals";
import { ProbeBuilder } from "./ProbeBuilder";
import { video_transmitter } from "./device_types";
import { DiscoveryUrn, ProbeAction, xsd_files } from "./constants";


describe('ProbeBuilder', () => {
    let xs: XMLNetSchemata;

    beforeAll(async () => {
        xs = await XMLNetSchemata.fromNetFiles(...xsd_files);
    }, 5000);

    test('#message', () => {
        const builder = new ProbeBuilder(xs, [video_transmitter]);
        const expected_msg = {
            Header: {
                MessageID: builder.message_id,
                To: DiscoveryUrn,
                Action: ProbeAction
            },
            Body: {
                Probe: {
                    Types: video_transmitter
                }
            }
        }
        debugger;
        expect(builder.object_message).toEqual(expected_msg);
    });
    
    test('#types', () => { 
        const builder = new ProbeBuilder(xs, [video_transmitter]);
        expect(builder.types).toEqual([video_transmitter]);
    });

    test('#message_id', () => {
        const builder = new ProbeBuilder(xs, [video_transmitter]);
        expect(builder.message_id).toBeTruthy();
    });
});