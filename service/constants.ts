export const IPV4_UPNP = '239.255.255.250';
export const IPV6_UPNP = 'ff02::f';
export const WS_DISCOVER_PORT = 3702;
export const ProbeMatchAction = "http://schemas.xmlsoap.org/ws/2005/04/discovery/ProbeMatches";
export const ProbeAction = 'urn:schemas-xmlsoap-org:ws:2005:04:discovery';
export const DiscoveryUrn = 'urn:schemas-xmlsoap-org:ws:2005:04:discovery';
export const AnonAddress = "http://schemas.xmlsoap.org/ws/2004/08/addressing/role/anonymous";
export const xsd_files: string[] = [];

xsd_files.push('https://www.w3.org/2003/05/soap-envelope/');
xsd_files.push('https://schemas.xmlsoap.org/ws/2005/04/discovery/ws-discovery.xsd');