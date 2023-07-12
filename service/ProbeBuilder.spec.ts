import XMLNetSchemata from "../lib/XMLNetSchemata.js";
import { describe, test, expect, beforeAll } from "@jest/globals";
import { ProbeBuilder } from "./ProbeBuilder";
import { video_transmitter } from "./device_types";
import { DiscoveryUrn, ProbeAction, xsd_files } from "./constants";


describe('ProbeBuilder', () => {
    let xs: XMLNetSchemata;
    let builder: ProbeBuilder;

    beforeAll(async () => {
        xs = await XMLNetSchemata.fromNetFiles(...xsd_files);
    })

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
});